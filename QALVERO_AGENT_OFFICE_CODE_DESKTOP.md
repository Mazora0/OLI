# Qalvero Agent Office + Code + Cross-platform Update

This update extends QLO 1.3 Agent with Qalvero-branded Office exports, advanced code-agent workflow prompts, and app packaging readiness.

## Office support

QLO 1.3 Agent can now prepare and export:

- Word-compatible `.docx`
- Excel-compatible `.xlsx`
- PowerPoint-compatible `.pptx`
- HTML preview
- PDF through browser print
- JSX single-file app
- ZIP project package

Supported uploads now include common Office files such as `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.odt`, `.ods`, `.odp`, and `.rtf`.

Binary Office files are accepted as project/context assets. Text-based formats such as `.rtf`, `.csv`, `.txt`, `.md`, `.html`, and code files are read directly.

## Qalvero Code mode

The Agent prompt now supports a Qalvero Code workflow:

- Understand attached files and project structure
- Create an edit plan
- Generate patch/diff-style instructions
- Provide safe terminal commands
- Add test plans
- Add rollback notes
- Update README and documentation

This is Qalvero AI behavior only. It does not claim to be Claude Code or use competitor branding.

## Mobile / desktop / Linux readiness

The web app now includes PWA files:

- `public/manifest.webmanifest`
- `public/qalvero-sw.js`
- service worker registration in `src/main.tsx`

Recommended packaging path:

- Mobile: install as PWA first, later wrap with Capacitor for APK/IPA.
- Windows / Linux / macOS: wrap the production `dist/` build with Tauri or Electron.

Always keep the normal Vite web build working before creating native wrappers. Because apparently software likes collapsing when you add “just one more platform.”
