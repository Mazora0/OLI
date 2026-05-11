# Smart Reply + Single Flight Fix

This update fixes duplicate/mixed replies and improves credit saving.

## What changed

- Added a hard single-flight guard in the chat UI so fast double tap / Enter cannot start two AI requests before React state updates.
- Normal chat now returns one coherent answer only and avoids duplicated provider-style replies.
- QLO Agent parallel mode is disabled by default. It only runs parallel roles if `QLO_AGENT_ALLOW_PARALLEL=true` is explicitly set.
- Normal chat uses a smart token budget:
  - Short, direct answers by default.
  - Larger budget only for detailed requests, research, full code, or project work.
- Temperature is reduced for cleaner, less messy answers.
- Agent still expands when needed for Office, ZIP, JSX, HTML, PWA, desktop, or full project outputs.

## Credit behavior

Longer responses generally use more output tokens on most AI APIs, so concise default replies reduce cost. If the user asks for a full/detailed answer, Qalvero expands normally.
