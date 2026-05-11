# Qalvero AI Personal API Keys / BYOK Update

This update adds a hidden Advanced Settings section that lets eligible users add their own AI API key.

## What it does

- Adds a Personal AI key section inside Settings → Advanced options.
- Supports Gemini, OpenRouter, Groq, and DeepSeek.
- Stores the key locally on the user's device only.
- Sends the key to Qalvero serverless API only at request time.
- Lets the user use the key for normal chat and optionally for QLO 1.3 Agent.
- Adds validation, allowlisted providers, model-name validation, and a test button.

## Conditions enforced by the server

- User must be signed in.
- User plan must be Standard, Premium, or Max.
- Provider must be allowlisted.
- No custom API endpoint is accepted.
- The key does not bypass safety filters.
- The key does not bypass Agent daily limits.
- The key is not stored in Supabase by this feature.

## Notes

The key is obfuscated in localStorage only to avoid casual exposure in the UI. This is not the same as encryption. For production users, clearly explain that browser storage is device-local and should only be used on trusted devices.
