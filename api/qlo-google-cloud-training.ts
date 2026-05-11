import { createClient } from '@supabase/supabase-js';
import { getGCloudConfig, gcsUri, uploadTextToGCS } from './_gcloud';
import { createVertexCustomJob } from './_vertex';

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getUser(req: any) {
  const admin = getSupabaseAdmin();
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!admin || !token) return { admin, user: null };
  const { data } = await admin.auth.getUser(token);
  return { admin, user: data?.user || null };
}

function toTrainingJsonl(rows: any[]) {
  return rows.map((row) => JSON.stringify({
    messages: [
      { role: 'system', content: 'You are QLO 1, the AI assistant inside Qalvero AI. Answer clearly in the user language. Support Arabic Fus\'ha, Egyptian Arabic, English, coding, study, writing, research, and digital productivity. Always keep QLO product/model names in English exactly: QLO, Qalvero AI, QLO 1.2, QLO 1.3, and QLO 1.3 Agent. Never translate, transliterate, localize, or write these names in Arabic or any other script.' },
      { role: 'user', content: row.prompt },
      { role: 'assistant', content: row.response }
    ],
    language: row.language_tag,
    task_type: row.task,
    route: row.route,
    model: row.model,
    quality_rating: row.quality_rating,
    created_at: row.created_at
  })).join('\n');
}

async function loadRows(admin: any, userId: string) {
  const { data, error } = await admin
    .from('qlo_training_examples')
    .select('id,prompt,response,language_tag,task,route,model,quality_rating,byte_size,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(Number(process.env.QLO_GCLOUD_DATASET_LIMIT || 10000));
  if (error) throw new Error(error.message);
  return data || [];
}

export default async function handler(req: any, res: any) {
  const cfg = getGCloudConfig();
  const { admin, user } = await getUser(req);

  if (req.method === 'GET') {
    return res.status(200).json({
      configured: Boolean(cfg),
      project_id: cfg?.projectId || null,
      bucket: cfg?.bucket || null,
      region: cfg?.region || null,
      dataset_prefix: cfg?.datasetPrefix || null,
      model_prefix: cfg?.modelPrefix || null,
      auto_sync: process.env.QLO_GCLOUD_AUTO_SYNC !== 'off',
      vertex_ready: Boolean(process.env.GCLOUD_VERTEX_TRAINING_IMAGE)
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!cfg) return res.status(503).json({ error: 'Google Cloud training is not configured. Add project, bucket, and service account variables.' });
  if (!admin) return res.status(503).json({ error: 'Supabase admin is not configured.' });
  if (!user) return res.status(401).json({ error: 'Login required.' });

  const action = String(req.body?.action || 'sync');
  const rows = await loadRows(admin, user.id);
  if (!rows.length) return res.status(400).json({ error: 'No training examples found yet.' });

  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const datasetPath = `${cfg.datasetPrefix}/${user.id}/qlo1-training-${stamp}.jsonl`;
  const jsonl = toTrainingJsonl(rows);
  const uploaded = await uploadTextToGCS(datasetPath, jsonl);
  if (!uploaded.ok) return res.status(500).json(uploaded);

  const manifestPath = `${cfg.datasetPrefix}/${user.id}/latest-manifest.json`;
  await uploadTextToGCS(manifestPath, JSON.stringify({
    dataset_uri: uploaded.uri,
    row_count: rows.length,
    byte_size: Buffer.byteLength(jsonl, 'utf8'),
    created_at: now.toISOString(),
    base_model: process.env.QLO1_BASE_MODEL || 'Qwen/Qwen3-8B'
  }, null, 2), 'application/json; charset=utf-8');

  if (action !== 'start') {
    return res.status(200).json({ ok: true, action: 'sync', dataset_uri: uploaded.uri, row_count: rows.length });
  }

  const image = process.env.GCLOUD_VERTEX_TRAINING_IMAGE;
  if (!image) return res.status(400).json({
    ok: true,
    synced: true,
    dataset_uri: uploaded.uri,
    row_count: rows.length,
    warning: 'Dataset synced. Add GCLOUD_VERTEX_TRAINING_IMAGE to start Vertex AI training from the app.'
  });

  const outputUri = gcsUri(cfg.bucket, `${cfg.modelPrefix}/${user.id}/qlo1-${stamp}`);
  const job = await createVertexCustomJob({
    projectId: cfg.projectId,
    region: cfg.region,
    displayName: `qlo1-lora-${stamp}`,
    containerImageUri: image,
    datasetUri: uploaded.uri!,
    outputUri,
    baseModel: process.env.QLO1_BASE_MODEL || 'Qwen/Qwen3-8B',
    machineType: process.env.GCLOUD_VERTEX_MACHINE_TYPE || 'n1-standard-8',
    acceleratorType: process.env.GCLOUD_VERTEX_ACCELERATOR_TYPE,
    acceleratorCount: process.env.GCLOUD_VERTEX_ACCELERATOR_COUNT ? Number(process.env.GCLOUD_VERTEX_ACCELERATOR_COUNT) : undefined
  });

  return res.status(200).json({ ok: true, action: 'start', dataset_uri: uploaded.uri, output_uri: outputUri, job });
}
