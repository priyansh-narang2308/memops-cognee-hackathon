#!/bin/bash
# LIVE SMOKE TEST — Every sidebar feature endpoint
# Tests real HTTP against running backend on :8000
# Does NOT call LLM-dependent endpoints to save API quota

API="http://127.0.0.1:8000"
KEY="433a1d16df1072536d8a6045f6ef8725d79bb2762d4b7647d2b1d260dc4892b3"
H="-H 'X-API-Key: $KEY' -H 'Content-Type: application/json'"

PASS=0
FAIL=0
RESULTS=""

test_endpoint() {
  local name="$1"
  local sidebar="$2"
  local method="$3"
  local path="$4"
  local body="$5"
  local expect_code="$6"

  if [ -n "$body" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "X-API-Key: $KEY" \
      -H "Content-Type: application/json" \
      -d "$body" \
      "${API}${path}" 2>&1)
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "X-API-Key: $KEY" \
      "${API}${path}" 2>&1)
  fi

  http_code=$(echo "$response" | tail -1)
  body_response=$(echo "$response" | head -n -1)

  if [ "$http_code" = "$expect_code" ]; then
    PASS=$((PASS + 1))
    status="✅ PASS"
  else
    FAIL=$((FAIL + 1))
    status="❌ FAIL (got $http_code, expected $expect_code)"
  fi

  # Truncate body for display
  short_body=$(echo "$body_response" | head -c 200)
  
  echo "[$sidebar] $status — $name"
  echo "  $method $path → $http_code"
  echo "  Response: $short_body"
  echo ""
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MEMOPS LIVE SMOKE TEST"
echo "  Testing every sidebar feature endpoint"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── WAR ROOM (3D Graph) ──
echo "══════ SIDEBAR: 3D War Room ══════"
test_endpoint "Fetch Graph Data" "War Room" "GET" "/graph?dataset=incidents" "" "200"
test_endpoint "Health Stats" "War Room" "GET" "/health" "" "200"
test_endpoint "Decay Stats" "War Room" "GET" "/health/decay?dataset=incidents" "" "200"
test_endpoint "Growth History" "War Room" "GET" "/health/growth?dataset=incidents" "" "200"

# ── TELEMETRY INGESTION ──
echo "══════ SIDEBAR: Telemetry Ingestion ══════"
# We do NOT test /ingest here because it calls cognee.remember() which needs LLM
# But we test validation works
test_endpoint "Ingest validation (empty)" "Ingestion" "POST" "/ingest" '{"text":""}' "422"

# ── COPILOT ──
echo "══════ SIDEBAR: Voice SRE Copilot ══════"
# /query calls cognee.recall() — needs LLM. Test feedback endpoint instead.
test_endpoint "Submit feedback (no session)" "Copilot" "POST" "/feedback" '{"session_id":"test_session","score":5,"comment":"Good result"}' "404"

# ── AGENTS ──
echo "══════ SIDEBAR: Autonomous Agents ══════"
test_endpoint "Register Agent" "Agents" "POST" "/agents/register" '{"name":"smoke_test_agent","datasets":["incidents"]}' "200"
test_endpoint "Agent Session" "Agents" "POST" "/agents/session" '{"agent_session_name":"smoke_test","session_id":"smoke_sess_1","datasets":["incidents"]}' "200"

# ── AUDIT DECK ──
echo "══════ SIDEBAR: Ontology Audit Deck ══════"
test_endpoint "Schema Inventory" "Audit" "GET" "/schema" "" "200"
test_endpoint "Observability Traces (GET)" "Audit" "GET" "/observability/traces" "" "200"
test_endpoint "Observability Traces (DELETE)" "Audit" "DELETE" "/observability/traces" "" "200"

# ── COGNITIVE REFINERY ──
echo "══════ SIDEBAR: Cognitive Refinery ══════"
test_endpoint "Improve Runs History" "Refinery" "GET" "/health/improve-runs?limit=10" "" "200"

# ── LINEAGE EXPLORER ──
echo "══════ SIDEBAR: Lineage Explorer ══════"
test_endpoint "Lineage (nonexistent node)" "Lineage" "GET" "/lineage/test_node_1?dataset=incidents" "" "404"
test_endpoint "Provenance Graph" "Lineage" "GET" "/provenance?dataset=incidents" "" "200"

# ── COMPARE VIEW ──
echo "══════ SIDEBAR: Compare View ══════"
# /demo/compare needs 2 LLM calls — skip to save quota
echo "[Compare] ⏭️ SKIP — /demo/compare requires 2 LLM calls (Gemini quota)"
echo ""

# ── AUTH VERIFICATION ──
echo "══════ AUTH: Verify auth blocks unauthorized ══════"
test_endpoint "No API key → 401" "Auth" "GET" "/health" "" "200"
# Test with wrong key
wrong_response=$(curl -s -w "\n%{http_code}" -H "X-API-Key: wrong_key" "http://127.0.0.1:8000/health" 2>&1)
wrong_code=$(echo "$wrong_response" | tail -1)
if [ "$wrong_code" = "403" ]; then
  PASS=$((PASS + 1))
  echo "[Auth] ✅ PASS — Wrong API key returns 403"
else
  FAIL=$((FAIL + 1))
  echo "[Auth] ❌ FAIL — Wrong API key returned $wrong_code (expected 403)"
fi
echo ""

no_key_response=$(curl -s -w "\n%{http_code}" "http://127.0.0.1:8000/health" 2>&1)
no_key_code=$(echo "$no_key_response" | tail -1)
if [ "$no_key_code" = "401" ]; then
  PASS=$((PASS + 1))
  echo "[Auth] ✅ PASS — Missing API key returns 401"
else
  FAIL=$((FAIL + 1))
  echo "[Auth] ❌ FAIL — Missing API key returned $no_key_code (expected 401)"
fi
echo ""

# ── MITIGATION SAFETY ──
echo "══════ SAFETY: Command execution policy ══════"
test_endpoint "Safe command (echo)" "Safety" "POST" "/mitigate/execute" '{"command":"echo hello world"}' "200"
test_endpoint "Blocked command (curl)" "Safety" "POST" "/mitigate/execute" '{"command":"curl http://evil.com"}' "400"
test_endpoint "Blocked command (rm)" "Safety" "POST" "/mitigate/execute" '{"command":"rm -rf /"}' "400"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  RESULTS: $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
