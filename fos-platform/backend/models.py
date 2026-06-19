from pydantic import BaseModel, Field
from typing import Optional, Any, Literal
from datetime import datetime
from enum import Enum


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


class TaskComplexity(str, Enum):
    FAST = "fast"        # simple Q&A, formatting, classification
    SMART = "smart"      # balanced reasoning, writing, analysis
    DEEP = "deep"        # strategy, research, complex multi-step


class AgentType(str, Enum):
    EXECUTIVE = "executive"
    RESEARCH = "research"
    CONTENT = "content"
    CRM = "crm"
    OPERATIONS = "operations"
    INVESTOR = "investor"
    COMMUNITY = "community"


class MemoryType(str, Enum):
    USER = "user"
    PROJECT = "project"
    KNOWLEDGE = "knowledge"
    CONVERSATION = "conversation"


# ── Request / Response models ──────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: MessageRole
    content: str
    timestamp: Optional[datetime] = None
    metadata: dict[str, Any] = {}


class ChatRequest(BaseModel):
    message: str
    user_id: str = "default"
    session_id: Optional[str] = None
    conversation_id: Optional[str] = None
    agent: Optional[AgentType] = None
    complexity: Optional[TaskComplexity] = None
    stream: bool = True
    include_memory: bool = True
    files: list[str] = []  # uploaded file IDs
    tools: list[str] = []  # enabled tools


class ChatResponse(BaseModel):
    id: str
    content: str
    model: str
    agent: Optional[str] = None
    tokens_used: int = 0
    memory_used: list[str] = []
    tools_called: list[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MemoryItem(BaseModel):
    id: Optional[str] = None
    user_id: str
    memory_type: MemoryType
    content: str
    metadata: dict[str, Any] = {}
    tags: list[str] = []
    importance: float = 0.5  # 0-1 score
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class UserProfile(BaseModel):
    user_id: str
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    company: Optional[str] = None
    goals: list[str] = []
    interests: list[str] = []
    writing_style: Optional[str] = None
    preferences: dict[str, Any] = {}
    context: Optional[str] = None  # free-form context about the user


class DocumentInfo(BaseModel):
    id: str
    user_id: str
    filename: str
    file_type: str
    size_bytes: int
    page_count: Optional[int] = None
    summary: Optional[str] = None
    tags: list[str] = []
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)


class SearchRequest(BaseModel):
    query: str
    user_id: str = "default"
    sources: list[Literal["web", "memory", "documents"]] = ["web", "memory"]
    max_results: int = 5


class SearchResult(BaseModel):
    source: str
    title: str
    content: str
    url: Optional[str] = None
    relevance: float = 0.0


class AgentRequest(BaseModel):
    agent: AgentType
    task: str
    user_id: str = "default"
    context: dict[str, Any] = {}


class AgentResponse(BaseModel):
    agent: str
    result: str
    actions_taken: list[str] = []
    next_steps: list[str] = []
    metadata: dict[str, Any] = {}


class VoiceRequest(BaseModel):
    audio_base64: str
    user_id: str = "default"
    language: str = "en"


class VoiceResponse(BaseModel):
    transcript: str
    response_text: str
    audio_base64: Optional[str] = None


class AuthRequest(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    expires_in: int
