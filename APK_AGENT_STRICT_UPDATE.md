# QLO Agent APK + SDK/JDK strict update

Implemented in this build:

- Hidden internal implementation patterns: user-facing UI no longer says templates are being used.
- QLO 1.3 Agent can recognize Android/APK/JDK/SDK/Gradle/Capacitor requests.
- Generated ZIP projects include:
  - Node 22 engine
  - Capacitor config
  - Capacitor Android dependencies
  - APK build scripts
  - GitHub Actions workflow for debug APK artifact
  - JDK 17 / Android SDK / Gradle instructions
- Quick build ideas now include Android APK, Game APK, and Notes APK.
- Safe customization instructions were added to prevent breaking working projects when changing names, colors, text, or visual style.
- Build verified with npm ci and npm run build.

Important:
The browser itself does not compile APK files. The generated project is APK-ready and builds the APK through local Android SDK/JDK or GitHub Actions CI.
