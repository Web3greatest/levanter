"""
FOS Platform — FastAPI Backend
Unified AI assistant API with memory, agents, documents, voice, and search.
"""
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
    AuthRequest, AuthResponse, VoiceRequest, DocumentInfo
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
    allow_origins=settings.ALLOWED_ORIGINS + ["*"] if settings.DEBUG else settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

orchestrator = create_orchestrator(ai_router)
security = HTTPBearer(auto_error=False)

# In-memory session store (use Redis in production)
active_sessions: dict[str, list[dict]] = {}


# ── Auth helpers ───────────────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    from passlib.context import CryptContext
    ctx = CryptContext(schemes=["bcrypt"])
    return ctx.hash(password)


def _verify_password(plain: str, hashed: str) -> bool:
    from passlib.context import CryptContext
    ctx = CryptContext(schemes=["bcrypt"])
    return ctx.verify(plain, hashed)


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


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> str:
    """Returns user_id. For demo, returns 'default' if no auth."""
    if not credentials:
        return "default"
    user_id = _decode_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_id


# ── Core chat endpoints ────────────────────────────────────────────────────────

@app.post("/api/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """Main chat endpoint (non-streaming)."""
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
    )

    # Update session history
    history.append({"role": "user", "content": request.message})
    history.append({"role": "assistant", "content": result["response"]})
    active_sessions[session_id] = history[-40:]  # keep last 20 turns

    # Persist conversation to DB
    conv_id = request.conversation_id or str(uuid.uuid4())
    await _save_conversation(db, user_id, conv_id, history, result.get("model", "unknown"))

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
    user_id: str = Depends(get_current_user),
):
    """Streaming chat endpoint — returns Server-Sent Events."""
    session_id = request.session_id or str(uuid.uuid4())
    history = active_sessions.get(session_id, [])

    result = await orchestrator.execute(
        query=request.message,
        user_id=user_id,
        db=db,
        conversation_history=history,
        agent_type=request.agent,
        tools=["search_memory"],
        stream=True,
    )

    async def event_stream():
        full_response = ""
        yield f"data: {json.dumps({'type': 'agent', 'agent': result['agent']})}\n\n"
        yield f"data: {json.dumps({'type': 'tools', 'tools': result['tools_used']})}\n\n"

        async for chunk in result["stream"]:
            full_response += chunk
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

        # Save after stream completes
        history.append({"role": "user", "content": request.message})
        history.append({"role": "assistant", "content": full_response})
        active_sessions[session_id] = history[-40:]
        conv_id = request.conversation_id or str(uuid.uuid4())
        await _save_conversation(db, user_id, conv_id, history, "streaming")

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
    user_id = "default"

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "message")

            if msg_type == "auth":
                user_id = _decode_token(data.get("token", "")) or "default"
                await websocket.send_json({"type": "auth_ok", "user_id": user_id})
                continue

            if msg_type == "message":
                query = data.get("content", "")
                agent = AgentType(data["agent"]) if data.get("agent") else None

                await websocket.send_json({"type": "thinking"})

                result = await orchestrator.execute(
                    query=query,
                    user_id=user_id,
                    db=db,
                    conversation_history=history,
                    agent_type=agent,
                    tools=["search_memory"],
                    stream=True,
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
    user_id: str = Depends(get_current_user),
):
    mtype = MemoryType(memory_type) if memory_type else None
    memories = await memory_manager.get_all(db, user_id, mtype)
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
    user_id: str = Depends(get_current_user),
):
    mem = await memory_manager.add(
        db, user_id, item.content, item.memory_type,
        item.metadata, item.tags, item.importance
    )
    return {"id": mem.id, "status": "created"}


@app.delete("/api/memory/{memory_id}")
async def delete_memory(
    memory_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    await memory_manager.delete_memory(db, memory_id, user_id)
    return {"status": "deleted"}


@app.get("/api/memory/search")
async def search_memory(
    q: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    results = await memory_manager.search(db, user_id, q)
    return [
        {"id": m.id, "content": m.content, "score": round(score, 3), "type": m.memory_type}
        for m, score in results
    ]


@app.get("/api/profile")
async def get_profile(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    profile = await memory_manager.get_profile(db, user_id)
    return profile or {"user_id": user_id}


@app.put("/api/profile")
async def update_profile(
    updates: dict,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    await memory_manager.update_profile(db, user_id, updates)
    return {"status": "updated"}


# ── Document endpoints ─────────────────────────────────────────────────────────

@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    if file.size and file.size > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File too large. Max {settings.MAX_FILE_SIZE_MB}MB.")

    content = await file.read()
    doc = await document_processor.save_document(db, user_id, file.filename, content, ai_router)

    return {
        "id": doc.id,
        "filename": doc.filename,
        "type": doc.file_type,
        "size": doc.size_bytes,
        "summary": doc.summary,
        "pages": doc.page_count,
    }


@app.get("/api/documents")
async def list_documents(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    docs = await document_processor.list_documents(db, user_id)
    return [{"id": d.id, "filename": d.filename, "type": d.file_type, "summary": d.summary, "uploaded_at": d.uploaded_at.isoformat()} for d in docs]


@app.post("/api/documents/{doc_id}/ask")
async def ask_document(
    doc_id: str,
    question: str = Form(...),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    answer = await document_processor.answer_from_document(db, doc_id, user_id, question, ai_router)
    return {"answer": answer}


# ── Agent endpoints ────────────────────────────────────────────────────────────

@app.post("/api/agents/run", response_model=AgentResponse)
async def run_agent(
    request: AgentRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    result = await orchestrator.execute(
        query=request.task,
        user_id=user_id,
        db=db,
        conversation_history=[],
        agent_type=request.agent,
        tools=["search_memory", "web_search"],
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
    user_id: str = Depends(get_current_user),
):
    results = await orchestrator.execute_workflow(steps, user_id, db)
    return {"steps": results}


# ── Search endpoints ───────────────────────────────────────────────────────────

@app.post("/api/search")
async def search(
    request: SearchRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    results = []

    if "web" in request.sources:
        web = await search_engine.web_search(request.query, request.max_results)
        results.extend([{"source": "web", **r} for r in web])

    if "memory" in request.sources:
        memory_results = await memory_manager.search(db, user_id, request.query, request.max_results)
        results.extend([
            {"source": "memory", "title": m.memory_type, "content": m.content, "relevance": round(s, 3)}
            for m, s in memory_results
        ])

    if "documents" in request.sources:
        doc_text = await document_processor.search_documents(db, user_id, request.query)
        if doc_text:
            results.append({"source": "documents", "title": "Document Match", "content": doc_text})

    return {"query": request.query, "results": results}


@app.post("/api/research")
async def deep_research(
    topic: str = Form(...),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    report = await search_engine.research_topic(topic, ai_router)
    return {"topic": topic, "report": report}


@app.post("/api/analyze-url")
async def analyze_url(
    url: str = Form(...),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    content = await search_engine.analyze_url(url)
    messages = [
        {"role": "system", "content": "Analyze this webpage content and provide key insights, main points, and a summary."},
        {"role": "user", "content": f"URL: {url}\n\nContent:\n{content}"}
    ]
    from ai.router import TaskComplexity
    analysis, _ = await ai_router.complete(messages, complexity=TaskComplexity.SMART)
    return {"url": url, "analysis": analysis}


# ── Conversation history endpoints ─────────────────────────────────────────────

@app.get("/api/conversations")
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
        .limit(50)
    )
    convs = result.scalars().all()
    return [{"id": c.id, "title": c.title, "summary": c.summary, "updated_at": c.updated_at.isoformat()} for c in convs]


@app.get("/api/conversations/{conv_id}")
async def get_conversation(
    conv_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id, Conversation.user_id == user_id)
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
    # Check if username exists
    result = await db.execute(select(User).where(User.username == request.username))
    if result.scalar_one_or_none():
        raise HTTPException(400, "Username already exists")

    user = User(
        id=str(uuid.uuid4()),
        username=request.username,
        hashed_password=_hash_password(request.password),
    )
    db.add(user)
    await db.commit()

    token = _create_token(user.id)
    return AuthResponse(
        access_token=token,
        user_id=user.id,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@app.post("/api/auth/login", response_model=AuthResponse)
async def login(request: AuthRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == request.username))
    user = result.scalar_one_or_none()
    if not user or not _verify_password(request.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")

    token = _create_token(user.id)
    return AuthResponse(
        access_token=token,
        user_id=user.id,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


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
