from typing import List, Dict, Any
from pydantic import BaseModel
import cognee
from cognee.infrastructure.llm.LLMGateway import LLMGateway


class InvestigationResult(BaseModel):
    similar_incidents: List[str]
    likely_failure_modes: List[str]
    recommended_mitigations: List[str]


@cognee.agent_memory(
    agent_session_name="on_call_sre",
    with_memory=True,
    save_session_traces=True,
    memory_query_fixed="What historical incidents, failure modes, and mitigations are relevant to this incident?",
    dataset_name="incidents",
    session_id="on_call_sre_session",
    memory_top_k=10,
)
async def on_call_sre_agent(incident_payload: str) -> Dict[str, Any]:
    system_prompt = (
        "You are an on-call SRE agent with access to historical incident memory. "
        "Analyze the current incident description and provide:\n"
        "1. Similar past incidents and their root causes\n"
        "2. Known failure modes that match this pattern\n"
        "3. Recommended mitigations from past successes\n"
        "Base your response on the retrieved memory context."
    )
    response = await LLMGateway.acreate_structured_output(
        text=incident_payload,
        system_prompt=system_prompt,
        response_model=InvestigationResult,
    )
    return response.model_dump()


class PostMortemAnalysis(BaseModel):
    root_cause: str
    severity: str
    affected_services: List[str]
    failure_modes: List[str]
    mitigations: List[str]
    recommendations: List[str]
    similar_past_incidents: List[str] = []


@cognee.agent_memory(
    agent_session_name="post_mortem_analyzer",
    with_memory=True,
    save_session_traces=True,
    memory_query_from_method="incident_text",
    dataset_name="incidents",
    memory_top_k=15,
)
async def post_mortem_analyzer_agent(incident_text: str) -> Dict[str, Any]:
    system_prompt = (
        "You are a post-mortem analysis agent. Given an incident description and "
        "retrieved historical context from the knowledge graph, produce a structured "
        "analysis covering: root cause, timeline, affected services, failure modes, "
        "mitigations applied, recommendations to prevent recurrence."
    )

    analysis = await LLMGateway.acreate_structured_output(
        text=incident_text,
        system_prompt=system_prompt,
        response_model=PostMortemAnalysis,
    )
    return analysis.model_dump()


async def on_call_sre_agent_direct(incident_text: str) -> Dict[str, Any]:
    return await on_call_sre_agent(incident_text)
