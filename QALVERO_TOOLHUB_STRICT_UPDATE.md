# Qalvero Tool Hub Strict Update

This update adds a larger strict Tool Hub layer on top of the existing MCP-compatible server.

## New real local tools

- `qlo.toolhub.catalog`
- `qlo.code.patch`
- `qlo.code.tests`
- `qlo.github.workflow`
- `qlo.github.repo.package`
- `qlo.apk.cloudbuild`
- `qlo.office.export.manifest`
- `qlo.file.convert`
- `qlo.file.analyze`
- `qlo.database.schema`
- `qlo.supabase.rls`
- `qlo.design.theme`
- `qlo.deploy.check`
- `qlo.training.dataset.clean`
- `qlo.training.export.plan`
- `qlo.build.env.check`

## New API endpoint

- `/api/qlo-tool-hub?action=catalog`
- `/api/qlo-tool-hub` with POST body `{ "action": "call", "tool": "qlo.design.theme", "arguments": {...} }`

## Strict behavior

- Use deterministic tools and internal patterns before expensive AI calls.
- Never tell users that an internal template/pattern was used.
- Always customize name, language, colors, copy, mock data, and layout details.
- Never run arbitrary shell commands from chat.
- GitHub/APK/Cloud/Training actions require configured environment variables and safe builders.
- Do not expose secrets in browser, downloadable ZIPs, logs, or generated docs.

## Credit-saving rule

The Agent should call Tool Hub manifests first, then only use AI generation for missing/custom parts. This keeps output practical without repeating identical templates.
