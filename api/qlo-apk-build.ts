import { GoogleAuth } from 'google-auth-library';
import { getGCloudConfig, getStorageClient, gcsUri } from './_gcloud';

function parseServiceAccount() {
  const raw = process.env.GCLOUD_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  const b64 = process.env.GCLOUD_SERVICE_ACCOUNT_BASE64 || process.env.GOOGLE_SERVICE_ACCOUNT_BASE64 || '';
  const value = raw || (b64 ? Buffer.from(b64, 'base64').toString('utf8') : '');
  if (!value.trim()) return null;
  try { return JSON.parse(value); } catch { return null; }
}

async function getCloudAccessToken(projectId: string) {
  const credentials = parseServiceAccount();
  const auth = new GoogleAuth({
    projectId,
    credentials: credentials || undefined,
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return typeof token === 'string' ? token : token?.token;
}

function safeName(value = 'qalvero-agent-project') {
  return String(value || 'qalvero-agent-project').toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'qalvero-agent-project';
}

function stripBase64Prefix(value: string) {
  return String(value || '').replace(/^data:application\/zip;base64,/i, '').replace(/^data:.*?;base64,/i, '');
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const cfg = getGCloudConfig();
    if (!cfg) {
      return res.status(200).json({ ok: false, mode: 'local', message: 'Google Cloud APK builder is not configured. Add GCLOUD_PROJECT_ID, GCLOUD_TRAINING_BUCKET, and service account env vars.' });
    }

    const { zipBase64 = '', projectName = 'qalvero-agent-project' } = req.body || {};
    const cleanZip = stripBase64Prefix(zipBase64);
    if (!cleanZip) return res.status(400).json({ ok: false, error: 'Missing ZIP payload.' });
    if (cleanZip.length > Number(process.env.QLO_APK_MAX_ZIP_BASE64 || 9_000_000)) {
      return res.status(413).json({ ok: false, error: 'ZIP is too large for the APK builder request.' });
    }

    const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const base = safeName(projectName);
    const sourceObject = `${(process.env.GCLOUD_APK_SOURCE_PREFIX || 'qlo-apk/sources').replace(/^\/+|\/+$/g, '')}/${base}-${id}.zip`;
    const outputPrefix = `${(process.env.GCLOUD_APK_OUTPUT_PREFIX || 'qlo-apk/outputs').replace(/^\/+|\/+$/g, '')}/${base}-${id}`;
    const zipBuffer = Buffer.from(cleanZip, 'base64');

    const storage = getStorageClient();
    await storage.bucket(cfg.bucket).file(sourceObject).save(zipBuffer, {
      resumable: false,
      contentType: 'application/zip',
      metadata: { cacheControl: 'no-store' }
    });

    if ((process.env.QLO_APK_AUTO_BUILD || 'on') !== 'on') {
      return res.status(200).json({
        ok: true,
        mode: 'gcs-upload-only',
        sourceUri: gcsUri(cfg.bucket, sourceObject),
        outputUri: gcsUri(cfg.bucket, outputPrefix),
        message: 'Source ZIP uploaded. Set QLO_APK_AUTO_BUILD=on to start Cloud Build automatically.'
      });
    }

    const token = await getCloudAccessToken(cfg.projectId);
    if (!token) {
      return res.status(200).json({
        ok: true,
        mode: 'gcs-upload-only',
        sourceUri: gcsUri(cfg.bucket, sourceObject),
        outputUri: gcsUri(cfg.bucket, outputPrefix),
        message: 'Source ZIP uploaded, but no Google Cloud access token could be created for Cloud Build.'
      });
    }

    const image = process.env.QLO_APK_BUILD_IMAGE || 'cimg/android:2024.11-node';
    const build = {
      timeout: process.env.QLO_APK_BUILD_TIMEOUT || '1800s',
      source: { storageSource: { bucket: cfg.bucket, object: sourceObject } },
      options: { logging: 'CLOUD_LOGGING_ONLY', machineType: process.env.QLO_APK_CLOUD_BUILD_MACHINE || 'E2_HIGHCPU_8' },
      substitutions: {
        _OUTPUT_BUCKET: cfg.bucket,
        _OUTPUT_PREFIX: outputPrefix
      },
      steps: [
        {
          name: image,
          entrypoint: 'bash',
          args: ['-lc', [
            'set -euo pipefail',
            'echo "Qalvero APK builder started"',
            'node -v',
            'java -version',
            'npm ci --legacy-peer-deps',
            'npm run build',
            'npx cap add android || true',
            'npx cap sync android',
            'cd android',
            'chmod +x ./gradlew || true',
            './gradlew assembleDebug',
            'cd /workspace',
            'mkdir -p qlo-apk-output',
            'cp android/app/build/outputs/apk/debug/*.apk qlo-apk-output/app-debug.apk',
            'echo "APK ready: qlo-apk-output/app-debug.apk"'
          ].join(' && ')]
        }
      ],
      artifacts: {
        objects: {
          location: `gs://${cfg.bucket}/${outputPrefix}`,
          paths: ['qlo-apk-output/*.apk']
        }
      }
    };

    const endpoint = `https://cloudbuild.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/builds`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(build)
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(200).json({
        ok: true,
        mode: 'gcs-upload-only',
        sourceUri: gcsUri(cfg.bucket, sourceObject),
        outputUri: gcsUri(cfg.bucket, outputPrefix),
        cloudBuildError: data?.error?.message || data?.message || 'Cloud Build did not start.',
        message: 'Source ZIP uploaded, but Cloud Build could not start. Check Cloud Build API and service account permissions.'
      });
    }

    return res.status(200).json({
      ok: true,
      mode: 'cloud-build',
      sourceUri: gcsUri(cfg.bucket, sourceObject),
      outputUri: gcsUri(cfg.bucket, outputPrefix),
      buildId: data.id,
      status: data.status,
      logUrl: data.logUrl,
      message: 'APK build started on Google Cloud Build. Download the APK artifact from the output path when the build finishes.'
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: process.env.QLO_DEBUG === 'true' ? (err?.message || 'APK builder failed') : 'APK builder failed. Check Google Cloud configuration.' });
  }
}
