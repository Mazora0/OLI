# Node 22 + Expanded QLO Agent Templates

## What changed

- Project runtime moved from Node 20.x to Node 22.x.
- Added `.nvmrc` and `.node-version` with `22`.
- Updated `package.json` engines to `node: 22.x`.
- Verified production build on Node 22.
- Expanded QLO 1.3 Agent template catalog to 80+ template categories.
- Game, POS, LMS, Kanban, docs, design system, status page, roadmap, expense tracker, and many more requests now route to the Agent template-first path.

## Vercel requirement

In Vercel, set:

- Settings → Build & Deployment → Node.js Version → 22.x

Then redeploy.

## Credit-saving behavior

QLO 1.3 Agent now tries a ready local template first. If the request matches the template library, the system customizes the name, language, style, sections, and copy without spending a heavy AI call. If no template fits, it falls back to the normal AI Agent route.
