"""
Search Engine — unified interface for web search (Tavily, Serper, fallback DuckDuckGo)
and internal knowledge search.
"""
import httpx
import json
from typing import Optional

from config import settings


class SearchEngine:
    async def web_search(self, query: str, max_results: int = 5) -> list[dict]:
        """Search the web. Tries Tavily → Serper → DuckDuckGo."""
        if settings.TAVILY_API_KEY:
            return await self._tavily(query, max_results)
        if settings.SERPER_API_KEY:
            return await self._serper(query, max_results)
        return await self._duckduckgo(query, max_results)

    async def _tavily(self, query: str, max_results: int) -> list[dict]:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": settings.TAVILY_API_KEY,
                        "query": query,
                        "max_results": max_results,
                        "search_depth": "advanced",
                        "include_answer": True,
                    }
                )
                data = response.json()
                results = []
                if data.get("answer"):
                    results.append({"title": "AI Answer", "content": data["answer"], "url": ""})
                for r in data.get("results", [])[:max_results]:
                    results.append({
                        "title": r.get("title", ""),
                        "content": r.get("content", ""),
                        "url": r.get("url", ""),
                    })
                return results
        except Exception:
            return []

    async def _serper(self, query: str, max_results: int) -> list[dict]:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(
                    "https://google.serper.dev/search",
                    headers={"X-API-KEY": settings.SERPER_API_KEY, "Content-Type": "application/json"},
                    json={"q": query, "num": max_results}
                )
                data = response.json()
                results = []
                for r in data.get("organic", [])[:max_results]:
                    results.append({
                        "title": r.get("title", ""),
                        "content": r.get("snippet", ""),
                        "url": r.get("link", ""),
                    })
                return results
        except Exception:
            return []

    async def _duckduckgo(self, query: str, max_results: int) -> list[dict]:
        """Fallback: DuckDuckGo Instant Answer API (no key required, limited)."""
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                response = await client.get(
                    "https://api.duckduckgo.com/",
                    params={"q": query, "format": "json", "no_html": "1", "skip_disambig": "1"},
                    headers={"User-Agent": "FOS/1.0"}
                )
                data = response.json()
                results = []
                if data.get("AbstractText"):
                    results.append({
                        "title": data.get("Heading", "Answer"),
                        "content": data["AbstractText"],
                        "url": data.get("AbstractURL", ""),
                    })
                for topic in data.get("RelatedTopics", [])[:max_results - 1]:
                    if isinstance(topic, dict) and topic.get("Text"):
                        results.append({
                            "title": topic.get("Text", "")[:100],
                            "content": topic.get("Text", ""),
                            "url": topic.get("FirstURL", ""),
                        })
                return results[:max_results]
        except Exception:
            return []

    async def analyze_url(self, url: str) -> str:
        """Fetch and extract text content from a URL."""
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                headers = {"User-Agent": "Mozilla/5.0 (compatible; FOS/1.0)"}
                response = await client.get(url, headers=headers)
                response.raise_for_status()

                from bs4 import BeautifulSoup
                soup = BeautifulSoup(response.text, 'lxml')

                # Remove script/style
                for tag in soup(["script", "style", "nav", "footer", "header"]):
                    tag.decompose()

                text = soup.get_text(separator='\n', strip=True)
                # Collapse whitespace
                import re
                text = re.sub(r'\n{3,}', '\n\n', text)
                return text[:8000]
        except Exception as e:
            return f"Failed to fetch URL: {str(e)}"

    async def research_topic(self, topic: str, ai_router, depth: int = 3) -> str:
        """Multi-step deep research on a topic."""
        # Step 1: Get initial results
        initial_results = await self.web_search(topic, max_results=depth)
        if not initial_results:
            return f"No results found for: {topic}"

        # Step 2: Synthesize with AI
        context = "\n\n".join([
            f"Source: {r.get('url', 'N/A')}\nTitle: {r['title']}\n{r['content']}"
            for r in initial_results
        ])

        messages = [
            {
                "role": "system",
                "content": "You are a research analyst. Synthesize these search results into a comprehensive, structured research report. Include key findings, data points, and insights. Cite sources."
            },
            {
                "role": "user",
                "content": f"Research topic: {topic}\n\nSearch Results:\n{context}"
            }
        ]

        from ai.router import TaskComplexity
        synthesis, _ = await ai_router.complete(messages, complexity=TaskComplexity.DEEP)
        return synthesis


search_engine = SearchEngine()
