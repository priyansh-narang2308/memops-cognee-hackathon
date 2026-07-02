# MemOps Demo Script — 60 Seconds

## Setup (0:00 - 0:05)
**Screen:** Landing page with animated 3D graph
**Narration:** "MemOps — AI that never forgets an incident. Powered by Cognee Cloud."

## Beat 1: Load Demo Data (0:05 - 0:12)
**Action:** Click "Load Demo Data" button
**Screen:** Toast shows "Loading demo incident datasets into Cognee..."
**Narration:** "Six real SRE incidents flow through Cognee's 7-task custom pipeline — entity extraction, temporal events, ITIL ontology validation, dependency mapping."

## Beat 2: 3D Blast Radius (0:12 - 0:22)
**Action:** Click a service node → Click "Simulate Outage"
**Screen:** Node turns red, BFS cascade lights up amber, edges pulse
**Narration:** "Click any service. Simulate an outage. Watch the blast radius cascade through the knowledge graph in real-time — three hops of institutional knowledge, visible."

## Beat 3: Voice Copilot (0:22 - 0:32)
**Action:** Type "What caused the last database failure?" in the copilot
**Screen:** Response appears with Trust Score badge, traces, mitigation proposal
**Narration:** "Ask the voice copilot. Cognee traverses the graph — not keyword search, graph traversal. Every answer comes with a trust score, execution traces, and a one-click mitigation."

## Beat 4: Agent Invocation (0:32 - 0:42)
**Action:** Click "Agents" tab → Click "Invoke On-Call SRE Agent"
**Screen:** Agent returns structured analysis with similar incidents, failure modes, mitigations
**Narration:** "Invoke the @cognee.agent_memory decorated SRE agent. It auto-injects historical graph context — similar past incidents, known failure modes, proven mitigations."

## Beat 5: MCP Connection (0:42 - 0:50)
**Action:** Show terminal with `claude mcp add --transport http memops http://localhost:8000/mcp`
**Screen:** Terminal output showing 6 tools registered
**Narration:** "Drop into any MCP-capable agent stack with one line. Six tools — get_trusted_context, audit_context, remember, forget, improve_rules, list_incident_rules."

## Beat 6: Memory Evolution (0:50 - 0:57)
**Action:** Click "Refinery" tab → Click "Run Memory Evolution"
**Screen:** Improve pipeline runs, graph strengthens
**Narration:** "Run the cognitive refinery. Cognee's improve() distills rules from sessions, strengthens graph edges, bridges session learnings into permanent institutional memory."

## Close (0:57 - 1:00)
**Screen:** Back to 3D graph, full knowledge graph visible
**Narration:** "MemOps. Every incident remembered. Every fix compounds. Built on Cognee Cloud."
**Text overlay:** "github.com/yourname/memops-cognee-hackathon"

---

## Key Differentiators to Emphasize
1. **Cognee Cloud** — all operations route to api.cognee.ai
2. **MCP Server** — one-line install for Claude Code, Cursor, Windsurf
3. **4 Cognee verbs** — remember, recall, improve, forget (all exercised)
4. **Trust scoring** — every memory has a trust score
5. **Secret auto-redaction** — credentials detected and stripped at ingest
6. **Temporal supersession** — newer memories replace older ones
7. **7-task custom pipeline** — not just cognee.remember()
8. **10 SearchTypes** — GRAPH_COMPLETION, TEMPORAL, TRIPLET, VECTOR, RAG, COT, DECOMP, NL, SUMMARIES, HYBRID
9. **60 tests** — all passing
10. **@cognee.agent_memory** — agents with auto-injected historical context
