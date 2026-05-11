# Qalvero AI Local-First Retention Update

This update keeps Qalvero aligned with realistic free-tier limits:

- Supabase is treated as compact cloud sync, not unlimited chat storage.
- Vercel serverless APIs stay small and bounded for Hobby-style deployment.
- Cloud chat history is cleaned after 10 days.
- Free-plan local chat history is automatically pruned after 60 days.
- Paid plans keep longer local history on the user device.
- Long-term chat history remains local-first on the user's device/account.

## New API

`/api/qlo-chat-history`

- `POST`: compact sync of one chat thread to Supabase.
- `GET`: reads compact cloud history for the signed-in user.
- `DELETE`: clears cloud chat history for the signed-in user.

The API also runs a user-level cleanup pass on every request so expired cloud history is removed without requiring a cron job.

## Environment variables

```env
QLO_CLOUD_CHAT_RETENTION_DAYS=10
QLO_CLOUD_CHAT_THREAD_LIMIT=50
QLO_CLOUD_CHAT_MESSAGES_PER_THREAD=80
QLO_CLOUD_CHAT_CONTENT_CHARS=6000
```

## Supabase

Run `supabase/schema.sql` again. It adds:

- `qv_chat_threads.storage_policy`
- `qv_chat_threads.expires_at`
- chat history indexes
- `qv_cleanup_expired_chat_history()` helper function

## User-facing behavior

- The app stores recent/longer chat history locally first.
- The cloud copy is compact and short-lived.
- Free users get local cleanup after 60 days.
- Advanced settings now show storage status and clear buttons.
