import { createClient } from '@supabase/supabase-js';

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getUser(req: any) {
  const sb = admin();
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!sb || !token) return { sb, user: null };
  const { data } = await sb.auth.getUser(token);
  return { sb, user: data.user || null };
}

const allowedKeys = ['display_name', 'country', 'language', 'goals', 'study_level', 'interests', 'location', 'tone', 'projects', 'notes'];

export default async function handler(req: any, res: any) {
  const { sb, user } = await getUser(req);
  if (!sb) return res.status(500).json({ error: 'Supabase service role is not configured' });
  if (!user) return res.status(401).json({ error: 'Login required' });

  if (req.method === 'GET') {
    const { data } = await sb.from('qv_user_memory').select('compact_memory,updated_at').eq('user_id', user.id).maybeSingle();
    return res.status(200).json({ memory: data?.compact_memory || {}, updated_at: data?.updated_at || null });
  }

  if (req.method === 'POST') {
    const incoming = req.body?.memory || {};
    const clean: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (incoming[key] !== undefined) clean[key] = Array.isArray(incoming[key]) ? incoming[key].slice(0, 12) : String(incoming[key]).slice(0, 500);
    }
    const { data: old } = await sb.from('qv_user_memory').select('compact_memory').eq('user_id', user.id).maybeSingle();
    const next = { ...(old?.compact_memory || {}), ...clean, updated_at: new Date().toISOString() };
    const { error } = await sb.from('qv_user_memory').upsert({ user_id: user.id, compact_memory: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, memory: next });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
