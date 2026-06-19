"""
AI Router — Unified interface across Anthropic, OpenAI, Gemini, and Ollama.
Automatically selects the best model based on task type and available providers.
"""
import asyncio
import json
from typing import AsyncIterator, Optional, Any
from tenacity import retry, stop_after_attempt, wait_exponential

from config import settings
from models import TaskComplexity, ChatMessage, MessageRole


# Task classification keywords → complexity routing
FAST_KEYWORDS = {
    "summarize briefly", "list", "format", "convert", "translate", "spell check",
    "simple", "quick", "short", "yes or no", "what is", "define", "classify"
}
DEEP_KEYWORDS = {
    "strategy", "analyze in depth", "business plan", "investment thesis", "research report",
    "detailed analysis", "comprehensive", "multi-step", "evaluate all options", "first principles"
}


def _detect_complexity(text: str) -> TaskComplexity:
    lower = text.lower()
    if any(kw in lower for kw in DEEP_KEYWORDS) or len(text) > 500:
        return TaskComplexity.DEEP
    if any(kw in lower for kw in FAST_KEYWORDS) or len(text) < 100:
        return TaskComplexity.FAST
    return TaskComplexity.SMART


def _select_model(complexity: TaskComplexity, provider: str) -> tuple[str, str]:
    """Returns (provider, model_id)"""
    if provider == "anthropic" or (provider == "auto" and settings.ANTHROPIC_API_KEY):
        return "anthropic", {
            TaskComplexity.FAST: settings.FAST_MODEL,
            TaskComplexity.SMART: settings.SMART_MODEL,
            TaskComplexity.DEEP: settings.DEEP_MODEL,
        }[complexity]

    if provider == "openai" or (provider == "auto" and settings.OPENAI_API_KEY):
        return "openai", {
            TaskComplexity.FAST: "gpt-4o-mini",
            TaskComplexity.SMART: "gpt-4o",
            TaskComplexity.DEEP: "gpt-4o",
        }[complexity]

    if provider == "gemini" or (provider == "auto" and settings.GEMINI_API_KEY):
        return "gemini", {
            TaskComplexity.FAST: "gemini-2.0-flash-exp",
            TaskComplexity.SMART: "gemini-2.0-flash-exp",
            TaskComplexity.DEEP: "gemini-2.5-pro-exp-03-25",
        }[complexity]

    # Fallback to local Ollama
    return "ollama", settings.LOCAL_MODEL


class AIRouter:
    def __init__(self):
        self._anthropic = None
        self._openai = None
        self._gemini = None

    def _get_anthropic(self):
        if not self._anthropic and settings.ANTHROPIC_API_KEY:
            import anthropic
            self._anthropic = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        return self._anthropic

    def _get_openai(self):
        if not self._openai and settings.OPENAI_API_KEY:
            from openai import AsyncOpenAI
            self._openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._openai

    def _get_gemini(self):
        if not self._gemini and settings.GEMINI_API_KEY:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self._gemini = genai
        return self._gemini

    def _format_messages(self, messages: list[dict]) -> list[dict]:
        """Normalize messages to {role, content} format."""
        return [
            {"role": m["role"] if m["role"] != "system" else "user", "content": m["content"]}
            for m in messages if m["role"] != "system"
        ]

    def _extract_system(self, messages: list[dict]) -> Optional[str]:
        for m in messages:
            if m["role"] == "system":
                return m["content"]
        return None

    # ── Anthropic ──────────────────────────────────────────────────────────────

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
    async def _call_anthropic(self, messages: list[dict], model: str, max_tokens: int = 4096) -> str:
        client = self._get_anthropic()
        if not client:
            raise ValueError("Anthropic API key not configured")

        system = self._extract_system(messages)
        conversation = [m for m in messages if m["role"] != "system"]

        response = await client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system or "You are an expert AI assistant.",
            messages=conversation,
        )
        return response.content[0].text

    async def _stream_anthropic(self, messages: list[dict], model: str, max_tokens: int = 4096) -> AsyncIterator[str]:
        client = self._get_anthropic()
        if not client:
            raise ValueError("Anthropic API key not configured")

        system = self._extract_system(messages)
        conversation = [m for m in messages if m["role"] != "system"]

        async with client.messages.stream(
            model=model,
            max_tokens=max_tokens,
            system=system or "You are an expert AI assistant.",
            messages=conversation,
        ) as stream:
            async for text in stream.text_stream:
                yield text

    # ── OpenAI ─────────────────────────────────────────────────────────────────

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
    async def _call_openai(self, messages: list[dict], model: str, max_tokens: int = 4096) -> str:
        client = self._get_openai()
        if not client:
            raise ValueError("OpenAI API key not configured")

        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content

    async def _stream_openai(self, messages: list[dict], model: str, max_tokens: int = 4096) -> AsyncIterator[str]:
        client = self._get_openai()
        if not client:
            raise ValueError("OpenAI API key not configured")

        stream = await client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    # ── Gemini ─────────────────────────────────────────────────────────────────

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
    async def _call_gemini(self, messages: list[dict], model: str) -> str:
        genai = self._get_gemini()
        if not genai:
            raise ValueError("Gemini API key not configured")

        gen_model = genai.GenerativeModel(model)
        history = []
        last_msg = ""
        for m in messages:
            if m["role"] == "system":
                continue
            if m["role"] == "user":
                last_msg = m["content"]
            else:
                history.append({"role": "user", "parts": [last_msg]})
                history.append({"role": "model", "parts": [m["content"]]})

        chat = gen_model.start_chat(history=history[:-2] if len(history) > 2 else [])
        response = await asyncio.get_event_loop().run_in_executor(
            None, lambda: chat.send_message(last_msg)
        )
        return response.text

    # ── Ollama (local) ─────────────────────────────────────────────────────────

    @retry(stop=stop_after_attempt(2), wait=wait_exponential(min=1, max=4))
    async def _call_ollama(self, messages: list[dict], model: str) -> str:
        import httpx
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/chat",
                json={"model": model, "messages": messages, "stream": False},
            )
            response.raise_for_status()
            return response.json()["message"]["content"]

    async def _stream_ollama(self, messages: list[dict], model: str) -> AsyncIterator[str]:
        import httpx
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{settings.OLLAMA_BASE_URL}/api/chat",
                json={"model": model, "messages": messages, "stream": True},
            ) as response:
                async for line in response.aiter_lines():
                    if line:
                        data = json.loads(line)
                        if content := data.get("message", {}).get("content", ""):
                            yield content

    # ── Public API ─────────────────────────────────────────────────────────────

    async def complete(
        self,
        messages: list[dict],
        task_hint: str = "",
        complexity: Optional[TaskComplexity] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: int = 4096,
    ) -> tuple[str, str]:
        """Complete a conversation. Returns (response_text, model_used)."""
        if complexity is None:
            complexity = _detect_complexity(task_hint or (messages[-1]["content"] if messages else ""))

        selected_provider, selected_model = _select_model(
            complexity, provider or settings.PREFERRED_PROVIDER
        )
        if model:
            selected_model = model

        if selected_provider == "anthropic":
            text = await self._call_anthropic(messages, selected_model, max_tokens)
        elif selected_provider == "openai":
            text = await self._call_openai(messages, selected_model, max_tokens)
        elif selected_provider == "gemini":
            text = await self._call_gemini(messages, selected_model)
        else:
            text = await self._call_ollama(messages, selected_model)

        return text, f"{selected_provider}/{selected_model}"

    async def stream(
        self,
        messages: list[dict],
        task_hint: str = "",
        complexity: Optional[TaskComplexity] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: int = 4096,
    ) -> AsyncIterator[str]:
        """Stream a completion."""
        if complexity is None:
            complexity = _detect_complexity(task_hint or (messages[-1]["content"] if messages else ""))

        selected_provider, selected_model = _select_model(
            complexity, provider or settings.PREFERRED_PROVIDER
        )
        if model:
            selected_model = model

        if selected_provider == "anthropic":
            async for chunk in self._stream_anthropic(messages, selected_model, max_tokens):
                yield chunk
        elif selected_provider == "openai":
            async for chunk in self._stream_openai(messages, selected_model, max_tokens):
                yield chunk
        elif selected_provider == "ollama":
            async for chunk in self._stream_ollama(messages, selected_model):
                yield chunk
        else:
            # Gemini doesn't stream easily — fall back to non-streaming
            text = await self._call_gemini(messages, selected_model)
            yield text

    async def available_providers(self) -> dict[str, bool]:
        """Return which providers are configured."""
        return {
            "anthropic": bool(settings.ANTHROPIC_API_KEY),
            "openai": bool(settings.OPENAI_API_KEY),
            "gemini": bool(settings.GEMINI_API_KEY),
            "ollama": True,  # always try
        }


# Singleton
ai_router = AIRouter()
