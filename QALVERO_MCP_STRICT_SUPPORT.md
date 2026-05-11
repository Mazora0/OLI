# Qalvero AI MCP Strict Support

This update adds a real MCP-compatible layer for Qalvero AI without exposing unsafe execution to users.

## What was added

- `/api/mcp` — Qalvero MCP-compatible stateless JSON-RPC HTTP endpoint.
- `/api/qlo-mcp` — secure bridge/status endpoint for local and allowlisted remote MCP servers.
- Local Qalvero MCP tools:
  - `qlo.project.plan`
  - `qlo.project.scaffold`
  - `qlo.game.2d`
  - `qlo.office.pack`
  - `qlo.apk.prepare`
  - `qlo.code.review`
  - `qlo.research.sources`
  - `qlo.safety.validate`
- MCP resources:
  - `qalvero://docs/mcp-security`
  - `qalvero://docs/agent-tools`
  - `qalvero://patterns/catalog`
- MCP prompts:
  - `qlo_project_builder`
  - `qlo_code_review`
  - `qlo_research_pdf`
  - `qlo_apk_builder`
- Settings page MCP status panel under Advanced options.
- Agent instructions now understand MCP as a real Qalvero tool family.
- Agent ZIP exports now include MCP integration docs and a small MCP client helper.

## Strict security decisions

- No chat-triggered STDIO execution.
- No arbitrary local shell commands from MCP.
- No localhost or private network MCP URLs.
- Remote MCP servers must be allowlisted in `QLO_MCP_SERVERS_JSON`.
- Remote non-HTTPS endpoints are blocked unless `QLO_MCP_ALLOW_HTTP=true`.
- Secrets are read from environment variables only, not from browser code.

## Environment variables

```env
QLO_MCP_ENABLED=true
QLO_MCP_API_KEY=
QLO_MCP_ALLOWED_ORIGIN=*
QLO_MCP_PROTOCOL_VERSION=2025-06-18
QLO_MCP_SERVERS_JSON=[]
QLO_MCP_ALLOW_HTTP=false
```

Example remote allowlist:

```json
[
  {
    "id": "docs",
    "name": "Docs MCP",
    "url": "https://example.com/mcp",
    "tokenEnv": "DOCS_MCP_TOKEN",
    "enabled": true
  }
]
```

Put `DOCS_MCP_TOKEN` in Vercel Environment Variables. Do not put tokens inside the JSON.

## Quick tests

Initialize:

```bash
curl -X POST https://YOUR_DOMAIN/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

List tools:

```bash
curl -X POST https://YOUR_DOMAIN/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

Call a tool:

```bash
curl -X POST https://YOUR_DOMAIN/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"qlo.project.plan","arguments":{"request":"Build a store","target":"web"}}}'
```

If `QLO_MCP_API_KEY` is set, add:

```bash
-H "Authorization: Bearer YOUR_KEY"
```

## Production note

This implementation is designed for Vercel/serverless deployment. It focuses on safe HTTP JSON-RPC compatibility and does not spawn local MCP processes.
