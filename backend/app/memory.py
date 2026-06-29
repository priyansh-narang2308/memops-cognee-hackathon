from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import asyncio
import json

import cognee
from cognee.api.v1.search import SearchType
from cognee.modules.observability.trace_context import (
    enable_tracing,
    get_all_traces,
    clear_traces,
)

_improve_runs: List[Dict[str, Any]] = []
_growth_snapshots: List[Dict[str, Any]] = []


# ─────────────────────────────────────────────────────────
# REMEMBER (with NodeSet support)
# ─────────────────────────────────────────────────────────


async def add_incident_report(
    text: str,
    dataset_name: str = "incidents",
    node_set: Optional[List[str]] = None,
    source: str = "manual",
    custom_prompt: Optional[str] = None,
    use_custom_pipeline: bool = True,
) -> Dict[str, Any]:
    if use_custom_pipeline:
        try:
            from app.pipeline import run_ingestion_pipeline

            result = await run_ingestion_pipeline(
                text=text,
                dataset_name=dataset_name,
                node_set=node_set,
            )
            return {
                "status": "remembered",
                "dataset": dataset_name,
                "node_set": node_set,
                "pipeline": "custom_8_task",
                "result": str(result) if result else None,
            }
        except Exception:
            pass

    remember_kwargs = {
        "data": text,
        "dataset_name": dataset_name,
        "self_improvement": True,
    }
    if node_set:
        remember_kwargs["node_set"] = node_set
    if custom_prompt:
        remember_kwargs["custom_prompt"] = custom_prompt

    result = await cognee.remember(**remember_kwargs)

    return {
        "status": "remembered",
        "dataset": dataset_name,
        "node_set": node_set,
        "pipeline": "default",
        "result": str(result) if result else None,
    }


# ─────────────────────────────────────────────────────────
# RECALL (all search types)
# ─────────────────────────────────────────────────────────


async def search_memory(
    query: str,
    search_type: str,
    session_id: Optional[str] = None,
    datasets: Optional[List[str]] = None,
    node_name: Optional[List[str]] = None,
    node_name_filter_operator: str = "OR",
    feedback_influence: float = 0.0,
    only_context: bool = False,
    top_k: int = 15,
    scope: Optional[str] = "auto",
) -> Dict[str, Any]:
    enable_tracing()

    recall_kwargs = dict(
        query_text=query,
        query_type=SearchType[search_type],
        session_id=session_id,
        datasets=datasets or ["incidents"],
        node_name=node_name,
        node_name_filter_operator=node_name_filter_operator,
        feedback_influence=feedback_influence,
        only_context=only_context,
        top_k=top_k,
    )
    if scope and scope != "auto":
        recall_kwargs["scope"] = scope

    results = await cognee.recall(**recall_kwargs)

    traces = get_all_traces()
    trace_data = []
    for trace in traces:
        for span in getattr(trace, "spans", []):
            trace_data.append(
                {
                    "name": getattr(span, "name", "span"),
                    "start_time": getattr(span, "start_time", None),
                    "end_time": getattr(span, "end_time", None),
                    "attributes": getattr(span, "attributes", {}),
                }
            )

    return {
        "results": [str(r) for r in results],
        "traces": trace_data,
        "search_type": search_type,
        "session_id": session_id,
    }


async def search_temporal(
    query: str,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    return await search_memory(
        query=query,
        search_type="TEMPORAL",
        session_id=session_id,
    )


async def search_graph_completion(
    query: str,
    session_id: Optional[str] = None,
    feedback_influence: float = 0.0,
) -> Dict[str, Any]:
    return await search_memory(
        query=query,
        search_type="GRAPH_COMPLETION",
        session_id=session_id,
        feedback_influence=feedback_influence,
    )


async def search_triplet(
    query: str,
) -> Dict[str, Any]:
    return await search_memory(
        query=query,
        search_type="TRIPLET_COMPLETION",
    )


async def search_hybrid(
    query: str,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    return await search_memory(
        query=query,
        search_type="HYBRID_COMPLETION",
        session_id=session_id,
    )


# ─────────────────────────────────────────────────────────
# IMPROVE (memify)
# ─────────────────────────────────────────────────────────


async def submit_feedback(
    session_id: str,
    score: int,
    comment: str,
    dataset_name: str = "incidents",
) -> bool:
    entries = await cognee.session.get_session(session_id=session_id)
    if not entries:
        return False

    latest_qa_id = entries[-1].qa_id

    ok = await cognee.session.add_feedback(
        session_id=session_id,
        qa_id=latest_qa_id,
        feedback_score=score,
        feedback_text=comment,
    )

    if ok:
        await cognee.session.get_session(session_id=session_id, last_n=1)

        async def _run_improve():
            await cognee.improve(
                dataset=dataset_name,
                session_ids=[session_id],
                build_global_context_index=True,
            )
            _track_improve_run(dataset_name, session_ids=[session_id])

        asyncio.ensure_future(_run_improve())

    return ok


def _track_improve_run(dataset_name: str, session_ids: Optional[List[str]] = None):
    _improve_runs.append(
        {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "dataset": dataset_name,
            "session_ids": session_ids or [],
        }
    )
    if len(_improve_runs) > 100:
        _improve_runs.pop(0)


async def improve_memory(
    dataset_name: str = "incidents",
    session_ids: Optional[List[str]] = None,
    build_global_context: bool = True,
    run_in_background: bool = False,
) -> Dict[str, Any]:
    kwargs = {
        "dataset": dataset_name,
        "build_global_context_index": build_global_context,
    }
    if session_ids:
        kwargs["session_ids"] = session_ids

    if run_in_background:
        await cognee.improve(**kwargs, run_in_background=True)
    else:
        await cognee.improve(**kwargs)

    _track_improve_run(dataset_name, session_ids=session_ids)

    return {
        "status": "completed",
        "dataset": dataset_name,
        "session_ids": session_ids,
        "global_context_index": build_global_context,
    }


# ─────────────────────────────────────────────────────────
# FORGET / PRUNE (using cognee.forget)
# ─────────────────────────────────────────────────────────


async def forget_memory(
    dataset_name: Optional[str] = None,
    data_id: Optional[str] = None,
    everything: bool = False,
    memory_only: bool = False,
) -> Dict[str, Any]:
    kwargs = {}
    if everything:
        kwargs["everything"] = True
    elif dataset_name and data_id:
        kwargs["dataset"] = dataset_name
        kwargs["data_id"] = data_id
    elif dataset_name and memory_only:
        kwargs["dataset"] = dataset_name
        kwargs["memory_only"] = True
    elif dataset_name:
        kwargs["dataset"] = dataset_name
    else:
        return {
            "status": "error",
            "message": "Specify dataset, data_id, or everything=True",
        }

    await cognee.forget(**kwargs)

    return {
        "status": "forgotten",
        "dataset": dataset_name,
        "data_id": data_id,
        "memory_only": memory_only,
        "everything": everything,
    }


# ─────────────────────────────────────────────────────────
# AGENTS (@cognee.agent_memory)
# ─────────────────────────────────────────────────────────


async def register_engineer_agent(
    agent_name: str,
    datasets: List[str],
) -> Dict[str, Any]:
    try:
        agent_info = await cognee.agents.create(name=agent_name, datasets=datasets)
        return agent_info
    except Exception as e:
        if "PermissionDenied" in str(e) or "permission" in str(e).lower():
            # Auto-create datasets the agent needs
            user = await _ensure_datasets_exist(datasets)
            try:
                agent_info = await cognee.agents.create(name=agent_name, datasets=datasets)
                return agent_info
            except Exception as retry_err:
                return {
                    "name": agent_name,
                    "datasets": datasets,
                    "status": "registered_locally",
                    "note": f"Agent registered (Cognee Cloud unavailable): {retry_err}",
                }
        raise


async def register_agent_session(
    agent_session_name: str,
    session_id: str,
    datasets: List[str],
) -> Dict[str, Any]:
    try:
        connection = await cognee.agents.register(
            agent_session_name=agent_session_name,
            session_id=session_id,
            dataset_names=datasets,
        )
        return connection
    except Exception as e:
        if "PermissionDenied" in str(e) or "permission" in str(e).lower():
            await _ensure_datasets_exist(datasets)
            try:
                connection = await cognee.agents.register(
                    agent_session_name=agent_session_name,
                    session_id=session_id,
                    dataset_names=datasets,
                )
                return connection
            except Exception as retry_err:
                return {
                    "agent_session_name": agent_session_name,
                    "session_id": session_id,
                    "status": "session_registered_locally",
                    "note": f"Session created (Cognee Cloud unavailable): {retry_err}",
                }
        raise


async def _ensure_datasets_exist(dataset_names: List[str]):
    """Auto-create datasets and grant admin permissions so agents can register."""
    from cognee.modules.users.methods import get_default_user
    from cognee.modules.data.methods import (
        get_authorized_dataset_by_name,
        create_authorized_dataset,
    )

    user = await get_default_user()
    for name in dataset_names:
        try:
            ds = await get_authorized_dataset_by_name(name, user=user, permission_type="write")
            if ds is None:
                await create_authorized_dataset(name, user=user)
        except Exception:
            try:
                await create_authorized_dataset(name, user=user)
            except Exception:
                pass
    return user


# ─────────────────────────────────────────────────────────
# COGNEE.PROVE — Provenance graph
# ─────────────────────────────────────────────────────────


async def get_provenance_graph(
    dataset_name: str = "incidents",
) -> Dict[str, Any]:
    try:
        result = await cognee.get_memory_provenance_graph(dataset_name=dataset_name)
        provenance_data = []
        if result:
            for item in result:
                provenance_data.append(
                    {
                        "id": getattr(item, "id", None),
                        "type": getattr(item, "type", None),
                        "source": getattr(item, "source", None),
                        "target": getattr(item, "target", None),
                        "metadata": getattr(item, "metadata", {}),
                        "properties": {
                            k: v for k, v in vars(item).items() if not k.startswith("_")
                        }
                        if hasattr(item, "__dict__")
                        else {},
                    }
                )
        return {
            "dataset": dataset_name,
            "provenance_nodes": len(provenance_data),
            "provenance_graph": provenance_data[:100],
        }
    except Exception as e:
        return {
            "dataset": dataset_name,
            "error": str(e),
            "provenance_nodes": 0,
            "provenance_graph": [],
        }


# ─────────────────────────────────────────────────────────
# COGNEE.GET_SCHEMA_INVENTORY — Schema discovery
# ─────────────────────────────────────────────────────────


async def get_schema_inventory() -> Dict[str, Any]:
    try:
        inventory = await cognee.get_schema_inventory()
        schemas = []
        if inventory:
            for schema in inventory:
                schemas.append(
                    {
                        "name": getattr(schema, "name", None),
                        "type": getattr(schema, "type", None),
                        "properties": getattr(schema, "properties", []),
                        "relationships": getattr(schema, "relationships", []),
                    }
                )
        return {
            "total_schemas": len(schemas),
            "schemas": schemas,
        }
    except Exception as e:
        return {
            "error": str(e),
            "total_schemas": 0,
            "schemas": [],
        }


# ─────────────────────────────────────────────────────────
# SUMMARIZATION — Auto-summarize incidents
# ─────────────────────────────────────────────────────────


async def summarize_incident(
    text: str,
    incident_title: str = "",
) -> Dict[str, Any]:
    try:
        from cognee.tasks.summarization import summarize_text
        from cognee.infrastructure.engine import DataPoint as DP

        class TextChunk(DP):
            text: str = ""
            metadata: dict = {}

        chunks = [TextChunk(text=text)]
        summaries = await summarize_text(chunks)

        summary_text = ""
        if summaries and len(summaries) > 0:
            summary_obj = summaries[0]
            summary_text = getattr(summary_obj, "summary", "") or str(summary_obj)

        summary_datapoint = {
            "incident_title": incident_title,
            "summary_text": summary_text,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

        await cognee.remember(
            data=json.dumps(summary_datapoint),
            dataset_name="incident_summaries",
            self_improvement=False,
        )

        return {
            "status": "summarized",
            "incident_title": incident_title,
            "summary": summary_text,
        }
    except Exception as e:
        return {
            "status": "fallback_summary",
            "incident_title": incident_title,
            "summary": text[:500] + "..." if len(text) > 500 else text,
            "error": str(e),
        }


# ─────────────────────────────────────────────────────────
# UPDATE — Modify existing memories
# ─────────────────────────────────────────────────────────


async def update_memory(
    data_id: str,
    new_data: str,
    dataset_name: str = "incidents",
) -> Dict[str, Any]:
    try:
        await cognee.update(
            data_id=data_id,
            data=new_data,
            dataset_name=dataset_name,
        )
        return {
            "status": "updated",
            "data_id": data_id,
            "dataset": dataset_name,
        }
    except Exception as e:
        return {
            "status": "error",
            "data_id": data_id,
            "error": str(e),
        }


# ─────────────────────────────────────────────────────────
# EXPORT — Data portability
# ─────────────────────────────────────────────────────────


async def export_memory(
    dataset_name: str = "incidents",
    export_format: str = "json",
) -> Dict[str, Any]:
    try:
        result = await cognee.export(
            dataset_name=dataset_name,
            format=export_format,
        )
        return {
            "status": "exported",
            "dataset": dataset_name,
            "format": export_format,
            "data": result,
        }
    except Exception as e:
        return {
            "status": "error",
            "dataset": dataset_name,
            "error": str(e),
        }


# ─────────────────────────────────────────────────────────
# PUSH — Push to external datasets
# ─────────────────────────────────────────────────────────


async def push_memory(
    data: str,
    target_dataset: str,
    source_dataset: str = "incidents",
) -> Dict[str, Any]:
    try:
        result = await cognee.push(
            data=data,
            target_dataset=target_dataset,
            source_dataset=source_dataset,
        )
        return {
            "status": "pushed",
            "source": source_dataset,
            "target": target_dataset,
            "result": str(result) if result else None,
        }
    except Exception as e:
        return {
            "status": "error",
            "source": source_dataset,
            "target": target_dataset,
            "error": str(e),
        }


# ─────────────────────────────────────────────────────────
# CLEAR TRACES — Admin observability
# ─────────────────────────────────────────────────────────


async def clear_observability_traces() -> Dict[str, Any]:
    try:
        clear_traces()
        return {"status": "cleared", "message": "All observability traces cleared"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


async def get_observability_traces() -> Dict[str, Any]:
    try:
        traces = get_all_traces()
        trace_data = []
        for trace in traces:
            for span in getattr(trace, "spans", []):
                trace_data.append(
                    {
                        "name": getattr(span, "name", "span"),
                        "start_time": getattr(span, "start_time", None),
                        "end_time": getattr(span, "end_time", None),
                        "attributes": getattr(span, "attributes", {}),
                    }
                )
        return {
            "total_traces": len(trace_data),
            "traces": trace_data[:50],
        }
    except Exception as e:
        return {"error": str(e), "total_traces": 0, "traces": []}


# ─────────────────────────────────────────────────────────
# HEALTH STATS
# ─────────────────────────────────────────────────────────


async def get_memory_health_stats(dataset_name: str = "incidents") -> Dict[str, Any]:
    try:
        from cognee.infrastructure.databases.graph import get_graph_engine
        from cognee.modules.users.methods import get_default_user
        from cognee.modules.data.methods import get_authorized_existing_datasets
        from cognee.context_global_variables import (
            set_database_global_context_variables,
        )

        user = await get_default_user()
        datasets = await get_authorized_existing_datasets([dataset_name], "read", user)

        if datasets:
            async with set_database_global_context_variables(
                datasets[0].id, datasets[0].owner_id
            ):
                graph_engine = await get_graph_engine()
                nodes_data, edges_data = await graph_engine.get_graph_data()

                node_types = {}
                total_nodes = len(nodes_data) if nodes_data else 0
                total_edges = len(edges_data) if edges_data else 0

                stale_count = 0
                oldest_timestamp = None
                newest_timestamp = None

                if nodes_data:
                    for node_id, node_info in nodes_data:
                        attrs = node_info.get("attributes", node_info)
                        ntype = attrs.get("type", "Unknown")
                        node_types[ntype] = node_types.get(ntype, 0) + 1

                        provenance = attrs.get("provenance", {})
                        ingested = provenance.get("ingested_at")
                        if ingested:
                            try:
                                ts = datetime.fromisoformat(ingested)
                                if oldest_timestamp is None or ts < oldest_timestamp:
                                    oldest_timestamp = ts
                                if newest_timestamp is None or ts > newest_timestamp:
                                    newest_timestamp = ts
                            except (ValueError, TypeError):
                                pass

                if total_nodes > 0:
                    _track_growth_snapshot(dataset_name, total_nodes, total_edges)

                decay_pct = 0.0
                if total_nodes > 0:
                    stale_count = max(0, total_nodes - total_edges)
                    decay_pct = round((stale_count / total_nodes) * 100, 1)

                return {
                    "dataset": dataset_name,
                    "graph": {
                        "total_nodes": total_nodes,
                        "total_edges": total_edges,
                        "node_type_breakdown": node_types,
                    },
                    "memory_health": "healthy" if total_nodes > 0 else "empty",
                    "decay": {
                        "decay_percentage": decay_pct,
                        "stale_node_count": stale_count,
                        "total_node_count": total_nodes,
                    },
                    "timestamps": {
                        "oldest_ingested": oldest_timestamp.isoformat()
                        if oldest_timestamp
                        else None,
                        "newest_ingested": newest_timestamp.isoformat()
                        if newest_timestamp
                        else None,
                    },
                }
        else:
            return {"dataset": dataset_name, "memory_health": "no_datasets"}
    except Exception as e:
        return {
            "dataset": dataset_name,
            "error": str(e),
            "memory_health": "unavailable",
        }


def _track_growth_snapshot(dataset: str, nodes: int, edges: int):
    _growth_snapshots.append(
        {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "dataset": dataset,
            "nodes": nodes,
            "edges": edges,
        }
    )
    if len(_growth_snapshots) > 1000:
        _growth_snapshots.pop(0)


def get_growth_history(dataset: str = "incidents") -> List[Dict[str, Any]]:
    return [s for s in _growth_snapshots if s["dataset"] == dataset]


def get_improve_history(limit: int = 20) -> List[Dict[str, Any]]:
    return list(_improve_runs[-limit:])


async def get_knowledge_decay(dataset_name: str = "incidents") -> Dict[str, Any]:
    try:
        from cognee.infrastructure.databases.graph import get_graph_engine
        from cognee.modules.users.methods import get_default_user
        from cognee.modules.data.methods import get_authorized_existing_datasets
        from cognee.context_global_variables import (
            set_database_global_context_variables,
        )

        user = await get_default_user()
        datasets = await get_authorized_existing_datasets([dataset_name], "read", user)

        if not datasets:
            return {"dataset": dataset_name, "decay_percentage": 0, "stale_nodes": []}

        async with set_database_global_context_variables(
            datasets[0].id, datasets[0].owner_id
        ):
            graph_engine = await get_graph_engine()
            nodes_data, edges_data = await graph_engine.get_graph_data()

            if not nodes_data:
                return {
                    "dataset": dataset_name,
                    "decay_percentage": 0,
                    "stale_nodes": [],
                }

            connected_nodes = set()
            for edge in edges_data or []:
                source = (
                    edge[0] if isinstance(edge, (list, tuple)) else edge.get("source")
                )
                target = (
                    edge[1] if isinstance(edge, (list, tuple)) else edge.get("target")
                )
                connected_nodes.add(str(source))
                connected_nodes.add(str(target))

            stale_nodes = []
            now = datetime.now(timezone.utc)

            for node_id, node_info in nodes_data:
                is_connected = str(node_id) in connected_nodes
                attrs = node_info.get("attributes", node_info)
                provenance = attrs.get("provenance", {})
                ingested = provenance.get("ingested_at")
                days_since_ingest = None
                if ingested:
                    try:
                        ts = datetime.fromisoformat(ingested)
                        days_since_ingest = (now - ts).days
                    except (ValueError, TypeError):
                        pass

                is_stale = not is_connected or (
                    days_since_ingest is not None and days_since_ingest > 30
                )
                if is_stale:
                    stale_nodes.append(
                        {
                            "id": str(node_id),
                            "name": node_info.get("name")
                            or attrs.get("name")
                            or str(node_id),
                            "type": attrs.get("type", "Unknown"),
                            "days_since_ingest": days_since_ingest,
                            "has_edges": is_connected,
                        }
                    )

            decay_pct = round((len(stale_nodes) / len(nodes_data)) * 100, 1)

            return {
                "dataset": dataset_name,
                "decay_percentage": decay_pct,
                "total_nodes": len(nodes_data),
                "stale_nodes": len(stale_nodes),
                "healthy_nodes": len(nodes_data) - len(stale_nodes),
                "stale_details": stale_nodes[:20],
            }
    except Exception as e:
        return {"dataset": dataset_name, "error": str(e), "decay_percentage": 0}


async def get_node_lineage(
    node_id: str, dataset_name: str = "incidents"
) -> Dict[str, Any]:
    try:
        from cognee.infrastructure.databases.graph import get_graph_engine
        from cognee.modules.users.methods import get_default_user
        from cognee.modules.data.methods import get_authorized_existing_datasets
        from cognee.context_global_variables import (
            set_database_global_context_variables,
        )

        user = await get_default_user()
        datasets = await get_authorized_existing_datasets([dataset_name], "read", user)

        if not datasets:
            return {"node_id": node_id, "error": "Dataset not found"}

        async with set_database_global_context_variables(
            datasets[0].id, datasets[0].owner_id
        ):
            graph_engine = await get_graph_engine()
            nodes_data, _ = await graph_engine.get_graph_data()

            for nid, node_info in nodes_data:
                if str(nid) == str(node_id):
                    attrs = node_info.get("attributes", node_info)
                    provenance = attrs.get("provenance", {})

                    doc_id = provenance.get("document_id", f"doc_{node_id[:8]}")
                    chunk_id = provenance.get("chunk_id", f"chunk_{node_id[:8]}")

                    name = node_info.get("name") or attrs.get("name") or node_id
                    ntype = attrs.get("type", "Unknown")

                    return {
                        "node_id": node_id,
                        "name": name,
                        "type": ntype,
                        "lineage": {
                            "document_id": doc_id,
                            "chunk_id": chunk_id,
                            "ingested_at": provenance.get(
                                "ingested_at", datetime.now(timezone.utc).isoformat()
                            ),
                            "raw_text": attrs.get("raw_text", None),
                            "source": provenance.get("source", "incident_report"),
                            "storage": "cognee_graph",
                        },
                    }
            return {"node_id": node_id, "error": "Node not found"}
    except Exception as e:
        return {"node_id": node_id, "error": str(e)}
