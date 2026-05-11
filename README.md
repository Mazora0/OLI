# Qalvero QLO 1.2 Credit Saver + Security Patch

This is the patched Vercel + Supabase version of Qalvero.

## What this patch adds

- QLO identity lock: the assistant presents itself as QLO 1.2, not Gemini/Groq/DeepSeek.
- Smart AI routing: Flash first for most traffic, Pro/Reason only for complex tasks.
- Credit protection: normal chat/model credits are tied to the logged-in user and reset every 6 hours.
- Agent protection: QLO Agent runs stay on a daily reset because they are heavier than normal chat.
- Demo protection: anonymous users get a tiny 6-hour demo limit by IP hash.
- Abuse protection: clearly illegal or abusive requests are refused, logged, and can restrict the account after strong evidence.
- Stripe Checkout: paid plans activate automatically through `api/stripe-webhook.ts`.
- PayPal invoice stays as manual backup.
- Compact memory only: small user profile notes, not full chat storage.

## Vercel settings

Framework: Vite
Build command: npm run build
Output directory: dist
Install command: npm install
Root directory: leave empty

## Required setup

1. Add the environment variables from `.env.example` in Vercel.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. In Supabase Auth URL settings, add your Vercel URL.
4. In Stripe, create subscription prices and add price IDs in Vercel.
5. Add a Stripe webhook endpoint:
   `/api/stripe-webhook`
   Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
6. Redeploy on Vercel.

## Important security notes

- Never expose AI provider keys in frontend variables.
- Only Supabase anon key uses `VITE_`.
- `SUPABASE_SERVICE_ROLE_KEY`, Stripe, Gemini, Groq, DeepSeek, OpenRouter, and Cloudflare keys must stay server-side only.

## QLO Identity Patch

This build includes a hard QLO identity layer:
- QLO identifies itself as **QLO 1.2 by Qalvero AI**.
- It does not expose Gemini/Groq/DeepSeek/OpenRouter/Cloudflare providers to end users.
- If asked who developed Qalvero AI, it describes Ahmed Ashraf Hamza Mohamed as an Egyptian developer from Assiut, born 2006-04-08, with his age calculated dynamically in the API route.
- Arabic user messages are answered in natural Egyptian Arabic by default.

## Vercel install stability note

This project is pinned to Node 20 and npm 10.8.2 to avoid the Vercel/npm `Exit handler never called` install bug seen with some Node 22 + npm 10.9 builds.

Recommended Vercel settings:

- Framework Preset: Vite
- Install Command: `npm ci --no-audit --no-fund --legacy-peer-deps`
- Build Command: `npm run build`
- Output Directory: `dist`
- Root Directory: empty

If a previous deployment failed during `npm install`, change the install command to the line above and redeploy without cache.

## Qalvero AI brand and QLO Agents update

This build includes the bilingual Qalvero AI company content, QLO 1.2 / QLO 1.3 positioning, founder section for Ahmed Ashraf Hamza Mohamed, supported file lists, export options, and the QLO Agents workspace.

QLO is described as Qalvero AI’s branded AI experience powered by advanced AI providers and smart backend routing. The UI does not claim that QLO is trained from scratch and does not expose provider names to users.

### QLO Agents

The Agents page runs four roles on one request:

- Architect
- Developer
- Analyst
- Writer

Results are saved in local browser storage and can be previewed, exported as raw text, exported as HTML, or printed as PDF through the browser.

Normal chat credits reset every 6 hours. Agent workflows remain daily: Free users get one local agent workflow per day, and Max users get up to four per day.

### Supported files

`.js .ts .py .html .css .json .php .java .go .rs .sql .sh .yaml .csv .jpg .png .gif .webp .svg` and more text/code formats.
