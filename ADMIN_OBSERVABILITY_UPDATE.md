# Qalvero Admin + Observability Update

This update adds the operational layer that Qalvero needs before scaling usage.

## Added

- Admin dashboard route: `/admin`
- Admin API: `/api/qlo-admin`
- Usage telemetry table: `qv_usage_events`
- Error logs table: `qv_error_logs`
- API rate limit table: `qv_api_rate_limits`
- Agent jobs table foundation: `qv_agent_jobs`
- Rate limiting for:
  - `/api/qalvero-ai`
  - `/api/qlo-agents`
- Usage logging for:
  - local replies
  - cached replies
  - normal AI replies
  - Agent internal pattern builds
  - Agent provider builds
- Error logging for failed chat and Agent calls
- Cleanup action from Admin dashboard for old logs and expired cache

## Required env

```env
QLO_ADMIN_EMAILS=your-admin-email@example.com
QLO_CHAT_RATE_LIMIT_PER_MINUTE=45
QLO_AGENT_RATE_LIMIT_PER_MINUTE=12
QLO_LOG_RETENTION_DAYS=30
```

## Required Supabase step

Run `supabase/schema.sql` again in Supabase SQL Editor.

The dashboard is locked until `QLO_ADMIN_EMAILS` is configured.
