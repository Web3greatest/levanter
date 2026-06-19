from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Founder Operating System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-this-in-production"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./fos.db"

    # Redis (optional — falls back to in-memory)
    REDIS_URL: Optional[str] = None

    # AI Providers
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # Default model routing
    FAST_MODEL: str = "claude-haiku-4-5-20251001"      # fast tasks
    SMART_MODEL: str = "claude-sonnet-4-6"              # balanced
    DEEP_MODEL: str = "claude-opus-4-8"                 # complex reasoning
    VISION_MODEL: str = "claude-sonnet-4-6"             # image analysis
    LOCAL_MODEL: str = "llama3.2"                       # offline/local

    # Preferred provider: "anthropic" | "openai" | "gemini" | "ollama" | "auto"
    PREFERRED_PROVIDER: str = "auto"

    # Memory
    MAX_MEMORY_ITEMS: int = 1000
    MAX_CONTEXT_TOKENS: int = 8000
    MEMORY_SEARCH_TOP_K: int = 5

    # Documents
    MAX_FILE_SIZE_MB: int = 50
    UPLOAD_DIR: str = "./uploads"
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200

    # Voice
    ELEVENLABS_API_KEY: Optional[str] = None
    WHISPER_MODEL: str = "base"

    # Search
    TAVILY_API_KEY: Optional[str] = None
    SERPER_API_KEY: Optional[str] = None

    # Integrations
    GMAIL_CLIENT_ID: Optional[str] = None
    GMAIL_CLIENT_SECRET: Optional[str] = None
    NOTION_TOKEN: Optional[str] = None
    SLACK_BOT_TOKEN: Optional[str] = None

    # Auth
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
