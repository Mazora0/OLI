# Qalvero AI Production Preflight Fixes

This update adds a strict production preflight checker and fixes the environment example so deployment mistakes are easier to catch before users hit them.

## Added

- `/api/qlo-preflight`
  - Admin-only health/preflight endpoint.
  - Checks Node.js 22.x runtime.
  - Checks Supabase URL, anon key, and service role.
  - Checks required Supabase tables.
  - Checks normal AI provider keys.
  - Checks Agent key or fallback availability.
  - Checks web search, Google Cloud, APK builder, MCP, and rate-limit settings.

- Admin Dashboard preflight card
  - Shows OK / warnings / blockers.
  - Gives clear deploy instructions when something is missing.

## Fixed

- Cleaned duplicate variables in `.env.example`.
- Kept Max limits consistent.
- Added a production preflight note to `.env.example`.

## After deploy

1. Set `QLO_ADMIN_EMAILS` in Vercel.
2. Redeploy.
3. Login using the same Supabase email.
4. Open `/admin`.
5. Run **Production preflight**.
6. Fix any blocker shown in the panel.

## Build verification

Tested with:

```bash
npm run build
```

Result: TypeScript and Vite production build passed.
