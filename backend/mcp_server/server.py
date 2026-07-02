"""
MemOps MCP Server — 6 tools mapping to Cognee's 4 lifecycle verbs.

Tools:
  get_trusted_context  → recall (filtered by trust)
  audit_context        → recall + per-memory verdicts
  remember             → remember (store a fact)
  forget_memory        → forget (delete a memory)
  improve_rules        → improve (distill rules from sessions)
  list_incident_rules  → recall (retrieve distilled rules)
"""

import os
import re
import logging
from typing import Optional

import cognee
from cognee.api.v1.search import SearchType

logger = logging.getLogger("memops.mcp")

DATASET = os.environ.get("MEMOPS_DATASET", "incidents")
SECRET_PATTERNS = [
    re.compile(r"(?:api[_-]?key|secret|password|token|credential)\s*[=:]\s*\S+", re.I),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"-----BEGIN (?:RSA |EC )?PRIVATE KEY-----"),
    re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}"),
]


def _redact_secrets(text: str) -> str:
    redacted = text
    for pat in SECRET_PATTERNS:
        redacted = pat.sub("[REDACTED]", redacted)
    return redacted


def _compute_trust_score(result: dict) -> float:
    score = 0.5
    if result.get("has_evidence"):
        score += 0.2
    if result.get("reinforced"):
        score += 0.15
    age_days = result.get("age_days", 0)
    if age_days < 30:
        score += 0.15
    elif age_days < 90:
        score += 0.05
    elif age_days > 180:
        score -= 0.1
    return min(max(score, 0.0), 1.0)


def _classify_block_reason(result: dict) -> Optional[str]:
    trust = _compute_trust_score(result)
    if trust < 0.3:
        return "low_trust"
    text = result.get("text", "")
    for pat in SECRET_PATTERNS:
        if pat.search(text):
            return "contains_secret"
    if result.get("superseded"):
        return "stale"
    if result.get("contradicted"):
        return "contradicted"
    return None


async def _ensure_cognee():
    service_url = os.environ.get("COGNEE_SERVICE_URL")
    api_key = os.environ.get("COGNEE_API_KEY")
    if service_url and api_key:
        try:
            await cognee.serve(url=service_url, api_key=api_key)
        except Exception:
            try:
                await cognee.run_migrations()
            except Exception:
                pass
    else:
        try:
            await cognee.run_migrations()
        except Exception:
            pass


def register_tools(mcp):
    """Register 6 MCP tools on a FastMCP server instance."""

    @mcp.tool()
    async def get_trusted_context(
        task: str,
        top_k: int = 10,
        trust_threshold: float = 0.4,
        session_id: Optional[str] = None,
    ) -> dict:
        """Recall memories filtered by trust score. Only memories that pass
        staleness, contradiction, secret, and evidence checks are returned
        in the trusted pack. The full unfiltered recall is also returned
        for comparison.

        Args:
            task: The SRE task or question to recall context for.
            top_k: Maximum number of results to return.
            trust_threshold: Minimum trust score (0.0-1.0) to include.
            session_id: Optional session ID for conversation context.
        """
        await _ensure_cognee()

        results = await cognee.recall(
            query_text=task,
            query_type=SearchType.GRAPH_COMPLETION,
            datasets=[DATASET],
            top_k=top_k,
            session_id=session_id,
        )

        trusted_pack = []
        blocked = []
        for r in results:
            result_dict = r if isinstance(r, dict) else {"text": str(r)}
            block_reason = _classify_block_reason(result_dict)
            trust = _compute_trust_score(result_dict)
            entry = {
                "text": _redact_secrets(result_dict.get("text", str(r))),
                "trust_score": round(trust, 2),
                "blocked": block_reason is not None,
                "block_reason": block_reason,
            }
            if block_reason:
                blocked.append(entry)
            else:
                trusted_pack.append(entry)

        return {
            "trusted_pack": trusted_pack,
            "blocked": blocked,
            "total_recalled": len(results),
            "trusted_count": len(trusted_pack),
            "blocked_count": len(blocked),
        }

    @mcp.tool()
    async def audit_context(
        task: str,
        top_k: int = 15,
        session_id: Optional[str] = None,
    ) -> dict:
        """Recall memories and return per-memory audit verdicts. Each memory
        gets a verdict (approved/blocked), the failing check if any, and a
        trust score. Useful for understanding WHY certain memories are filtered.

        Args:
            task: The SRE task or question to audit context for.
            top_k: Maximum number of results to audit.
            session_id: Optional session ID for conversation context.
        """
        await _ensure_cognee()

        results = await cognee.recall(
            query_text=task,
            query_type=SearchType.GRAPH_COMPLETION,
            datasets=[DATASET],
            top_k=top_k,
            session_id=session_id,
        )

        verdicts = []
        for i, r in enumerate(results):
            result_dict = r if isinstance(r, dict) else {"text": str(r)}
            block_reason = _classify_block_reason(result_dict)
            trust = _compute_trust_score(result_dict)
            verdicts.append({
                "memory_id": f"mem_{i}",
                "text": _redact_secrets(result_dict.get("text", str(r))),
                "verdict": "blocked" if block_reason else "approved",
                "failing_check": block_reason,
                "trust_score": round(trust, 2),
                "checks": {
                    "staleness": "pass" if not result_dict.get("superseded") else "fail",
                    "contradiction": "pass" if not result_dict.get("contradicted") else "fail",
                    "secret": "pass" if not any(p.search(result_dict.get("text", "")) for p in SECRET_PATTERNS) else "fail",
                    "evidence": "pass" if trust >= 0.3 else "fail",
                },
            })

        approved = [v for v in verdicts if v["verdict"] == "approved"]
        blocked = [v for v in verdicts if v["verdict"] == "blocked"]

        return {
            "verdicts": verdicts,
            "summary": {
                "total": len(verdicts),
                "approved": len(approved),
                "blocked": len(blocked),
            },
        }

    @mcp.tool()
    async def remember(
        text: str,
        subject: str = "",
        kind: str = "fact",
        node_set: Optional[str] = None,
    ) -> dict:
        """Store a durable fact in the SRE knowledge graph. The memory is
        ingested through the custom pipeline (normalize, extract entities,
        validate ontology, build graph). It will be auditable on the next
        recall. Secrets are auto-redacted at ingest.

        Args:
            text: The fact or incident detail to remember.
            subject: Optional subject line for the memory.
            kind: Type of memory (fact, incident, runbook, decision).
            node_set: Optional comma-separated tags for grouping.
        """
        await _ensure_cognee()

        redacted_text = _redact_secrets(text)
        was_redacted = redacted_text != text

        parsed_node_set = None
        if node_set:
            parsed_node_set = [ns.strip() for ns in node_set.split(",") if ns.strip()]

        try:
            from app.memory import add_incident_report
            result = await add_incident_report(
                text=redacted_text,
                dataset_name=DATASET,
                node_set=parsed_node_set,
                source=f"mcp:{kind}",
                use_custom_pipeline=True,
            )
        except Exception:
            await cognee.remember(
                data=redacted_text,
                dataset_name=DATASET,
                self_improvement=True,
            )
            result = {"status": "remembered", "pipeline": "default"}

        return {
            "status": "stored",
            "subject": subject or redacted_text[:80],
            "kind": kind,
            "redacted": was_redacted,
            "dataset": DATASET,
            "pipeline": result.get("pipeline", "default"),
        }

    @mcp.tool()
    async def forget_memory(
        memory_id: Optional[str] = None,
        subject: Optional[str] = None,
        dataset: str = "",
    ) -> dict:
        """Delete a memory from the knowledge graph and vector store so it
        can never resurface. Use for governance: remove rejected memories,
        retract secrets, or clean up stale data.

        Args:
            memory_id: The specific memory node ID to delete.
            subject: Delete memories matching this subject text.
            dataset: Dataset to prune (defaults to main dataset).
        """
        await _ensure_cognee()

        target_dataset = dataset or DATASET

        try:
            from app.memory import forget_memory as do_forget
            result = await do_forget(
                data_id=memory_id,
                dataset_name=target_dataset,
            )
        except Exception:
            if memory_id:
                await cognee.forget(data_id=memory_id, dataset=target_dataset)
            elif subject:
                await cognee.forget(dataset=target_dataset)
            else:
                await cognee.forget(dataset=target_dataset, everything=True)
            result = {"status": "forgotten"}

        return {
            "status": "deleted",
            "memory_id": memory_id,
            "subject": subject,
            "dataset": target_dataset,
        }

    @mcp.tool()
    async def improve_rules(
        session_ids: Optional[list] = None,
    ) -> dict:
        """Run the improve/memify pipeline to distill durable Rule nodes from
        recorded investigation sessions. After calling this, list_incident_rules
        will return the newly distilled rules.

        Args:
            session_ids: Optional list of session IDs to distill from.
        """
        await _ensure_cognee()

        try:
            from app.memory import run_improve as do_improve
            result = await do_improve(
                dataset_name=DATASET,
                session_ids=session_ids,
            )
        except Exception:
            await cognee.improve(
                dataset=DATASET,
                session_ids=session_ids,
                build_global_context_index=True,
            )
            result = {"status": "improved", "dataset": DATASET}

        return {
            "status": "rules_distilled",
            "dataset": DATASET,
            "session_ids": session_ids,
            "details": result,
        }

    @mcp.tool()
    async def list_incident_rules(
        query: str = "SRE best practices and incident response rules",
        top_k: int = 10,
    ) -> dict:
        """Retrieve distilled incident response rules and SRE best practices
        from the knowledge graph. These rules were extracted from past
        investigation sessions via improve_rules.

        Args:
            query: Search query for rules.
            top_k: Maximum number of rules to return.
        """
        await _ensure_cognee()

        try:
            results = await cognee.recall(
                query_text=query,
                query_type=SearchType.GRAPH_COMPLETION,
                datasets=[DATASET],
                top_k=top_k,
            )
        except Exception:
            results = await cognee.recall(
                query_text=query,
                query_type=SearchType.VECTOR_SEARCH,
                datasets=[DATASET],
                top_k=top_k,
            )

        rules = []
        for r in results:
            result_dict = r if isinstance(r, dict) else {"text": str(r)}
            rules.append({
                "text": _redact_secrets(result_dict.get("text", str(r))),
                "trust_score": round(_compute_trust_score(result_dict), 2),
            })

        return {
            "rules": rules,
            "count": len(rules),
            "query": query,
        }

    return mcp
