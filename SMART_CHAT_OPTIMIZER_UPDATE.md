# Qalvero Smart Chat Optimizer

This update improves the normal chat without changing QLO Agent behavior.

## What it does

- Returns deterministic local replies for tiny requests such as greetings, thanks, feature list, and identity questions.
- Uses a short-lived server-side response cache for safe repeated normal-chat questions.
- Keeps replies concise by default to reduce output tokens and provider credit usage.
- Does not cache sensitive content such as API keys, tokens, passwords, card-like numbers, emails, or long code blocks.
- Does not bypass safety, plan limits for real AI calls, or paid-model requirements.
- QLO Agent remains separate and is not counted under this optimizer.

## Environment variables

```env
QLO_SMART_CHAT_OPTIMIZER=true
QLO_SMART_LOCAL_REPLIES=true
QLO_RESPONSE_CACHE=true
QLO_RESPONSE_CACHE_HOURS=24
QLO_RESPONSE_CACHE_MAX_REPLY_CHARS=6000
```

## Supabase

Run `supabase/schema.sql` after deploying to add `qv_ai_response_cache` and cleanup helpers.

## Credit behavior

- Local optimized replies: no AI provider call.
- Cached safe replies: no AI provider call.
- New AI replies: normal credit rules apply.

This keeps the chat smarter and cheaper without making it look like a repeated template machine.
