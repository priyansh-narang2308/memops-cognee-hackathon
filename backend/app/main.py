import app._env  # noqa: F401 — loads .env before anything else

import os
import shlex
import subprocess
import time
from typing import Optional, List, Dict
from fastapi import FastAPI, HTTPException, Security, Depends, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel

import cognee
from cognee.infrastructure.databases.graph import get_graph_engine
from cognee.modules.visualization.preprocessor import preprocess
from cognee.modules.users.methods import get_default_user
from cognee.modules.data.methods import get_authorized_existing_datasets
from cognee.context_global_variables import set_database_global_context_variables

from app.memory import (
    add_incident_report,
    search_memory,
    submit_feedback,
    forget_memory,
    register_engineer_agent,
    register_agent_session,
    get_memory_health_stats,
    get_growth_history,
    get_improve_history,
    get_knowledge_decay,
    improve_memory,
    get_node_lineage,
    get_provenance_graph,
    get_schema_inventory,
    summarize_incident,
    update_memory,
    export_memory,
    push_memory,
    clear_observability_traces,
    get_observability_traces,
)

from app.permissions import setup_multi_user_environment
from app.agents import on_call_sre_agent, post_mortem_analyzer_agent

app = FastAPI(title="MemOps SRE Memory Engine")

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RATE_LIMIT_WINDOW = int(os.environ.get("RATE_LIMIT_WINDOW", "60"))
RATE_LIMIT_MAX_REQUESTS = int(os.environ.get("RATE_LIMIT_MAX_REQUESTS", "100"))
_request_log: Dict[str, list] = {}


async def rate_limit(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW

    if client_ip not in _request_log:
        _request_log[client_ip] = []

    _request_log[client_ip] = [t for t in _request_log[client_ip] if t > window_start]

    if len(_request_log[client_ip]) >= RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(
            status_code=429, detail="Rate limit exceeded. Try again later."
        )

    _request_log[client_ip].append(now)


@app.on_event("startup")
async def startup_event():
    service_url = os.environ.get("COGNEE_SERVICE_URL")
    api_key = os.environ.get("COGNEE_API_KEY")
    if service_url:
        print(f"[startup] 🌐 Connecting to Cognee Cloud: {service_url}")
        try:
            await cognee.serve(url=service_url, api_key=api_key)
            print("[startup] ✅ Successfully connected to Cognee Cloud. All operations route to remote.")
        except Exception as e:
            print(f"[startup] ⚠️ Warning connecting to Cognee Cloud: {e}")
            print("[startup] 💻 Falling back to local mode")
            await cognee.run_migrations()
    else:
        print("[startup] 💻 Running Cognee in Local SDK Mode (Kuzu/fastembed)")
        await cognee.run_migrations()

    try:
        result = await setup_multi_user_environment()
        print(f"[startup] Multi-user environment configured: {result['status']}")
    except Exception as e:
        print(f"[startup] Multi-user setup skipped (may already exist): {e}")


@app.on_event("shutdown")
async def shutdown_event():
    if os.environ.get("COGNEE_SERVICE_URL"):
        try:
            await cognee.disconnect()
            print("[shutdown] Disconnected from Cognee Cloud.")
        except Exception as e:
            print(f"[shutdown] Note during Cognee disconnect: {e}")


api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: Optional[str] = Security(api_key_header)):
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing API Key")
    valid_key = os.environ.get("COGNEE_API_KEY", "memops_super_secret_key")
    if api_key != valid_key:
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return api_key


# ─────────────────────────────────────────────────────────
# REQUEST MODELS
# ─────────────────────────────────────────────────────────


class IngestRequest(BaseModel):
    text: str
    dataset: str = "incidents"
    node_set: Optional[List[str]] = None
    custom_prompt: Optional[str] = None
    use_custom_pipeline: bool = True


class QueryRequest(BaseModel):
    query: str
    search_type: str
    session_id: Optional[str] = None
    scope: Optional[str] = "auto"
    top_k: int = 15


class MitigateRequest(BaseModel):
    command: str


class FeedbackRequest(BaseModel):
    session_id: str
    score: int
    comment: str
    dataset: str = "incidents"


class AgentRegisterRequest(BaseModel):
    name: str
    datasets: List[str] = ["incidents"]


class AgentSessionRequest(BaseModel):
    agent_session_name: str
    session_id: str
    datasets: List[str] = ["incidents"]


class ImproveRequest(BaseModel):
    dataset: str = "incidents"
    session_ids: Optional[List[str]] = None
    run_in_background: bool = False


class SummarizeRequest(BaseModel):
    text: str
    incident_title: str = ""


class UpdateRequest(BaseModel):
    data_id: str
    new_data: str
    dataset: str = "incidents"


class ExportRequest(BaseModel):
    dataset: str = "incidents"
    format: str = "json"


class PushRequest(BaseModel):
    data: str
    target_dataset: str
    source_dataset: str = "incidents"


# ─────────────────────────────────────────────────────────
# CORE MEMORY LIFECYCLE (remember / recall / improve / forget)
# ─────────────────────────────────────────────────────────


@app.post("/ingest", dependencies=[Depends(verify_api_key), Depends(rate_limit)])
async def ingest_incident(payload: IngestRequest):
    """REMEMBER — Ingest incident report into memory graph."""
    try:
        if not payload.text or not payload.text.strip():
            raise HTTPException(status_code=422, detail="Text cannot be empty")
        if len(payload.text) > 100000:
            raise HTTPException(status_code=413, detail="Text too large (max 100KB)")
        result = await add_incident_report(
            text=payload.text,
            dataset_name=payload.dataset,
            node_set=payload.node_set,
            custom_prompt=payload.custom_prompt,
            use_custom_pipeline=payload.use_custom_pipeline,
        )
        return {
            "status": "success",
            "message": "Incident report ingested successfully",
            "details": result,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ingest/file", dependencies=[Depends(verify_api_key), Depends(rate_limit)])
async def ingest_file(
    file: UploadFile = File(...),
    dataset: str = "incidents",
    node_set: Optional[str] = None,
):
    """REMEMBER — Ingest a file (PDF, Markdown, TXT) into memory graph."""
    allowed_types = {
        "application/pdf",
        "text/markdown",
        "text/plain",
        "text/x-markdown",
    }
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {file.content_type}. Allowed: PDF, Markdown, TXT",
        )

    content = await file.read()
    if len(content) > 500000:
        raise HTTPException(status_code=413, detail="File too large (max 500KB)")

    if file.content_type == "application/pdf":
        try:
            import io
            from pdfminer.high_level import extract_text as pdf_extract

            text = pdf_extract(io.BytesIO(content))
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="PDF support requires pdfminer.six: pip install pdfminer.six",
            )
    else:
        text = content.decode("utf-8", errors="replace")

    if not text.strip():
        raise HTTPException(status_code=422, detail="File is empty or unreadable")

    parsed_node_set = None
    if node_set:
        parsed_node_set = [ns.strip() for ns in node_set.split(",") if ns.strip()]

    try:
        result = await add_incident_report(
            text=text,
            dataset_name=dataset,
            node_set=parsed_node_set,
            source=f"file:{file.filename}",
            use_custom_pipeline=True,
        )
        return {
            "status": "success",
            "message": f"File '{file.filename}' ingested successfully",
            "filename": file.filename,
            "content_type": file.content_type,
            "text_length": len(text),
            "details": result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query", dependencies=[Depends(verify_api_key), Depends(rate_limit)])
async def query_incident_memory(payload: QueryRequest):
    """RECALL — Query memory graph with all search types."""
    try:
        search_results = await search_memory(
            query=payload.query,
            search_type=payload.search_type,
            session_id=payload.session_id,
            scope=payload.scope,
            top_k=payload.top_k,
        )

        mitigation_proposal = None
        try:
            user = await get_default_user()
            datasets = await get_authorized_existing_datasets(["incidents"], "read", user)

            if datasets:
                async with set_database_global_context_variables(
                    datasets[0].id, datasets[0].owner_id
                ):
                    graph_engine = await get_graph_engine()
                    nodes_data, _ = await graph_engine.get_graph_data()

                    for node_id, node_info in nodes_data:
                        if node_info.get("type") == "Mitigation" or "Mitigation" in str(
                            node_info.get("attributes", {}).get("type", "")
                        ):
                            cmd = node_info.get("command_to_run") or node_info.get(
                                "attributes", {}
                            ).get("command_to_run")
                            desc = node_info.get("description") or node_info.get(
                                "attributes", {}
                            ).get("description")
                            if cmd:
                                query_words = set(payload.query.lower().split())
                                desc_words = set(desc.lower().split()) if desc else set()
                                if query_words.intersection(desc_words) or any(
                                    word in payload.query.lower()
                                    for word in ["fix", "resolve", "mitigate", "restart"]
                                ):
                                    mitigation_proposal = {
                                        "description": desc
                                        or "Proposed mitigation command",
                                        "command": cmd,
                                    }
                                    break
        except Exception:
            pass

        search_results["mitigation_proposal"] = mitigation_proposal
        return search_results
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/improve", dependencies=[Depends(verify_api_key), Depends(rate_limit)])
async def run_improve(payload: ImproveRequest):
    """IMPROVE — Run memify to strengthen graph edges."""
    try:
        result = await improve_memory(
            dataset_name=payload.dataset,
            session_ids=payload.session_ids,
            run_in_background=payload.run_in_background,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/prune", dependencies=[Depends(verify_api_key), Depends(rate_limit)])
async def prune_telemetry(dataset: str = "incidents", entity_id: Optional[str] = None):
    """FORGET — Selectively prune memory graph."""
    try:
        if entity_id:
            await forget_memory(dataset_name=dataset, data_id=entity_id)
        else:
            await forget_memory(dataset_name=dataset)
        return {"status": "success", "message": "Memory pruned"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/feedback", dependencies=[Depends(verify_api_key), Depends(rate_limit)])
async def register_feedback(payload: FeedbackRequest):
    """FEEDBACK — Submit engineer feedback + trigger improve()."""
    try:
        success = await submit_feedback(
            session_id=payload.session_id,
            score=payload.score,
            comment=payload.comment,
            dataset_name=payload.dataset,
        )
        if not success:
            raise HTTPException(status_code=404, detail="Session QA history not found")
        return {"status": "success", "message": "Feedback submitted and memory updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post(
    "/mitigate/execute", dependencies=[Depends(verify_api_key), Depends(rate_limit)]
)
async def execute_mitigation(payload: MitigateRequest):
    try:
        import pathlib

        allowed_prefixes = ["echo", "python3 scripts/"]
        if not any(payload.command.startswith(pre) for pre in allowed_prefixes):
            raise HTTPException(
                status_code=400,
                detail="Execution blocked: Command safety policy violation",
            )

        if "python3 scripts/" in payload.command:
            script_part = payload.command.split("python3 scripts/")[1].split()[0]
            resolved = pathlib.Path(
                os.path.join(os.path.dirname(__file__), "..", "scripts", script_part)
            ).resolve()
            scripts_dir = pathlib.Path(
                os.path.join(os.path.dirname(__file__), "..", "scripts")
            ).resolve()
            if not str(resolved).startswith(str(scripts_dir)):
                raise HTTPException(
                    status_code=400,
                    detail="Execution blocked: Path traversal detected",
                )

        args = shlex.split(payload.command)
        result = subprocess.run(
            args,
            shell=False,
            capture_output=True,
            text=True,
            timeout=10,
        )

        return {
            "status": "success" if result.returncode == 0 else "failed",
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode,
        }
    except HTTPException:
        raise
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Command execution timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────
# GRAPH & VISUALIZATION
# ─────────────────────────────────────────────────────────


@app.get("/graph", dependencies=[Depends(verify_api_key), Depends(rate_limit)])
async def get_graph(dataset: str = "incidents"):
    try:
        user = await get_default_user()
        datasets = await get_authorized_existing_datasets([dataset], "read", user)
        if not datasets:
            return {"nodes": [], "links": []}

        async with set_database_global_context_variables(
            datasets[0].id, datasets[0].owner_id
        ):
            graph_engine = await get_graph_engine()
            graph_data = await graph_engine.get_graph_data()
            pre = preprocess(graph_data)
            return {"nodes": pre.nodes, "links": pre.links}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get(
    "/lineage/{node_id}", dependencies=[Depends(verify_api_key), Depends(rate_limit)]
)
async def node_lineage(node_id: str, dataset: str = "incidents"):
    try:
        lineage_data = await get_node_lineage(node_id=node_id, dataset_name=dataset)
        if "error" in lineage_data and lineage_data["error"] == "Node not found":
            raise HTTPException(status_code=404, detail="Node not found")
        return lineage_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────
# COGNEE PROVENANCE GRAPH
# ─────────────────────────────────────────────────────────


@app.get("/provenance", dependencies=[Depends(verify_api_key), Depends(rate_limit)])
async def provenance_graph(dataset: str = "incidents"):
    """COGNEE PROVENANCE — Track data lineage from ingestion to query."""
    try:
        result = await get_provenance_graph(dataset_name=dataset)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────
# COGNEE SCHEMA INVENTORY
# ─────────────────────────────────────────────────────────


@app.get("/schema", dependencies=[Depends(verify_api_key), Depends(rate_limit)])
async def schema_inventory():
    """COGNEE SCHEMA — Discover all registered DataPoint schemas."""
    try:
        result = await get_schema_inventory()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────
# SUMMARIZATION
# ─────────────────────────────────────────────────────────


@app.post("/summarize", dependencies=[Depends(verify_api_key), Depends(rate_limit)])
async def summarize(payload: SummarizeRequest):
    """SUMMARIZE — Auto-generate incident summary via cognee.tasks.summarization."""
    try:
        result = await summarize_incident(
            text=payload.text,
            incident_title=payload.incident_title,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────
# UPDATE MEMORY
# ─────────────────────────────────────────────────────────


@app.put("/update", dependencies=[Depends(verify_api_key), Depends(rate_limit)])
async def update_existing_memory(payload: UpdateRequest):
    """UPDATE — Modify existing memory entries via cognee.update()."""
    try:
        result = await update_memory(
            data_id=payload.data_id,
            new_data=payload.new_data,
            dataset_name=payload.dataset,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────
# EXPORT
# ─────────────────────────────────────────────────────────


@app.post("/export", dependencies=[Depends(verify_api_key), Depends(rate_limit)])
async def export_data(payload: ExportRequest):
    """EXPORT — Export memory data via cognee.export()."""
    try:
        result = await export_memory(
            dataset_name=payload.dataset,
            export_format=payload.format,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────
# PUSH TO EXTERNAL DATASETS
# ─────────────────────────────────────────────────────────


@app.post("/push", dependencies=[Depends(verify_api_key), Depends(rate_limit)])
async def push_to_dataset(payload: PushRequest):
    """PUSH — Push data to external datasets via cognee.push()."""
    try:
        result = await push_memory(
            data=payload.data,
            target_dataset=payload.target_dataset,
            source_dataset=payload.source_dataset,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────
# AGENTS
# ─────────────────────────────────────────────────────────


@app.post(
    "/agents/register", dependencies=[Depends(verify_api_key), Depends(rate_limit)]
)
async def register_agent_entity(payload: AgentRegisterRequest):
    try:
        info = await register_engineer_agent(
            agent_name=payload.name, datasets=payload.datasets
        )
        return {"status": "success", "agent_info": info}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post(
    "/agents/session", dependencies=[Depends(verify_api_key), Depends(rate_limit)]
)
async def register_agent_session_conn(payload: AgentSessionRequest):
    try:
        conn = await register_agent_session(
            agent_session_name=payload.agent_session_name,
            session_id=payload.session_id,
            datasets=payload.datasets,
        )
        return {"status": "success", "connection": conn}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────
# AGENT INVOCATION — Actually run @cognee.agent_memory agents
# ─────────────────────────────────────────────────────────


class AgentInvokeRequest(BaseModel):
    incident_text: str


@app.post(
    "/agents/invoke/sre", dependencies=[Depends(verify_api_key), Depends(rate_limit)]
)
async def invoke_sre_agent(payload: AgentInvokeRequest):
    """INVOKE — Run on_call_sre_agent with @cognee.agent_memory auto-injected context."""
    try:
        result = await on_call_sre_agent(payload.incident_text)
        return {"status": "success", "agent": "on_call_sre", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post(
    "/agents/invoke/postmortem",
    dependencies=[Depends(verify_api_key), Depends(rate_limit)],
)
async def invoke_postmortem_agent(payload: AgentInvokeRequest):
    """INVOKE — Run post_mortem_analyzer_agent with @cognee.agent_memory auto-injected context."""
    try:
        result = await post_mortem_analyzer_agent(payload.incident_text)
        return {"status": "success", "agent": "post_mortem_analyzer", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────
# HEALTH & OBSERVABILITY
# ─────────────────────────────────────────────────────────


@app.get("/health", dependencies=[Depends(verify_api_key), Depends(rate_limit)])
async def get_health(dataset: str = "incidents"):
    try:
        stats = await get_memory_health_stats(dataset_name=dataset)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health/decay", dependencies=[Depends(verify_api_key), Depends(rate_limit)])
async def get_decay(dataset: str = "incidents"):
    try:
        decay = await get_knowledge_decay(dataset_name=dataset)
        return decay
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health/growth", dependencies=[Depends(verify_api_key), Depends(rate_limit)])
async def get_growth(dataset: str = "incidents"):
    try:
        history = get_growth_history(dataset=dataset)
        return {
            "dataset": dataset,
            "snapshots": history,
            "total_snapshots": len(history),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get(
    "/health/improve-runs", dependencies=[Depends(verify_api_key), Depends(rate_limit)]
)
async def get_improve_runs(limit: int = 20):
    try:
        history = get_improve_history(limit=limit)
        return {"improve_runs": history, "total_runs": len(history)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get(
    "/observability/traces", dependencies=[Depends(verify_api_key), Depends(rate_limit)]
)
async def observability_traces():
    """COGNEE TRACES — Get all observability traces."""
    try:
        result = await get_observability_traces()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete(
    "/observability/traces", dependencies=[Depends(verify_api_key), Depends(rate_limit)]
)
async def clear_observability():
    """COGNEE TRACES — Clear all observability traces."""
    try:
        result = await clear_observability_traces()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────
# ADMIN
# ─────────────────────────────────────────────────────────


@app.post(
    "/admin/setup-multi-user",
    dependencies=[Depends(verify_api_key), Depends(rate_limit)],
)
async def admin_setup_multi_user():
    try:
        result = await setup_multi_user_environment()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────
# DEMO MODE — Pre-loaded incidents for instant demo
# ─────────────────────────────────────────────────────────

DEMO_INCIDENTS = [
    {
        "title": "Auth Service OOM Crash",
        "text": "INCIDENT: Auth Service Outage — 2024-01-15 03:14 UTC\nSeverity: P0\nDuration: 47 minutes\n\nRoot Cause: Memory leak in JWT token validation. The auth-service process consumed 4GB RSS (limit: 2GB) and was OOM-killed by Kubernetes. The leak was introduced in commit a3f2b1 (v2.14.0) where a new token cache was added without TTL eviction.\n\nImpact: All authentication requests failed. Users saw 401 errors. The payment service, which depends on auth for token validation, also failed. 12,000 users affected. Revenue impact: $34,000 in failed transactions.\n\nMitigation: Rolled back to v2.13.8. Auth service restarted. Payment service recovered automatically. Total MTTR: 47 minutes.\n\nAffected Services: auth-service, payment-gateway, user-portal\nFailure Modes: Memory leak, missing TTL, no OOM monitoring\nEngineers: Alice Chen (on-call), Bob Martinez (escalated)\n\nPost-mortem: https://docs.internal/incidents/2024-auth-oom",
        "node_set": ["team-infra", "service-auth", "severity-p0"],
    },
    {
        "title": "Database Connection Pool Exhaustion",
        "text": "INCIDENT: Billing Database Connection Pool Exhaustion — 2024-01-22 14:30 UTC\nSeverity: P1\nDuration: 23 minutes\n\nRoot Cause: A new analytics query in the billing service opened 500 database connections without releasing them. The connection pool (max: 200) was exhausted. New requests queued and timed out after 30s.\n\nImpact: Billing API returned 503 for 23 minutes. Invoice generation failed for 847 customers. No data loss.\n\nMitigation: Killed the analytics query process. Restarted billing service. Added connection pool monitoring alert.\n\nAffected Services: billing-api, analytics-worker, invoice-generator\nFailure Modes: Connection leak, missing pool monitoring, no query timeout\nEngineers: Bob Martinez (on-call)\n\nPost-mortem: https://docs.internal/incidents/2024-billing-db",
        "node_set": ["team-payments", "service-billing", "severity-p1"],
    },
    {
        "title": "Redis Cache Cluster Split-Brain",
        "text": "INCIDENT: Redis Cluster Split-Brain — 2024-02-03 08:15 UTC\nSeverity: P0\nDuration: 1 hour 12 minutes\n\nRoot Cause: Network partition between Redis nodes 2 and 3 caused a split-brain scenario. Both nodes elected themselves as master. Clients received stale data from one partition and fresh data from the other.\n\nImpact: User session data was inconsistent. Users experienced random logouts. Cache hit rate dropped from 99.2% to 34%. Database load spiked 800%.\n\nMitigation: Manually intervened to elect single master. Flushed stale replica. Added Redis cluster health checks to Prometheus.\n\nAffected Services: redis-cluster, session-manager, user-portal, api-gateway\nFailure Modes: Split-brain, missing failover automation, no circuit breaker\nEngineers: Alice Chen (on-call), Carol Wu (DBA escalation)\n\nPost-mortem: https://docs.internal/incidents/2024-redis-split",
        "node_set": ["team-infra", "service-redis", "severity-p0"],
    },
    {
        "title": "CDN Cache Poisoning",
        "text": "INCIDENT: CDN Cache Poisoning — 2024-02-10 22:45 UTC\nSeverity: P1\nDuration: 35 minutes\n\nRoot Cause: A misconfigured VCL rule on Fastly allowed internal API responses to be cached and served to all users. The /api/config endpoint returned CORS headers with max-age=3600, causing the CDN to cache it.\n\nImpact: 15% of users received stale configuration data. Feature flags were wrong. Some users saw the experimental checkout flow.\n\nMitigation: Purged CDN cache. Updated VCL to exclude /api/* paths from caching. Added cache-hit ratio monitoring.\n\nAffected Services: cdn-fastly, api-gateway, config-service\nFailure Modes: Cache poisoning, missing cache exclusion rules, no cache validation\nEngineers: Dave Kim (on-call)\n\nPost-mortem: https://docs.internal/incidents/2024-cdn-poison",
        "node_set": ["team-platform", "service-cdn", "severity-p1"],
    },
    {
        "title": "Payment Gateway Timeout Cascade",
        "text": "INCIDENT: Payment Gateway Timeout Cascade — 2024-02-18 16:00 UTC\nSeverity: P0\nDuration: 1 hour 5 minutes\n\nRoot Cause: Stripe webhook endpoint became slow (p99 > 5s). The payment-service thread pool filled up. Retries from the order-service amplified the load 10x. The entire payment pipeline froze.\n\nImpact: All payment processing halted. 2,340 orders stuck in pending. Revenue impact: $127,000 in delayed transactions.\n\nMitigation: Added circuit breaker on payment-service. Implemented bulkhead pattern. Added Stripe webhook monitoring.\n\nAffected Services: payment-service, order-service, stripe-webhook, notification-service\nFailure Modes: Timeout cascade, missing circuit breaker, retry storm\nEngineers: Alice Chen (on-call), Bob Martinez (escalated), Carol Wu (Stripe support)\n\nPost-mortem: https://docs.internal/incidents/2024-payment-cascade",
        "node_set": ["team-payments", "service-payment", "severity-p0"],
    },
    {
        "title": "Kubernetes Node NotReady",
        "text": "INCIDENT: Kubernetes Node NotReady — 2024-03-01 04:20 UTC\nSeverity: P1\nDuration: 18 minutes\n\nRoot Cause: kubelet on node-3 became unresponsive due to disk pressure. The node's ephemeral storage was 98% full from old container logs. Kubernetes marked the node as NotReady and began rescheduling pods.\n\nImpact: 12 pods were rescheduled. Two stateful pods (PostgreSQL replicas) experienced brief disconnections. No data loss due to synchronous replication.\n\nMitigation: Cleaned up old logs on node-3. Added disk pressure alerts at 80%. Implemented log rotation for all containers.\n\nAffected Services: k8s-node-3, postgres-replica-2, monitoring-agent\nFailure Modes: Disk pressure, missing log rotation, no proactive monitoring\nEngineers: Dave Kim (on-call)\n\nPost-mortem: https://docs.internal/incidents/2024-k8s-node",
        "node_set": ["team-infra", "service-kubernetes", "severity-p1"],
    },
]


@app.post("/demo/load", dependencies=[Depends(verify_api_key), Depends(rate_limit)])
async def load_demo_data(dataset: str = "incidents"):
    """DEMO — Pre-load 6 realistic SRE incidents for instant demo."""
    try:
        loaded = []
        for incident in DEMO_INCIDENTS:
            result = await add_incident_report(
                text=incident["text"],
                dataset_name=dataset,
                node_set=incident["node_set"],
                use_custom_pipeline=True,
            )
            loaded.append({
                "title": incident["title"],
                "status": result.get("status", "unknown"),
            })
        return {
            "status": "success",
            "message": f"Loaded {len(loaded)} incidents into '{dataset}'",
            "incidents": loaded,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────
# DEMO COMPARE — Stateless LLM vs Cognee-powered (KILLER FEATURE)
# ─────────────────────────────────────────────────────────

class CompareRequest(BaseModel):
    question: str


@app.post("/demo/compare", dependencies=[Depends(verify_api_key), Depends(rate_limit)])
async def compare_stateless_vs_cognee(payload: CompareRequest):
    """DEMO — Side-by-side: stateless LLM vs Cognee memory-powered. The killer comparison."""
    try:
        # Stateless: raw LLM with no memory
        from cognee.infrastructure.llm.LLMGateway import LLMGateway

        stateless_prompt = (
            "You are an SRE. Answer this question based only on what I tell you right now. "
            "You have no memory of past incidents.\n\n"
            f"Question: {payload.question}\n\n"
            "Answer:"
        )
        stateless_response = await LLMGateway.acreate_structured_output(
            text="",
            system_prompt=stateless_prompt,
            response_model=str,
        )

        # Cognee: recall from memory graph + LLM
        cognee_results = await search_memory(
            query=payload.question,
            search_type="GRAPH_COMPLETION",
            top_k=10,
        )

        cognee_context = "\n".join(cognee_results.get("results", [])[:5])

        cognee_prompt = (
            "You are an SRE with access to a knowledge graph of past incidents. "
            "Use the retrieved context to answer the question. Reference specific "
            "incidents, services, and failure modes from the graph.\n\n"
            f"Retrieved Context:\n{cognee_context}\n\n"
            f"Question: {payload.question}\n\n"
            "Answer with specific references to past incidents:"
        )
        cognee_response = await LLMGateway.acreate_structured_output(
            text="",
            system_prompt=cognee_prompt,
            response_model=str,
        )

        return {
            "question": payload.question,
            "stateless": {
                "answer": str(stateless_response),
                "has_memory": False,
                "can_reference_past": False,
            },
            "cognee_powered": {
                "answer": str(cognee_response),
                "has_memory": True,
                "can_reference_past": True,
                "graph_nodes_used": len(cognee_results.get("results", [])),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
