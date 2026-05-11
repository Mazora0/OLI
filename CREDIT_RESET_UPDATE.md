# Credit Reset Update

This update changes normal QLO chat/model credits to reset every 6 hours.

## Policy

- QLO 1.2 Flash, QLO 1.2 Study, QLO 1.2 Pro, QLO 1.3 Flash, and QLO 1.3 Pro reset every 6 hours.
- Guest/demo chat usage also resets by 6-hour windows.
- QLO 1.3 Agent is excluded from the 6-hour reset and remains daily.

## Environment variable

```env
QLO_CREDIT_RESET_HOURS=6
```

## Supabase

The schema now sets `qv_ai_usage.reset_date` and `qv_model_usage.reset_date` defaults to `now() + interval '6 hours'`.

If your Supabase project already exists, run the updated `supabase/schema.sql` once in the SQL Editor so the default changes apply.
