"""
Agent Orchestrator — routes tasks to the right specialized agent,
executes tools in parallel, and coordinates multi-agent workflows.
"""
import asyncio
import re
from typing import Optional, Any

from models import AgentType, TaskComplexity
from ai.router import AIRouter, _detect_complexity
from ai.prompts import build_system_prompt
from config import settings


# Task routing keywords → agent
AGENT_ROUTING: dict[AgentType, list[str]] = {
    AgentType.EXECUTIVE: [
        "schedule", "calendar", "meeting", "email", "draft", "remind",
        "task", "todo", "action item", "follow up", "agenda", "notes",
    ],
    AgentType.RESEARCH: [
        "research", "analyze", "market", "competitive", "competitor", "trend",
        "data", "report", "study", "find", "investigate", "compare",
    ],
    AgentType.CONTENT: [
        "write", "post", "linkedin", "twitter", "newsletter", "caption",
        "content", "blog", "article", "hook", "thread", "copy",
    ],
    AgentType.CRM: [
        "contact", "relationship", "follow up", "investor", "partner",
        "network", "introduction", "outreach", "connection", "pitch",
    ],
    AgentType.INVESTOR: [
        "pitch deck", "fundraising", "valuation", "term sheet", "vc",
        "investor", "raise", "funding", "due diligence", "equity", "cap table",
    ],
    AgentType.COMMUNITY: [
        "community", "whatsapp group", "telegram", "member", "engage",
        "onboard", "retention", "event", "cohort", "forum",
    ],
    AgentType.OPERATIONS: [
        "process", "workflow", "sop", "okr", "kpi", "metric", "report",
        "optimize", "bottleneck", "team", "hiring", "budget", "finance",
    ],
}


def _route_to_agent(query: str, explicit_agent: Optional[AgentType] = None) -> AgentType:
    if explicit_agent:
        return explicit_agent

    lower = query.lower()
    scores: dict[AgentType, int] = {agent: 0 for agent in AgentType}

    for agent, keywords in AGENT_ROUTING.items():
        for kw in keywords:
            if kw in lower:
                scores[agent] += 1

    best = max(scores, key=lambda a: scores[a])
    return best if scores[best] > 0 else AgentType.EXECUTIVE


class Tool:
    """Base class for agent tools."""
    name: str
    description: str

    async def run(self, **kwargs) -> str:
        raise NotImplementedError


class WebSearchTool(Tool):
    name = "web_search"
    description = "Search the web for current information"

    async def run(self, query: str, max_results: int = 5) -> str:
        from search.engine import search_engine
        results = await search_engine.web_search(query, max_results)
        if not results:
            return "No search results found."
        return "\n\n".join([
            f"**{r['title']}**\n{r['content']}\nSource: {r.get('url', 'N/A')}"
            for r in results
        ])


class MemorySearchTool(Tool):
    name = "search_memory"
    description = "Search the user's memory and knowledge base"

    async def run(self, query: str, user_id: str, db) -> str:
        from memory.manager import memory_manager
        context, ids = await memory_manager.get_context(db, user_id, query)
        return context or "No relevant memories found."


class DocumentSearchTool(Tool):
    name = "search_documents"
    description = "Search through the user's uploaded documents"

    async def run(self, query: str, user_id: str, db) -> str:
        from processors.document import document_processor
        results = await document_processor.search_documents(db, user_id, query)
        return results or "No relevant document content found."


class AgentOrchestrator:
    def __init__(self, ai_router: AIRouter):
        self.ai = ai_router
        self.tools = {
            "web_search": WebSearchTool(),
            "search_memory": MemorySearchTool(),
            "search_documents": DocumentSearchTool(),
        }

    async def _run_tool(self, tool_name: str, **kwargs) -> str:
        tool = self.tools.get(tool_name)
        if not tool:
            return f"Tool '{tool_name}' not found."
        try:
            return await tool.run(**kwargs)
        except Exception as e:
            return f"Tool error: {str(e)}"

    async def _gather_context(
        self,
        query: str,
        user_id: str,
        db,
        enabled_tools: list[str],
    ) -> dict[str, str]:
        """Run tools in parallel to gather context."""
        tasks = []
        tool_names = []

        if "search_memory" in enabled_tools:
            tasks.append(self._run_tool("search_memory", query=query, user_id=user_id, db=db))
            tool_names.append("search_memory")

        if "search_documents" in enabled_tools:
            tasks.append(self._run_tool("search_documents", query=query, user_id=user_id, db=db))
            tool_names.append("search_documents")

        results = await asyncio.gather(*tasks, return_exceptions=True)

        context = {}
        for name, result in zip(tool_names, results):
            if isinstance(result, str):
                context[name] = result

        return context

    async def execute(
        self,
        query: str,
        user_id: str,
        db,
        conversation_history: list[dict],
        agent_type: Optional[AgentType] = None,
        tools: list[str] = None,
        stream: bool = False,
    ) -> dict[str, Any]:
        """Main execution entry point."""
        if tools is None:
            tools = ["search_memory"]

        # Route to appropriate agent
        selected_agent = _route_to_agent(query, agent_type)

        # Gather context in parallel
        context = await self._gather_context(query, user_id, db, tools)

        # Web search for research queries
        if "web_search" in tools or selected_agent == AgentType.RESEARCH:
            web_results = await self._run_tool("web_search", query=query)
            if web_results:
                context["web_search"] = web_results

        # Build memory context string
        memory_ctx = context.get("search_memory", "")
        doc_ctx = context.get("search_documents", "")
        web_ctx = context.get("web_search", "")

        # Build user context
        from memory.manager import memory_manager
        user_ctx = await memory_manager.build_user_context(db, user_id)

        # Assemble full memory/research context
        full_memory_ctx = "\n".join(filter(None, [
            f"User Memory:\n{memory_ctx}" if memory_ctx else "",
            f"Document Context:\n{doc_ctx}" if doc_ctx else "",
            f"Web Research:\n{web_ctx}" if web_ctx else "",
        ]))

        # Build system prompt for selected agent
        system_prompt = build_system_prompt(
            agent_type=selected_agent.value,
            user_context=user_ctx,
            memory_context=full_memory_ctx,
        )

        # Assemble messages
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(conversation_history[-10:])  # last 10 turns
        messages.append({"role": "user", "content": query})

        # Determine complexity
        complexity = _detect_complexity(query)

        tools_used = [t for t, r in context.items() if r]

        if stream:
            return {
                "stream": self.ai.stream(messages, complexity=complexity),
                "agent": selected_agent.value,
                "tools_used": tools_used,
            }
        else:
            response, model = await self.ai.complete(messages, complexity=complexity)
            return {
                "response": response,
                "model": model,
                "agent": selected_agent.value,
                "tools_used": tools_used,
            }

    async def execute_workflow(
        self,
        steps: list[dict],
        user_id: str,
        db,
    ) -> list[dict]:
        """Execute a multi-step agent workflow."""
        results = []
        accumulated_context = ""

        for step in steps:
            step_query = step["query"]
            if accumulated_context:
                step_query = f"Context from previous steps:\n{accumulated_context}\n\nNew task: {step_query}"

            result = await self.execute(
                query=step_query,
                user_id=user_id,
                db=db,
                conversation_history=[],
                agent_type=AgentType(step.get("agent")) if step.get("agent") else None,
                tools=step.get("tools", ["search_memory"]),
            )

            results.append({
                "step": step.get("name", f"Step {len(results) + 1}"),
                "agent": result["agent"],
                "response": result.get("response", ""),
                "tools_used": result.get("tools_used", []),
            })

            accumulated_context += f"\n{step.get('name', 'Step')}: {result.get('response', '')[:500]}"

        return results


def create_orchestrator(ai_router: AIRouter) -> AgentOrchestrator:
    return AgentOrchestrator(ai_router)
