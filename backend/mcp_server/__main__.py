#!/usr/bin/env python3
"""MemOps MCP Server — stdio transport for uvx / Claude Code local install."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mcp.server.fastmcp import FastMCP
from mcp_server.server import register_tools


def main():
    mcp = FastMCP(
        "MemOps SRE Memory",
        instructions=(
            "SRE memory platform powered by Cognee. Use get_trusted_context to "
            "recall trusted memories, audit_context for per-memory verdicts, "
            "remember to store facts, forget_memory to delete, improve_rules "
            "to distill rules, and list_incident_rules to retrieve them."
        ),
    )
    register_tools(mcp)
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
