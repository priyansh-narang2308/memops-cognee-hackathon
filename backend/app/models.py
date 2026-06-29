from typing import Any, Optional, List
from datetime import datetime
from pydantic import SkipValidation
from cognee.infrastructure.engine import DataPoint


class Service(DataPoint):
    name: str
    team: str
    criticality: str  # P0, P1, P2
    slo_target: float
    last_incident: Optional[datetime] = None
    depends_on: SkipValidation[Any] = None  # Service or list[Service]
    node_set: Optional[List[str]] = None
    metadata: dict = {"index_fields": ["name", "team"]}


class FailureMode(DataPoint):
    type: str
    description: str
    frequency_days: Optional[float] = None
    first_seen: Optional[datetime] = None
    resolves_via: SkipValidation[Any] = None  # Runbook or list[Runbook]
    node_set: Optional[List[str]] = None
    metadata: dict = {"index_fields": ["type", "description"]}


class Mitigation(DataPoint):
    description: str
    command_to_run: Optional[str] = None
    efficacy: float = 1.0
    applied_at: Optional[datetime] = None
    node_set: Optional[List[str]] = None
    metadata: dict = {"index_fields": ["description", "command_to_run"]}


class Incident(DataPoint):
    title: str
    severity: str
    start_time: datetime
    end_time: Optional[datetime] = None
    root_cause: Optional[str] = None
    post_mortem_url: Optional[str] = None
    service_names: List[str] = []
    ontology_class: str = "itil:Incident"
    affected_services: SkipValidation[Any] = None
    caused_by: SkipValidation[Any] = None
    mitigated_by: SkipValidation[Any] = None
    responded_by: SkipValidation[Any] = None
    triggered_alerts: SkipValidation[Any] = None
    node_set: Optional[List[str]] = None
    metadata: dict = {"index_fields": ["title", "root_cause", "severity"]}


class Engineer(DataPoint):
    name: str
    team: str
    on_call_rotations: List[str] = []
    node_set: Optional[List[str]] = None
    metadata: dict = {"index_fields": ["name", "team"]}


class Alert(DataPoint):
    source: str
    threshold: str
    triggered_at: datetime
    resolved_at: Optional[datetime] = None
    node_set: Optional[List[str]] = None
    metadata: dict = {"index_fields": ["source", "threshold"]}


class ArchitecturalDecision(DataPoint):
    decision: str
    rationale: str
    status: str  # proposed, accepted, deprecated, superseded
    date: datetime
    informed_by: SkipValidation[Any] = None
    node_set: Optional[List[str]] = None
    metadata: dict = {"index_fields": ["decision", "rationale", "status"]}


class Runbook(DataPoint):
    name: str
    steps: List[str] = []
    last_validated: Optional[datetime] = None
    node_set: Optional[List[str]] = None
    metadata: dict = {"index_fields": ["name"]}


class PostMortem(DataPoint):
    url: str
    incident_id: str
    summary: str
    authored_at: datetime
    key_findings: List[str] = []
    node_set: Optional[List[str]] = None
    metadata: dict = {"index_fields": ["url", "summary"]}


class IncidentSummary(DataPoint):
    incident_title: str
    summary_text: str
    key_findings: List[str] = []
    generated_at: Optional[datetime] = None
    source_incident: SkipValidation[Any] = None
    metadata: dict = {"index_fields": ["incident_title", "summary_text"]}
