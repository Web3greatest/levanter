"""
FOS Platform — FastAPI Backend
Unified AI assistant API with memory, agents, documents, voice, and search.
"""
import asyncio
import base64
import json
import uuid
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional, AsyncIterator

import aiofiles
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from config import settings
from database import init_db, get_db, User, Conversation, Memory
from models import (
    ChatRequest, ChatResponse, MemoryItem, MemoryType, UserProfile,
    SearchRequest, AgentRequest, AgentResponse, AgentType,
    AuthRequest, AuthResponse, VoiceRequest, DocumentInfo,
    UserApiKeys, ResearchRequest, AnalyzeUrlRequest,
)
from ai.router import ai_router
from memory.manager import memory_manager
from agents.orchestrator import create_orchestrator
from processors.document import document_processor
from search.engine import search_engine


# ── App lifecycle ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="The world's most advanced AI platform for founders and builders.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

orchestrator = create_orchestrator(ai_router)
security = HTTPBearer(auto_error=False)

# In-memory session store (use Redis in production)
active_sessions: dict[str, list[dict]] = {}


# ── Auto-learning helper ───────────────────────────────────────────────────────

async def _auto_learn(user_id: str, user_msg: str, ai_response: str):
    """Extract and store insights from a conversation exchange into user memory.
    Always creates its own DB session — never reuses the request session."""
    try:
        from database import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            conversation = f"USER: {user_msg}\n\nASSISTANT: {ai_response}"
            await memory_manager.extract_and_store(db, user_id, conversation, ai_router)
    except Exception:
        pass  # Learning failures are silent — never break the chat flow


# ── Auth helpers ───────────────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    import bcrypt
    return bcrypt.hashpw(password[:72].encode(), bcrypt.gensalt()).decode()


def _verify_password(plain: str, hashed: str) -> bool:
    import bcrypt
    try:
        return bcrypt.checkpw(plain[:72].encode(), hashed.encode())
    except Exception:
        return False


def _create_token(user_id: str) -> str:
    from jose import jwt
    payload = {"sub": user_id, "exp": datetime.utcnow().timestamp() + settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def _decode_token(token: str) -> Optional[str]:
    try:
        from jose import jwt
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload.get("sub")
    except Exception:
        return None


async def _get_or_create_default_user(db: AsyncSession) -> User:
    """Ensure a default user exists for unauthenticated requests."""
    result = await db.execute(select(User).where(User.id == "default"))
    user = result.scalar_one_or_none()
    if not user:
        user = User(
            id="default",
            username="default",
            email="default@fos.local",
            name="Default User",
            hashed_password=_hash_password("changeme"),
        )
        db.add(user)
        await db.commit()
    return user


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Returns full User object. Returns default user if no auth."""
    if not credentials:
        return await _get_or_create_default_user(db)
    user_id = _decode_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> str:
    user = await get_current_user(credentials, db)
    return user.id


# ── Core chat endpoints ────────────────────────────────────────────────────────

@app.post("/api/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Main chat endpoint (non-streaming)."""
    user_id = current_user.id
    session_id = request.session_id or str(uuid.uuid4())
    history = active_sessions.get(session_id, [])

    result = await orchestrator.execute(
        query=request.message,
        user_id=user_id,
        db=db,
        conversation_history=history,
        agent_type=request.agent,
        tools=["search_memory"] + (["web_search"] if "web" in request.tools else []),
        stream=False,
        provider=request.provider,
        model=request.model,
        user_api_keys=current_user.api_keys or {},
    )

    history.append({"role": "user", "content": request.message})
    history.append({"role": "assistant", "content": result["response"]})
    active_sessions[session_id] = history[-40:]

    conv_id = request.conversation_id or str(uuid.uuid4())
    await _save_conversation(db, user_id, conv_id, history, result.get("model", "unknown"))

    # Auto-learn: extract and store insights from this exchange in background
    asyncio.create_task(_auto_learn(user_id, request.message, result["response"]))

    return ChatResponse(
        id=str(uuid.uuid4()),
        content=result["response"],
        model=result.get("model", "unknown"),
        agent=result.get("agent"),
        tools_called=result.get("tools_used", []),
    )


@app.post("/api/chat/stream")
async def chat_stream(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Streaming chat endpoint — returns Server-Sent Events."""
    user_id = current_user.id
    session_id = request.session_id or str(uuid.uuid4())
    history = active_sessions.get(session_id, [])
    user_api_keys = current_user.api_keys or {}

    result = await orchestrator.execute(
        query=request.message,
        user_id=user_id,
        db=db,
        conversation_history=history,
        agent_type=request.agent,
        tools=["search_memory"],
        stream=True,
        provider=request.provider,
        model=request.model,
        user_api_keys=user_api_keys,
    )

    async def event_stream():
        full_response = ""
        yield f"data: {json.dumps({'type': 'agent', 'agent': result['agent']})}\n\n"
        yield f"data: {json.dumps({'type': 'tools', 'tools': result['tools_used']})}\n\n"

        async for chunk in result["stream"]:
            full_response += chunk
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

        history.append({"role": "user", "content": request.message})
        history.append({"role": "assistant", "content": full_response})
        active_sessions[session_id] = history[-40:]
        conv_id = request.conversation_id or str(uuid.uuid4())
        await _save_conversation(db, user_id, conv_id, history, "streaming")

        # Auto-learn from streaming exchange
        asyncio.create_task(_auto_learn(user_id, request.message, full_response))

        yield f"data: {json.dumps({'type': 'done', 'session_id': session_id, 'conversation_id': conv_id})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.websocket("/ws/chat")
async def websocket_chat(
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db),
):
    """WebSocket endpoint for real-time bidirectional chat."""
    await websocket.accept()
    session_id = str(uuid.uuid4())
    history: list[dict] = []
    current_user = await _get_or_create_default_user(db)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "message")

            if msg_type == "auth":
                user_id = _decode_token(data.get("token", "")) or "default"
                result = await db.execute(select(User).where(User.id == user_id))
                current_user = result.scalar_one_or_none() or await _get_or_create_default_user(db)
                await websocket.send_json({"type": "auth_ok", "user_id": current_user.id})
                continue

            if msg_type == "message":
                query = data.get("content", "")
                agent = AgentType(data["agent"]) if data.get("agent") else None

                await websocket.send_json({"type": "thinking"})

                result = await orchestrator.execute(
                    query=query,
                    user_id=current_user.id,
                    db=db,
                    conversation_history=history,
                    agent_type=agent,
                    tools=["search_memory"],
                    stream=True,
                    user_api_keys=current_user.api_keys or {},
                )

                await websocket.send_json({"type": "agent", "agent": result["agent"]})

                full_response = ""
                async for chunk in result["stream"]:
                    full_response += chunk
                    await websocket.send_json({"type": "chunk", "content": chunk})

                history.append({"role": "user", "content": query})
                history.append({"role": "assistant", "content": full_response})
                history = history[-40:]

                await websocket.send_json({
                    "type": "done",
                    "session_id": session_id,
                    "tools_used": result.get("tools_used", []),
                })

            elif msg_type == "clear":
                history = []
                await websocket.send_json({"type": "cleared"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})


# ── Memory endpoints ───────────────────────────────────────────────────────────

@app.get("/api/memory")
async def list_memories(
    memory_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mtype = MemoryType(memory_type) if memory_type else None
    memories = await memory_manager.get_all(db, current_user.id, mtype)
    return [
        {
            "id": m.id,
            "type": m.memory_type,
            "content": m.content,
            "tags": m.tags,
            "importance": m.importance,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in memories
    ]


@app.post("/api/memory")
async def add_memory(
    item: MemoryItem,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mem = await memory_manager.add(
        db, current_user.id, item.content, item.memory_type,
        item.metadata, item.tags, item.importance
    )
    return {"id": mem.id, "status": "created"}


@app.delete("/api/memory/{memory_id}")
async def delete_memory(
    memory_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await memory_manager.delete_memory(db, memory_id, current_user.id)
    return {"status": "deleted"}


@app.get("/api/memory/search")
async def search_memory(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    results = await memory_manager.search(db, current_user.id, q)
    return [
        {"id": m.id, "content": m.content, "score": round(score, 3), "type": m.memory_type}
        for m, score in results
    ]


@app.get("/api/profile")
async def get_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = await memory_manager.get_profile(db, current_user.id)
    return profile or {"user_id": current_user.id}


@app.put("/api/profile")
async def update_profile(
    updates: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await memory_manager.update_profile(db, current_user.id, updates)
    return {"status": "updated"}


# ── Document endpoints ─────────────────────────────────────────────────────────

@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.size and file.size > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File too large. Max {settings.MAX_FILE_SIZE_MB}MB.")

    content = await file.read()
    doc = await document_processor.save_document(db, current_user.id, file.filename, content, ai_router)

    # Store document summary in user knowledge memory for future AI context
    if doc.summary:
        asyncio.create_task(_store_doc_insight(current_user.id, doc.filename, doc.summary))

    return {
        "id": doc.id,
        "filename": doc.filename,
        "type": doc.file_type,
        "size": doc.size_bytes,
        "summary": doc.summary,
        "pages": doc.page_count,
    }


async def _store_doc_insight(user_id: str, filename: str, summary: str):
    """Persist document summary as a knowledge memory so AI can reference it in chat."""
    try:
        from database import AsyncSessionLocal
        from models import MemoryType
        async with AsyncSessionLocal() as db:
            await memory_manager.add(
                db, user_id,
                content=f"[Document: {filename}] {summary}",
                memory_type=MemoryType.KNOWLEDGE,
                tags=["document", "upload"],
                importance=0.8,
            )
    except Exception:
        pass


@app.get("/api/documents")
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    docs = await document_processor.list_documents(db, current_user.id)
    return [{"id": d.id, "filename": d.filename, "type": d.file_type, "summary": d.summary, "uploaded_at": d.uploaded_at.isoformat()} for d in docs]


@app.post("/api/documents/{doc_id}/ask")
async def ask_document(
    doc_id: str,
    question: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    answer = await document_processor.answer_from_document(db, doc_id, current_user.id, question, ai_router)
    return {"answer": answer}


# ── Agent endpoints ────────────────────────────────────────────────────────────

@app.post("/api/agents/run", response_model=AgentResponse)
async def run_agent(
    request: AgentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    agent_type = request.effective_agent()
    task = request.effective_task()

    result = await orchestrator.execute(
        query=task,
        user_id=current_user.id,
        db=db,
        conversation_history=list(request.context.get("history", [])),
        agent_type=agent_type,
        tools=["search_memory", "web_search"],
        user_api_keys=current_user.api_keys or {},
    )
    return AgentResponse(
        agent=result["agent"],
        result=result.get("response", ""),
        actions_taken=result.get("tools_used", []),
        next_steps=[],
    )


@app.post("/api/agents/workflow")
async def run_workflow(
    steps: list[dict],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    results = await orchestrator.execute_workflow(steps, current_user.id, db)
    return {"steps": results}


# ── Search endpoints ───────────────────────────────────────────────────────────

@app.post("/api/search")
async def search(
    request: SearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    results = []

    if "web" in request.sources:
        web = await search_engine.web_search(request.query, request.max_results)
        results.extend([{"source": "web", **r} for r in web])

    if "memory" in request.sources:
        memory_results = await memory_manager.search(db, current_user.id, request.query, request.max_results)
        results.extend([
            {"source": "memory", "title": m.memory_type, "content": m.content, "relevance": round(s, 3)}
            for m, s in memory_results
        ])

    if "documents" in request.sources:
        doc_text = await document_processor.search_documents(db, current_user.id, request.query)
        if doc_text:
            results.append({"source": "documents", "title": "Document Match", "content": doc_text})

    return {"query": request.query, "results": results}


@app.post("/api/research")
async def deep_research(
    request: ResearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = await search_engine.research_topic(request.topic, ai_router)
    return {"topic": request.topic, "report": report}


@app.post("/api/analyze-url")
async def analyze_url(
    request: AnalyzeUrlRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = await search_engine.analyze_url(request.url)
    from ai.prompts import build_system_prompt
    from ai.router import TaskComplexity
    messages = [
        {"role": "system", "content": build_system_prompt("research")},
        {"role": "user", "content": f"Please analyze the following URL and its content thoroughly. Provide a comprehensive breakdown of what this page is about, who it's for, key claims and data points, strategic significance, and what action I should take based on this information.\n\nURL: {request.url}\n\nContent:\n{content[:8000]}"}
    ]
    analysis, _ = await ai_router.complete(
        messages,
        complexity=TaskComplexity.SMART,
        user_api_keys=current_user.api_keys or {},
    )
    # Store URL analysis insight in user's memory for future reference
    asyncio.create_task(_store_url_insight(current_user.id, request.url, analysis))
    return {"url": request.url, "analysis": analysis}


async def _store_url_insight(user_id: str, url: str, analysis: str):
    """Persist URL analysis as a knowledge memory item (own DB session)."""
    try:
        from database import AsyncSessionLocal
        from models import MemoryType
        snippet = analysis[:500]
        async with AsyncSessionLocal() as db:
            await memory_manager.add(
                db, user_id,
                content=f"[URL Analysis] {url}\n\nKey insights: {snippet}",
                memory_type=MemoryType.KNOWLEDGE,
                tags=["url", "research", "web"],
                importance=0.7,
            )
    except Exception:
        pass


@app.post("/api/analyze-image")
async def analyze_image(
    file: UploadFile = File(...),
    prompt: str = Form(default="Analyze this image in detail. Describe what you see, extract any text or data, and provide business-relevant insights."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyze an uploaded image using Claude Vision."""
    import base64
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(400, "Image too large. Max 20MB.")

    mime_map = {
        "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "png": "image/png", "gif": "image/gif",
        "webp": "image/webp",
    }
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpeg"
    mime_type = mime_map.get(ext, "image/jpeg")

    image_b64 = base64.standard_b64encode(content).decode()

    from ai.prompts import build_system_prompt
    full_prompt = f"{build_system_prompt('vision')}\n\n{prompt}"
    analysis = await ai_router.vision_complete(
        image_data=image_b64,
        mime_type=mime_type,
        prompt=full_prompt,
        user_api_keys=current_user.api_keys or {},
    )

    # Store image analysis in user memory
    asyncio.create_task(_store_url_insight(
        current_user.id,
        f"[Image: {file.filename}]",
        analysis,
    ))

    return {"filename": file.filename, "analysis": analysis}


# ── Conversation history endpoints ─────────────────────────────────────────────

@app.get("/api/conversations")
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
        .limit(50)
    )
    convs = result.scalars().all()
    return [{"id": c.id, "title": c.title, "summary": c.summary, "updated_at": c.updated_at.isoformat()} for c in convs]


@app.get("/api/conversations/{conv_id}")
async def get_conversation(
    conv_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id, Conversation.user_id == current_user.id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    return {"id": conv.id, "title": conv.title, "messages": conv.messages, "summary": conv.summary}


# ── Provider status ────────────────────────────────────────────────────────────

@app.get("/api/providers")
async def list_providers():
    providers = await ai_router.available_providers()
    return {
        "providers": providers,
        "preferred": settings.PREFERRED_PROVIDER,
        "models": {
            "fast": settings.FAST_MODEL,
            "smart": settings.SMART_MODEL,
            "deep": settings.DEEP_MODEL,
        }
    }


# ── Auth endpoints ─────────────────────────────────────────────────────────────

@app.post("/api/auth/register", response_model=AuthResponse)
async def register(request: AuthRequest, db: AsyncSession = Depends(get_db)):
    email = request.effective_email()
    if not email:
        raise HTTPException(400, "Email is required")

    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")

    user = User(
        id=str(uuid.uuid4()),
        username=email,
        email=email,
        name=request.name or email.split("@")[0],
        hashed_password=_hash_password(request.password),
    )
    db.add(user)
    await db.commit()

    token = _create_token(user.id)
    return AuthResponse(
        access_token=token,
        user_id=user.id,
        name=user.name,
        email=user.email,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@app.post("/api/auth/login", response_model=AuthResponse)
async def login(request: AuthRequest, db: AsyncSession = Depends(get_db)):
    email = request.effective_email()
    if not email:
        raise HTTPException(400, "Email is required")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not _verify_password(request.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")

    token = _create_token(user.id)
    return AuthResponse(
        access_token=token,
        user_id=user.id,
        name=user.name,
        email=user.email,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@app.get("/api/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "user_id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "preferred_provider": current_user.preferred_provider,
    }


@app.post("/api/auth/google")
async def google_auth(payload: dict, db: AsyncSession = Depends(get_db)):
    """Google OAuth callback — accepts id_token from frontend."""
    id_token = payload.get("id_token")
    if not id_token:
        raise HTTPException(400, "id_token required")

    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        info = google_id_token.verify_oauth2_token(id_token, google_requests.Request())
        email = info["email"]
        name = info.get("name", email.split("@")[0])
    except Exception:
        raise HTTPException(401, "Invalid Google token")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        user = User(
            id=str(uuid.uuid4()),
            username=email,
            email=email,
            name=name,
            hashed_password=_hash_password(str(uuid.uuid4())),
        )
        db.add(user)
        await db.commit()

    token = _create_token(user.id)
    return AuthResponse(
        access_token=token,
        user_id=user.id,
        name=user.name,
        email=user.email,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ── User API key management ────────────────────────────────────────────────────

@app.get("/api/user/keys")
async def get_user_keys(current_user: User = Depends(get_current_user)):
    keys = current_user.api_keys or {}
    # Mask all but first/last 4 chars
    masked = {}
    for provider, key in keys.items():
        if key and len(key) > 8:
            masked[provider] = key[:4] + "****" + key[-4:]
        else:
            masked[provider] = "****" if key else ""
    return {"keys": masked, "preferred_provider": current_user.preferred_provider}


@app.put("/api/user/keys")
async def save_user_keys(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    keys = payload.get("keys", {})
    preferred_provider = payload.get("preferred_provider")

    # Only update non-empty/non-masked values
    existing = current_user.api_keys or {}
    for provider in ["anthropic", "openai", "gemini"]:
        val = keys.get(provider, "")
        if val and "****" not in val:
            existing[provider] = val
        elif not val:
            existing.pop(provider, None)

    current_user.api_keys = existing
    if preferred_provider:
        current_user.preferred_provider = preferred_provider
    await db.commit()
    return {"status": "saved"}


# ── Health & info ──────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "operational",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _save_conversation(
    db: AsyncSession,
    user_id: str,
    conv_id: str,
    messages: list[dict],
    model: str,
) -> None:
    from sqlalchemy import select
    result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
    conv = result.scalar_one_or_none()

    title = messages[0]["content"][:80] if messages else "New conversation"

    if conv:
        conv.messages = messages
        conv.model_used = model
        from datetime import datetime as dt
        conv.updated_at = dt.utcnow()
    else:
        conv = Conversation(
            id=conv_id,
            user_id=user_id,
            title=title,
            messages=messages,
            model_used=model,
        )
        db.add(conv)
    await db.commit()
