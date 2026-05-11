import { createClient } from '@supabase/supabase-js';
import { uploadJsonToGCS } from './_gcloud';

const MAX_PROMPT_CHARS = Number(process.env.QLO_TRAINING_MAX_PROMPT_CHARS || 8000);
const MAX_RESPONSE_CHARS = Number(process.env.QLO_TRAINING_MAX_RESPONSE_CHARS || 12000);
const MAX_STORAGE_BYTES = Number(process.env.QLO_TRAINING_MAX_STORAGE_BYTES || 7.5 * 1024 * 1024 * 1024);

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

function classifyLanguage(text: string) {
  const value = String(text || '');
  const hasArabic = /[\u0600-\u06FF]/.test(value);
  const hasLatin = /[A-Za-z]/.test(value);
  const egyptian = /(عايز|عاوزه|عاوز|ايه|ازاي|إزاي|دلوقتي|كده|طب|بص|مش|ليه|عشان|تمام|خلاص|برضو|النهارده|هعمل|هتعمل|بيعمل|يشتغل)/i.test(value);
  if (hasArabic && egyptian) return hasLatin ? 'mixed_ar_eg_en' : 'ar_eg';
  if (hasArabic) return hasLatin ? 'mixed_ar_fusha_en' : 'ar_fusha';
  if (hasLatin) return 'en';
  return 'other';
}

function redact(value: string) {
  return String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/(?:\+?\d[\s-]?){9,15}/g, '[phone]')
    .replace(/(api[_-]?key|secret|token|password|passwd|sk-[A-Za-z0-9_-]{10,})\s*[:=]\s*[^\s]+/gi, '$1=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]');
}

function canonicalizeQloNames(value: string) {
  return String(value || '')
    .replace(/كيو\s*[-–— ]*\s*(?:إل|ال|ل)\s*[-–— ]*\s*(?:أو|او|و)/g, 'QLO')
    .replace(/كيو\s*لو/g, 'QLO')
    .replace(/QLO\s*١\s*[\.,]\s*٢/g, 'QLO 1.2')
    .replace(/QLO\s*١\s*[\.,]\s*٣/g, 'QLO 1.3')
    .replace(/QLO\s*1\s*,\s*2/g, 'QLO 1.2')
    .replace(/QLO\s*1\s*,\s*3/g, 'QLO 1.3');
}

function toJsonl(rows: any[]) {
  return rows.map((row) => JSON.stringify({
    prompt: row.prompt,
    response: row.response,
    language_tag: row.language_tag,
    task: row.task,
    route: row.route,
    model: row.model,
    quality_rating: row.quality_rating,
    created_at: row.created_at
  })).join('\n');
}

export default async function handler(req: any, res: any) {
  const { admin, user } = await getUser(req);
  if (!admin) return res.status(503).json({ error: 'Training storage is not configured. Add Supabase service role key.' });
  if (!user) return res.status(401).json({ error: 'Login required for QLO 1 training dataset sync.' });

  if (req.method === 'GET') {
    const format = String(req.query?.format || 'stats');
    const { data, error } = await admin
      .from('qlo_training_examples')
      .select('id,prompt,response,language_tag,task,route,model,quality_rating,byte_size,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(format === 'jsonl' ? 5000 : 2000);
    if (error) return res.status(500).json({ error: error.message });
    const rows = data || [];
    if (format === 'jsonl') {
      res.setHeader('Content-Type', 'application/jsonl; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="qlo-1-training-dataset.jsonl"');
      return res.status(200).send(toJsonl(rows));
    }
    const bytes = rows.reduce((sum, row: any) => sum + Number(row.byte_size || 0), 0);
    const languages = rows.reduce((acc: Record<string, number>, row: any) => {
      acc[row.language_tag || 'unknown'] = (acc[row.language_tag || 'unknown'] || 0) + 1;
      return acc;
    }, {});
    return res.status(200).json({ count: rows.length, bytes, max_bytes: MAX_STORAGE_BYTES, languages });
  }

  if (req.method === 'DELETE') {
    const { error } = await admin.from('qlo_training_examples').delete().eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const prompt = canonicalizeQloNames(redact(String(req.body?.prompt || ''))).slice(0, MAX_PROMPT_CHARS).trim();
  const response = canonicalizeQloNames(redact(String(req.body?.response || ''))).slice(0, MAX_RESPONSE_CHARS).trim();
  const combined = `${prompt}\n${response}`;
  const language_tag = String(req.body?.languageTag || classifyLanguage(combined)).slice(0, 32);
  const allowedTags = ['ar_eg', 'ar_fusha', 'en', 'mixed_ar_eg_en', 'mixed_ar_fusha_en'];
  if (!allowedTags.includes(language_tag)) return res.status(200).json({ ok: true, skipped: 'unsupported_language' });
  if (prompt.length < 8 || response.length < 8) return res.status(200).json({ ok: true, skipped: 'too_short' });

  const { data: existing } = await admin.from('qlo_training_examples').select('byte_size').eq('user_id', user.id).limit(5000);
  const used = (existing || []).reduce((sum: number, row: any) => sum + Number(row.byte_size || 0), 0);
  const byte_size = Buffer.byteLength(`${prompt}\n${response}`, 'utf8');
  if (used + byte_size > MAX_STORAGE_BYTES) return res.status(413).json({ error: 'QLO training dataset storage limit reached. Export and clear old examples before adding more.' });

  const payload = {
    user_id: user.id,
    prompt,
    response,
    language_tag,
    task: String(req.body?.task || 'general').slice(0, 64),
    route: String(req.body?.route || 'chat').slice(0, 64),
    model: String(req.body?.model || 'QLO').slice(0, 64),
    sources: Array.isArray(req.body?.sources) ? req.body.sources.slice(0, 6) : [],
    byte_size,
    token_estimate: Math.ceil((prompt.length + response.length) / 4),
    quality_rating: typeof req.body?.rating === 'number' ? Math.max(-1, Math.min(1, req.body.rating)) : null
  };
  const { data: inserted, error } = await admin
    .from('qlo_training_examples')
    .insert(payload)
    .select('id,created_at')
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // Google Cloud auto-save: each accepted training example is mirrored as one JSON object.
  // This avoids rewriting the entire dataset on every chat message and keeps credit/storage use sane.
  let cloud_sync: unknown = { skipped: 'disabled' };
  if (process.env.QLO_GCLOUD_AUTO_SYNC !== 'off') {
    try {
      const day = new Date().toISOString().slice(0, 10);
      const id = inserted?.id || `${Date.now()}`;
      cloud_sync = await uploadJsonToGCS(`qlo1/raw/${day}/${id}.json`, {
        id,
        created_at: inserted?.created_at || new Date().toISOString(),
        ...payload
      });
    } catch (cloudError: any) {
      cloud_sync = { ok: false, error: cloudError?.message || 'Google Cloud auto-save failed.' };
    }
  }

  return res.status(200).json({ ok: true, byte_size, language_tag, cloud_sync });
}
