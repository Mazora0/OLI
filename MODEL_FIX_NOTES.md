# Qalvero AI Model Connection Fix

This update fixes model routing failures caused by a single hardcoded default model name.

## What changed

- Normal chat now accepts `GEMINI_API_KEY`, `GOOGLE_API_KEY`, or `GOOGLE_GENERATIVE_AI_API_KEY`.
- Gemini routing now tries the configured model first, then fallback candidates:
  - `gemini-2.5-flash`
  - `gemini-2.0-flash`
  - `gemini-1.5-flash-latest`
  - `gemini-1.5-flash`
- Groq routing now tries multiple configured/fallback models instead of failing on one unavailable model.
- QLO Agent now falls back to normal configured AI keys if `QLO_AGENTS_API_KEY` is empty, so the Agent does not appear broken during setup.
- Added `/api/qlo-health` to check whether server-side AI keys are configured without exposing secrets.
- `.env.example` now leaves Gemini model names empty by default so Qalvero can auto-fallback.

## Recommended Vercel setup

At minimum, add one working provider key:

```env
GEMINI_API_KEY=your_key_here
```

Optional, only if you know the exact model enabled for your account:

```env
GEMINI_FLASH_MODEL=
GEMINI_PRO_MODEL=
QLO_AGENTS_MODEL=
```

Keep these empty if the model connection fails, because Qalvero will auto-try safe fallback models.

## Health check

After deploy, open:

```txt
/api/qlo-health
```

It should show which provider groups are configured. It never returns the actual keys.

## Build verification

Build was verified with:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run build
```

The build passed. Local environment used Node 22, while the project is set to Node 20.x, so Vercel should use Node 20.x.
