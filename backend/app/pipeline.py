from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel

import cognee
from cognee.modules.pipelines import Task
from cognee.tasks.storage import add_data_points
from cognee.infrastructure.llm.LLMGateway import LLMGateway
from cognee.infrastructure.engine import DataPoint

from app.models import (
    Service,
    FailureMode,
    Mitigation,
    Incident,
    Engineer,
    Alert,
    ArchitecturalDecision,
    Runbook,
)


class ServiceLLM(BaseModel):
    name: str
    team: str
    criticality: str
    slo_target: float
    dependencies: List[str] = []


class FailureModeLLM(BaseModel):
    name: str
    type: str
    description: str
    resolves_via_runbooks: List[str] = []


class MitigationLLM(BaseModel):
    name: str
    description: str
    command_to_run: Optional[str] = None
    efficacy: float = 1.0


class EngineerLLM(BaseModel):
    name: str
    team: str
    on_call_rotations: List[str] = []


class AlertLLM(BaseModel):
    source: str
    threshold: str
    triggered_at: str


class ADRLLM(BaseModel):
    decision: str
    rationale: str
    status: str
    date: str


class RunbookLLM(BaseModel):
    name: str
    steps: List[str] = []


class IncidentLLM(BaseModel):
    title: str
    severity: str
    start_time: str
    end_time: Optional[str] = None
    root_cause: Optional[str] = None
    post_mortem_url: Optional[str] = None
    affected_services: List[str] = []
    caused_by: List[str] = []
    mitigated_by: List[str] = []
    responded_by_engineers: List[str] = []
    triggered_alerts: List[str] = []


class IncidentTopologyLLM(BaseModel):
    services: List[ServiceLLM] = []
    failure_modes: List[FailureModeLLM] = []
    mitigations: List[MitigationLLM] = []
    engineers: List[EngineerLLM] = []
    alerts: List[AlertLLM] = []
    adrs: List[ADRLLM] = []
    runbooks: List[RunbookLLM] = []
    incidents: List[IncidentLLM] = []


class RawIncidentData(DataPoint):
    text: str
    source: str = "manual"
    ingested_at: str = ""
    metadata: dict = {"index_fields": ["text"]}


def _parse_datetime(s: str) -> Optional[datetime]:
    if not s:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


async def normalize_raw_text(data: List[RawIncidentData]) -> List[RawIncidentData]:
    for item in data:
        if not item.ingested_at:
            item.ingested_at = datetime.utcnow().isoformat()
        item.text = item.text.strip()
    return data


async def extract_entities(data: List[RawIncidentData]) -> List[Any]:
    system_prompt = (
        "You are an SRE AI expert. Extract the complete systems topology, incident timeline, "
        "personnel, alerts, architectural decisions, and runbooks from the provided text. "
        "Identify services, service dependencies, failure modes, mitigations (including "
        "self-healing commands if specified), engineers, alerts, architectural decisions, "
        "runbooks, and incident details. Map all references correctly using names. "
        "Include timestamps where present."
    )

    all_extracted = []

    for item in data:
        extracted = await LLMGateway.acreate_structured_output(
            item.text, system_prompt, IncidentTopologyLLM
        )

        services_map: Dict[str, Service] = {}
        failure_modes_map: Dict[str, FailureMode] = {}
        mitigations_map: Dict[str, Mitigation] = {}
        engineers_map: Dict[str, Engineer] = {}
        alerts_map: Dict[str, Alert] = {}
        adrs_map: Dict[str, ArchitecturalDecision] = {}
        runbooks_map: Dict[str, Runbook] = {}

        for s in extracted.services:
            services_map[s.name] = Service(
                name=s.name,
                team=s.team,
                criticality=s.criticality,
                slo_target=s.slo_target,
            )
            all_extracted.append(services_map[s.name])

        for f in extracted.failure_modes:
            failure_modes_map[f.name] = FailureMode(
                type=f.type, description=f.description
            )
            all_extracted.append(failure_modes_map[f.name])

        for m in extracted.mitigations:
            mitigations_map[m.name] = Mitigation(
                description=m.description,
                command_to_run=m.command_to_run,
                efficacy=m.efficacy,
            )
            all_extracted.append(mitigations_map[m.name])

        for e in extracted.engineers:
            engineers_map[e.name] = Engineer(
                name=e.name, team=e.team, on_call_rotations=e.on_call_rotations
            )
            all_extracted.append(engineers_map[e.name])

        for a in extracted.alerts:
            alerts_map[a.source] = Alert(
                source=a.source,
                threshold=a.threshold,
                triggered_at=_parse_datetime(a.triggered_at) or datetime.utcnow(),
            )
            all_extracted.append(alerts_map[a.source])

        for r in extracted.runbooks:
            runbooks_map[r.name] = Runbook(name=r.name, steps=r.steps)
            all_extracted.append(runbooks_map[r.name])

        for a in extracted.adrs:
            adrs_map[a.decision] = ArchitecturalDecision(
                decision=a.decision,
                rationale=a.rationale,
                status=a.status,
                date=_parse_datetime(a.date) or datetime.utcnow(),
            )
            all_extracted.append(adrs_map[a.decision])

        for s in extracted.services:
            service_obj = services_map[s.name]
            deps = [services_map[d] for d in s.dependencies if d in services_map]
            if deps:
                service_obj.depends_on = deps

        for f in extracted.failure_modes:
            fm_obj = failure_modes_map[f.name]
            runbooks = [
                runbooks_map[r] for r in f.resolves_via_runbooks if r in runbooks_map
            ]
            if runbooks:
                fm_obj.resolves_via = runbooks

        for i in extracted.incidents:
            incident_obj = Incident(
                title=i.title,
                severity=i.severity,
                start_time=_parse_datetime(i.start_time) or datetime.utcnow(),
                end_time=_parse_datetime(i.end_time),
                root_cause=i.root_cause,
                post_mortem_url=i.post_mortem_url,
            )
            incident_obj.affected_services = [
                services_map[s] for s in i.affected_services if s in services_map
            ] or None
            incident_obj.caused_by = [
                failure_modes_map[f] for f in i.caused_by if f in failure_modes_map
            ] or None
            incident_obj.mitigated_by = [
                mitigations_map[m] for m in i.mitigated_by if m in mitigations_map
            ] or None
            incident_obj.responded_by = [
                engineers_map[e] for e in i.responded_by_engineers if e in engineers_map
            ] or None
            incident_obj.triggered_alerts = [
                alerts_map[a] for a in i.triggered_alerts if a in alerts_map
            ] or None
            all_extracted.append(incident_obj)

    return all_extracted


async def extract_temporal_events(data: List[Any]) -> List[Any]:
    for obj in data:
        if isinstance(obj, Incident) and obj.start_time:
            if "temporal_events" not in obj.metadata:
                obj.metadata["temporal_events"] = []
            obj.metadata["temporal_events"].append(
                {
                    "type": "incident_start",
                    "timestamp": obj.start_time.isoformat(),
                    "label": obj.title,
                }
            )
            if obj.end_time:
                obj.metadata["temporal_events"].append(
                    {
                        "type": "incident_end",
                        "timestamp": obj.end_time.isoformat(),
                        "label": f"{obj.title} resolved",
                    }
                )
        if isinstance(obj, ArchitecturalDecision) and obj.date:
            if "temporal_events" not in obj.metadata:
                obj.metadata["temporal_events"] = []
            obj.metadata["temporal_events"].append(
                {
                    "type": "decision_made",
                    "timestamp": obj.date.isoformat(),
                    "label": obj.decision,
                }
            )
        if isinstance(obj, Alert) and obj.triggered_at:
            if "temporal_events" not in obj.metadata:
                obj.metadata["temporal_events"] = []
            obj.metadata["temporal_events"].append(
                {
                    "type": "alert_triggered",
                    "timestamp": obj.triggered_at.isoformat(),
                    "label": f"{obj.source} exceeded {obj.threshold}",
                }
            )
    return data


async def validate_against_ontology(data: List[Any]) -> List[Any]:
    from pathlib import Path

    ontology_path = Path(__file__).parent.parent / "ontology" / "itil_subset.ttl"
    ontology_classes = set()

    if ontology_path.exists():
        try:
            import rdflib

            g = rdflib.Graph()
            g.parse(str(ontology_path), format="turtle")
            for s in g.subjects(predicate=rdflib.RDF.type, object=rdflib.RDFS.Class):
                label = str(s).split("#")[-1] if "#" in str(s) else str(s).split("/")[-1]
                ontology_classes.add(label.lower())
        except Exception:
            pass

    ontology_mapping = {
        "Incident": "itil:Incident",
        "Service": "itil:Service",
        "FailureMode": "itil:FailureMode",
        "Mitigation": "itil:Mitigation",
    }
    for obj in data:
        class_name = type(obj).__name__
        if class_name in ontology_mapping:
            if "ontology" not in obj.metadata:
                obj.metadata["ontology"] = {}
            mapped_class = ontology_mapping[class_name]
            raw_class = mapped_class.split(":")[-1].lower()
            obj.metadata["ontology"]["ontology_valid"] = (
                raw_class in ontology_classes if ontology_classes else True
            )
            obj.metadata["ontology"]["class"] = mapped_class
    return data


async def extract_service_dependencies(data: List[Any]) -> List[Any]:
    service_map = {}
    for obj in data:
        if isinstance(obj, Service):
            service_map[obj.name] = obj

    for obj in data:
        if isinstance(obj, Incident) and obj.affected_services:
            for svc in obj.affected_services:
                if isinstance(svc, Service) and svc.name in service_map:
                    if "dependents" not in obj.metadata:
                        obj.metadata["dependents"] = []
                    obj.metadata["dependents"].append(svc.name)

    return data


async def add_provenance_tracking(data: List[Any]) -> List[Any]:
    for obj in data:
        if "provenance" not in obj.metadata:
            obj.metadata["provenance"] = {}
        obj.metadata["provenance"]["source_type"] = "incident_report"
        obj.metadata["provenance"]["ingested_at"] = datetime.utcnow().isoformat()
    return data


async def run_ingestion_pipeline(
    text: str,
    dataset_name: str = "incidents",
    node_set: Optional[List[str]] = None,
):
    input_data = [RawIncidentData(text=text)]

    tasks = [
        Task(normalize_raw_text),
        Task(extract_entities),
        Task(extract_temporal_events),
        Task(validate_against_ontology),
        Task(extract_service_dependencies),
        Task(add_provenance_tracking),
        Task(add_data_points),
    ]

    await cognee.run_custom_pipeline(
        tasks=tasks,
        data=input_data,
        dataset=dataset_name,
    )

    await cognee.improve(
        dataset=dataset_name,
        build_global_context_index=True,
    )

    try:
        from cognee.tasks.temporal_graph import (
            enrich_events,
            add_entities_to_event,
        )

        llm = LLMGateway.get_default_instance()
        graph_engine = await cognee.infrastructure.databases.graph.get_graph_engine()

        user = await cognee.modules.users.methods.get_default_user()
        datasets = await cognee.modules.data.methods.get_authorized_existing_datasets(
            [dataset_name], "read", user
        )
        if datasets:
            dataset_id = str(datasets[0].id)
            nodes_data, edges_data = await graph_engine.get_graph_data()

            events = []
            for node_id, node_info in nodes_data:
                attrs = node_info.get("attributes", node_info)
                temporal = attrs.get("temporal_events", [])
                for te in temporal:
                    events.append({
                        "event_type": te.get("event_type", "unknown"),
                        "timestamp": te.get("timestamp"),
                        "description": te.get("description", ""),
                        "source_node": str(node_id),
                    })

            if events:
                enriched = await enrich_events(events, llm)
                entity_events = await add_entities_to_event(enriched, llm)
                for item in entity_events:
                    event_node_id = f"event_{item.get('event_type', 'unknown')}_{item.get('timestamp', '')}"
                    await graph_engine.add_node(
                        event_node_id,
                        node_properties={
                            "type": "TemporalEvent",
                            "event_type": item.get("event_type"),
                            "timestamp": item.get("timestamp"),
                            "description": item.get("description"),
                            "source_node": item.get("source_node"),
                        },
                    )
                    if item.get("source_node"):
                        await graph_engine.add_edge(
                            item["source_node"],
                            event_node_id,
                            edge_properties={"type": "HAS_TEMPORAL_EVENT"},
                        )
    except Exception:
        pass
