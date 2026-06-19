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

    @staticmethod
    def _valid_user_key(key: Optional[str], prefix: str) -> Optional[str]:
        """Return the key only if it looks like a real key (not masked/placeholder)."""
        if key and len(key) > 20 and "****" not in key and key.startswith(prefix):
            return key
        return None

    def _get_anthropic(self, api_key: Optional[str] = None):
        user_key = self._valid_user_key(api_key, "sk-ant-")
        key = user_key or settings.ANTHROPIC_API_KEY
        if not key:
            return None
        if user_key:
            import anthropic
            return anthropic.AsyncAnthropic(api_key=key)
        if not self._anthropic:
            import anthropic
            self._anthropic = anthropic.AsyncAnthropic(api_key=key)
        return self._anthropic

    def _get_openai(self, api_key: Optional[str] = None):
        user_key = self._valid_user_key(api_key, "sk-")
        key = user_key or settings.OPENAI_API_KEY
        if not key:
            return None
        if user_key:
            from openai import AsyncOpenAI
            return AsyncOpenAI(api_key=key)
        if not self._openai:
            from openai import AsyncOpenAI
            self._openai = AsyncOpenAI(api_key=key)
        return self._openai

    def _get_gemini(self, api_key: Optional[str] = None):
        key = api_key or settings.GEMINI_API_KEY
        if not key:
            return None
        import google.generativeai as genai
        genai.configure(api_key=key)
        if not api_key:
            self._gemini = genai
        return genai

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
    async def _call_anthropic(self, messages: list[dict], model: str, max_tokens: int = 8192, api_key: Optional[str] = None) -> str:
        client = self._get_anthropic(api_key)
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

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
    async def _call_anthropic_vision(self, image_data: str, mime_type: str, prompt: str, model: str = None, api_key: Optional[str] = None) -> str:
        """Analyze an image using Claude's vision capability."""
        client = self._get_anthropic(api_key)
        if not client:
            raise ValueError("Anthropic API key not configured")
        vision_model = model or settings.VISION_MODEL
        response = await client.messages.create(
            model=vision_model,
            max_tokens=8192,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": mime_type, "data": image_data}},
                    {"type": "text", "text": prompt},
                ],
            }],
        )
        return response.content[0].text

    async def _stream_anthropic(self, messages: list[dict], model: str, max_tokens: int = 8192, api_key: Optional[str] = None) -> AsyncIterator[str]:
        client = self._get_anthropic(api_key)
        if not client:
            raise ValueError("Anthropic API key not configured")

        system = self._extract_system(messages)
        conversation = [m for m in messages if m["role"] != "system"]

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
    async def _call_openai(self, messages: list[dict], model: str, max_tokens: int = 4096, api_key: Optional[str] = None) -> str:
        client = self._get_openai(api_key)
        if not client:
            raise ValueError("OpenAI API key not configured")

        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content

    async def _stream_openai(self, messages: list[dict], model: str, max_tokens: int = 4096, api_key: Optional[str] = None) -> AsyncIterator[str]:
        client = self._get_openai(api_key)
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
        max_tokens: int = 8192,
        user_api_keys: Optional[dict] = None,
    ) -> tuple[str, str]:
        """Complete a conversation. Returns (response_text, model_used)."""
        if complexity is None:
            complexity = _detect_complexity(task_hint or (messages[-1]["content"] if messages else ""))

        selected_provider, selected_model = _select_model(
            complexity, provider or settings.PREFERRED_PROVIDER
        )
        if model:
            selected_model = model

        # Use user's own key if provided, otherwise fall back to system key
        keys = user_api_keys or {}

        if selected_provider == "anthropic":
            text = await self._call_anthropic(messages, selected_model, max_tokens, keys.get("anthropic"))
        elif selected_provider == "openai":
            text = await self._call_openai(messages, selected_model, max_tokens, keys.get("openai"))
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
        user_api_keys: Optional[dict] = None,
    ) -> AsyncIterator[str]:
        """Stream a completion."""
        if complexity is None:
            complexity = _detect_complexity(task_hint or (messages[-1]["content"] if messages else ""))

        selected_provider, selected_model = _select_model(
            complexity, provider or settings.PREFERRED_PROVIDER
        )
        if model:
            selected_model = model

        keys = user_api_keys or {}

        if selected_provider == "anthropic":
            async for chunk in self._stream_anthropic(messages, selected_model, max_tokens, keys.get("anthropic")):
                yield chunk
        elif selected_provider == "openai":
            async for chunk in self._stream_openai(messages, selected_model, max_tokens, keys.get("openai")):
                yield chunk
        elif selected_provider == "ollama":
            async for chunk in self._stream_ollama(messages, selected_model):
                yield chunk
        else:
            text = await self._call_gemini(messages, selected_model)
            yield text

    async def vision_complete(
        self,
        image_data: str,
        mime_type: str,
        prompt: str,
        user_api_keys: Optional[dict] = None,
    ) -> str:
        """Analyze an image with Claude Vision. Returns description/analysis."""
        keys = user_api_keys or {}
        return await self._call_anthropic_vision(
            image_data, mime_type, prompt, api_key=keys.get("anthropic")
        )

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
