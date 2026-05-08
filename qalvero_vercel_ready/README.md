# Qalvero QLO 1.2 — Vercel + Supabase Ready

Production-ready React + Vite + TypeScript app prepared for:

- Vercel hosting
- Vercel API routes for QLO 1.2 AI backend
- Supabase Auth and database
- Gemini, Groq, and OpenRouter API keys
- Regional pricing by country
- PayPal invoice request flow
- Dark/light mode and multilingual UI

## Deploy on Vercel

1. Upload this project to GitHub.
2. Import the repository in Vercel.
3. Use these settings:

```txt
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

4. Add Environment Variables in Vercel Project Settings.
5. Redeploy.

## Required Vercel Environment Variables

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
AI_DEFAULT_PROVIDER=gemini
QLO_MODEL_NAME=QLO 1.2
GEMINI_MODEL=gemini-1.5-flash
GROQ_MODEL=llama-3.1-8b-instant
OPENROUTER_MODEL=google/gemini-flash-1.5
PUBLIC_SITE_URL=
```

## Supabase Setup

Run this file in Supabase SQL Editor:

```txt
supabase/schema.sql
```

Then enable Email Auth from:

```txt
Authentication → Providers → Email
```

Add your Vercel URL in:

```txt
Authentication → URL Configuration
```

## API Routes

```txt
/api/qalvero-ai
/api/request-invoice
```

## Notes

- QLO 1.2 is the public product/model name shown to users.
- Gemini, Groq, and OpenRouter are internal engines and should remain server-side.
- Never expose server API keys in VITE_ variables.
- Payment is prepared as PayPal invoice request. Automatic PayPal subscriptions can be added later with PayPal webhooks.
