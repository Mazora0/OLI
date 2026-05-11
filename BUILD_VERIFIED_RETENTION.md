# Build verified: Local-first retention update

Changes included:

- Chat history now uses a local-first hybrid strategy.
- Cloud chat history is compact and expires after 10 days.
- Free-plan local chat history is pruned after 60 days.
- Paid plans keep longer local history on the device.
- Added `/api/qlo-chat-history` for compact Supabase sync.
- Added advanced settings storage status and clear actions.
- Added Supabase retention columns, indexes, and cleanup helper.

Verification:

```bash
npm ci --ignore-scripts --no-audit --no-fund --legacy-peer-deps
npm run build
```

Result: TypeScript and Vite production build passed on Node 22.
