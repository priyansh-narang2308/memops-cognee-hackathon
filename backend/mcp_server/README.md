# MemOps MCP Server

6 tools mapping to Cognee's 4 lifecycle verbs. Drop into any MCP-capable agent stack.

## Connect

### Claude Code — hosted (one line, no install)

```bash
claude mcp add --transport http memops http://localhost:8000/mcp
```

### Claude Code — local & private (uvx)

```bash
claude mcp add memops -- uvx --from "git+https://github.com/yourname/memops-cognee-hackathon#subdirectory=backend" mcp-server
```

### Cursor / Cline (~/.cursor/mcp.json)

```json
{ "mcpServers": { "memops": { "url": "http://localhost:8000/mcp" } } }
```

### Windsurf (~/.codeium/windsurf/mcp_config.json)

```json
{ "mcpServers": { "memops": { "serverUrl": "http://localhost:8000/mcp" } } }
```

## 6 Tools

| Tool                            | Cognee Verb | What it does                                                         |
| ------------------------------- | ----------- | -------------------------------------------------------------------- |
| `get_trusted_context(task)`     | recall      | Returns a trusted context pack: only memories that pass all 4 checks |
| `audit_context(task)`           | recall      | Per-memory verdicts — approved, blocked, the failing check and why   |
| `remember(text, subject, kind)` | remember    | Store a durable fact; secrets are auto-redacted at ingest            |
| `forget_memory(memory_id)`      | forget      | Delete a memory from graph + vector store                            |
| `improve_rules()`               | improve     | Distill reusable Rule nodes from recorded sessions                   |
| `list_incident_rules(query)`    | recall      | Retrieve distilled coding rules                                      |

## The Loop

1. Call `get_trusted_context` before you act
2. `remember` durable facts as you learn them
3. `improve_rules` when a task is done
4. `forget_memory` to retract anything that should never come back
