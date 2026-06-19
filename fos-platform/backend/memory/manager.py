"""
Memory Manager — persistent long-term and short-term memory for FOS.

Architecture:
- SQLite/PostgreSQL for storage
- TF-IDF + cosine similarity for retrieval (no external vector DB required)
- Optional: Qdrant integration for production scale
"""
import json
import math
import re
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, func

from database import Memory, User
from models import MemoryItem, MemoryType, UserProfile
from config import settings


def _tokenize(text: str) -> list[str]:
    return re.findall(r'\b[a-z]{2,}\b', text.lower())


def _tf(tokens: list[str]) -> dict[str, float]:
    counts: dict[str, int] = defaultdict(int)
    for t in tokens:
        counts[t] += 1
    n = len(tokens) or 1
    return {w: c / n for w, c in counts.items()}


def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
    common = set(a) & set(b)
    if not common:
        return 0.0
    dot = sum(a[k] * b[k] for k in common)
    mag_a = math.sqrt(sum(v ** 2 for v in a.values()))
    mag_b = math.sqrt(sum(v ** 2 for v in b.values()))
    return dot / (mag_a * mag_b) if mag_a and mag_b else 0.0


class MemoryManager:
    def __init__(self):
        self._idf_cache: dict[str, float] = {}

    # ── Core CRUD ──────────────────────────────────────────────────────────────

    async def add(
        self,
        db: AsyncSession,
        user_id: str,
        content: str,
        memory_type: MemoryType = MemoryType.KNOWLEDGE,
        metadata: Optional[dict] = None,
        tags: Optional[list[str]] = None,
        importance: float = 0.5,
    ) -> Memory:
        memory = Memory(
            id=str(uuid.uuid4()),
            user_id=user_id,
            memory_type=memory_type.value,
            content=content,
            metadata_=metadata or {},
            tags=tags or [],
            importance=importance,
        )
        db.add(memory)
        await db.commit()
        await db.refresh(memory)
        return memory

    async def update_memory(self, db: AsyncSession, memory_id: str, content: str) -> None:
        await db.execute(
            update(Memory)
            .where(Memory.id == memory_id)
            .values(content=content, updated_at=datetime.utcnow())
        )
        await db.commit()

    async def delete_memory(self, db: AsyncSession, memory_id: str, user_id: str) -> None:
        await db.execute(
            delete(Memory).where(and_(Memory.id == memory_id, Memory.user_id == user_id))
        )
        await db.commit()

    async def get_all(
        self,
        db: AsyncSession,
        user_id: str,
        memory_type: Optional[MemoryType] = None,
        limit: int = 50,
    ) -> list[Memory]:
        query = select(Memory).where(Memory.user_id == user_id)
        if memory_type:
            query = query.where(Memory.memory_type == memory_type.value)
        query = query.order_by(Memory.updated_at.desc()).limit(limit)
        result = await db.execute(query)
        return list(result.scalars())

    # ── Search (TF-IDF cosine similarity) ─────────────────────────────────────

    async def search(
        self,
        db: AsyncSession,
        user_id: str,
        query: str,
        k: int = 5,
        memory_type: Optional[MemoryType] = None,
        min_score: float = 0.05,
    ) -> list[tuple[Memory, float]]:
        """Return top-k memories by TF-IDF cosine similarity to the query."""
        memories = await self.get_all(db, user_id, memory_type, limit=settings.MAX_MEMORY_ITEMS)
        if not memories:
            return []

        query_tf = _tf(_tokenize(query))
        scored: list[tuple[Memory, float]] = []

        for mem in memories:
            mem_tf = _tf(_tokenize(mem.content))
            score = _cosine(query_tf, mem_tf)
            # Boost by importance and recency
            days_old = (datetime.utcnow() - mem.updated_at).days if mem.updated_at else 0
            recency_boost = math.exp(-days_old / 90)  # decay over 90 days
            score = score * (1 + mem.importance * 0.5) * (1 + recency_boost * 0.2)
            if score >= min_score:
                scored.append((mem, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:k]

    async def get_context(
        self,
        db: AsyncSession,
        user_id: str,
        query: str,
        max_chars: int = 3000,
    ) -> tuple[str, list[str]]:
        """Build memory context string for injection into system prompt."""
        results = await self.search(db, user_id, query)
        if not results:
            return "", []

        lines = []
        used_ids = []
        char_count = 0

        for mem, score in results:
            line = f"- [{mem.memory_type}] {mem.content}"
            if char_count + len(line) > max_chars:
                break
            lines.append(line)
            used_ids.append(mem.id)
            char_count += len(line)

            # Increment access count
        return "\n".join(lines), used_ids

    # ── User Profile ───────────────────────────────────────────────────────────

    async def get_profile(self, db: AsyncSession, user_id: str) -> Optional[UserProfile]:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            return None
        profile_data = user.profile or {}
        return UserProfile(user_id=user_id, **profile_data)

    async def update_profile(self, db: AsyncSession, user_id: str, updates: dict) -> None:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user:
            current = user.profile or {}
            current.update(updates)
            await db.execute(
                update(User).where(User.id == user_id).values(profile=current)
            )
            await db.commit()

    async def build_user_context(self, db: AsyncSession, user_id: str) -> str:
        """Build a readable summary of the user's profile for the system prompt."""
        profile = await self.get_profile(db, user_id)
        if not profile:
            return ""

        parts = []
        if profile.name:
            parts.append(f"Name: {profile.name}")
        if profile.role:
            parts.append(f"Role: {profile.role}")
        if profile.company:
            parts.append(f"Company/Project: {profile.company}")
        if profile.goals:
            parts.append(f"Goals: {', '.join(profile.goals)}")
        if profile.interests:
            parts.append(f"Interests: {', '.join(profile.interests)}")
        if profile.writing_style:
            parts.append(f"Writing style: {profile.writing_style}")
        if profile.context:
            parts.append(f"Context: {profile.context}")

        return "\n".join(parts)

    # ── Auto-extraction from conversations ────────────────────────────────────

    async def extract_and_store(
        self,
        db: AsyncSession,
        user_id: str,
        conversation: str,
        ai_router,
    ) -> list[str]:
        """
        Use AI to extract memorable facts from a conversation and store them.
        Returns list of stored memory IDs.
        """
        extraction_prompt = """Extract important facts, preferences, goals, or decisions from this conversation that should be remembered for future sessions.

Format as JSON array of objects:
[{"type": "user|project|knowledge", "content": "fact to remember", "importance": 0.0-1.0, "tags": ["tag1", "tag2"]}]

Only extract genuinely useful long-term information. Skip small talk.
Return empty array [] if nothing worth remembering.

Conversation:
""" + conversation[:4000]

        messages = [
            {"role": "system", "content": "You are a memory extraction assistant. Return only valid JSON."},
            {"role": "user", "content": extraction_prompt}
        ]

        try:
            from ai.router import TaskComplexity
            text, _ = await ai_router.complete(messages, complexity=TaskComplexity.FAST)

            # Extract JSON from response
            match = re.search(r'\[.*\]', text, re.DOTALL)
            if not match:
                return []

            items = json.loads(match.group())
            stored_ids = []

            for item in items[:10]:  # max 10 per conversation
                mem = await self.add(
                    db, user_id,
                    content=item.get("content", ""),
                    memory_type=MemoryType(item.get("type", "knowledge")),
                    tags=item.get("tags", []),
                    importance=float(item.get("importance", 0.5)),
                )
                stored_ids.append(mem.id)

            return stored_ids
        except Exception:
            return []

    # ── Conversation summarization ─────────────────────────────────────────────

    async def summarize_conversation(
        self,
        messages: list[dict],
        ai_router,
    ) -> str:
        """Create a concise summary of a conversation for long-term storage."""
        if not messages:
            return ""

        conversation_text = "\n".join([
            f"{m['role'].upper()}: {m['content'][:500]}"
            for m in messages[-20:]  # last 20 messages
        ])

        summary_messages = [
            {
                "role": "system",
                "content": "Summarize this conversation in 2-3 sentences capturing the key topics, decisions, and outcomes."
            },
            {"role": "user", "content": conversation_text}
        ]

        from ai.router import TaskComplexity
        text, _ = await ai_router.complete(summary_messages, complexity=TaskComplexity.FAST)
        return text


# Singleton
memory_manager = MemoryManager()
