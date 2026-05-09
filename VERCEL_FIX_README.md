# Vercel hotfix

Use these settings in Vercel Project Settings:

- Framework Preset: Vite
- Install Command: `npm ci --include=dev --no-audit --no-fund --legacy-peer-deps`
- Build Command: `npm run build`
- Output Directory: `dist`

Also remove these env vars if they exist:

- NODE_ENV=production
- NPM_CONFIG_PRODUCTION=true
- npm_config_production=true

Then redeploy with Clear Build Cache.
