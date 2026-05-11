# QLO Model Name Language Update

This update enforces a strict naming rule across the chat model, QLO Agent, training dataset capture, and Google Cloud dataset export.

## Rule

QLO product and model names must always be written in English exactly, even when the response language is Arabic, French, Spanish, German, Turkish, Japanese, or any other language.

Allowed canonical names:

- QLO
- Qalvero AI
- QLO 1.2 Flash
- QLO 1.2 Study
- QLO 1.2 Pro
- QLO 1.3 Flash
- QLO 1.3 Pro
- QLO 1.3 Agent

## What changed

- Added the rule to the main QLO chat system prompt.
- Added the rule to the QLO Agent system prompt.
- Added output cleanup to convert common Arabic transliterations like “كيو إل أو” back to `QLO`.
- Added the same cleanup before saving QLO training examples.
- Added the rule to Google Cloud exported training dataset system messages.
- Production build was verified successfully with `npm run build`.
