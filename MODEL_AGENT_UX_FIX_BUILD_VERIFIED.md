# Qalvero AI Model + Agent UX Fix

This update fixes the model routing defaults, improves the chat model selector, and hardens Agent exports.

## Changes

- Updated default Gemini model fallback from old 1.5 defaults to `gemini-2.0-flash` unless overridden by env vars.
- Kept environment override support for `GEMINI_FLASH_MODEL`, `GEMINI_PRO_MODEL`, `GEMINI_AGENT_MODEL`, and `QLO_AGENTS_MODEL`.
- Added premium model picker cards with model descriptions under each model name.
- Model picker closes automatically after selecting a model.
- Added stable package versions and Node 20 engine to Agent ZIP exports.
- Agent ZIP exports now include PWA manifest and service worker starter files.
- Agent credit-saving remains template-first: ready templates produce outputs without heavy model calls; custom/unmatched work still uses the Agent provider.
- Verified production build.

## Build check

Command used:

```bash
npm ci --ignore-scripts --no-audit --no-fund --legacy-peer-deps
npm run build
```

Result: TypeScript and Vite production build passed.

## Node note

The local container uses Node 22, so npm may show an EBADENGINE warning because the project is intentionally pinned to Node 20.x for Vercel. This is not a build failure.
