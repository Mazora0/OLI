# Qalvero APK Remote Builder Update

This update adds the maximum practical APK build support that can run from the web app without pretending Vercel itself can compile Android projects.

## What changed

- Added `/api/qlo-apk-build`.
- The Agent can now send the generated project ZIP to Google Cloud Storage.
- If Google Cloud is configured, the API starts a Google Cloud Build job.
- The Cloud Build job installs dependencies, builds the Vite app, syncs Capacitor Android, runs Gradle, and exports a debug APK artifact.
- The chat UI now has a **Build APK** button under Agent results.
- The generated ZIP now includes:
  - `cloudbuild.yaml`
  - GitHub Actions Android workflow
  - Linux/macOS build script
  - Windows PowerShell build script
  - APK build documentation

## Required server configuration

Add these to Vercel Environment Variables:

```env
GCLOUD_PROJECT_ID=
GCLOUD_TRAINING_BUCKET=
GCLOUD_SERVICE_ACCOUNT_BASE64=
QLO_APK_AUTO_BUILD=on
QLO_APK_BUILD_IMAGE=cimg/android:2024.11-node
QLO_APK_CLOUD_BUILD_MACHINE=E2_HIGHCPU_8
QLO_APK_SOURCE_PREFIX=qlo-apk/sources
QLO_APK_OUTPUT_PREFIX=qlo-apk/outputs
```

The service account needs:

- Storage Object Admin
- Cloud Build Editor
- Service Account User
- Logs Viewer

## Important

The generated APK is a debug APK for testing. Release APK/AAB needs signing keys and should be handled with proper secrets.
