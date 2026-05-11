import { Storage } from '@google-cloud/storage';

type GCloudConfig = {
  projectId: string;
  bucket: string;
  region: string;
  datasetPrefix: string;
  modelPrefix: string;
};

function parseServiceAccount() {
  const raw = process.env.GCLOUD_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  const b64 = process.env.GCLOUD_SERVICE_ACCOUNT_BASE64 || process.env.GOOGLE_SERVICE_ACCOUNT_BASE64 || '';
  const value = raw || (b64 ? Buffer.from(b64, 'base64').toString('utf8') : '');
  if (!value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function getGCloudConfig(): GCloudConfig | null {
  const projectId = process.env.GCLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '';
  const bucket = process.env.GCLOUD_TRAINING_BUCKET || process.env.QLO_TRAINING_GCS_BUCKET || '';
  const region = process.env.GCLOUD_VERTEX_REGION || process.env.GCLOUD_REGION || 'us-central1';
  const datasetPrefix = (process.env.GCLOUD_DATASET_PREFIX || 'qlo1/datasets').replace(/^\/+|\/+$/g, '');
  const modelPrefix = (process.env.GCLOUD_MODEL_PREFIX || 'qlo1/models').replace(/^\/+|\/+$/g, '');
  if (!projectId || !bucket) return null;
  return { projectId, bucket, region, datasetPrefix, modelPrefix };
}

export function getStorageClient() {
  const credentials = parseServiceAccount();
  const projectId = process.env.GCLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || credentials?.project_id;
  if (credentials) return new Storage({ projectId, credentials });
  return new Storage({ projectId });
}

export function gcsUri(bucket: string, path: string) {
  return `gs://${bucket}/${path.replace(/^\/+/, '')}`;
}

export async function uploadTextToGCS(path: string, body: string, contentType = 'application/jsonl; charset=utf-8') {
  const cfg = getGCloudConfig();
  if (!cfg) return { ok: false, skipped: 'missing_gcloud_config' } as const;
  const storage = getStorageClient();
  const file = storage.bucket(cfg.bucket).file(path.replace(/^\/+/, ''));
  await file.save(body, { resumable: false, contentType, metadata: { cacheControl: 'no-store' } });
  return { ok: true, uri: gcsUri(cfg.bucket, path), path } as const;
}

export async function uploadJsonToGCS(path: string, data: unknown) {
  return uploadTextToGCS(path, JSON.stringify(data, null, 2), 'application/json; charset=utf-8');
}
