import { createClient } from '@supabase/supabase-js';

const CLOUD_RETENTION_DAYS = Number(process.env.QLO_CLOUD_CHAT_RETENTION_DAYS || 10);
const MAX_THREADS = Number(process.env.QLO_CLOUD_CHAT_THREAD_LIMIT || 50);
const MAX_MESSAGES_PER_THREAD = Number(process.env.QLO_CLOUD_CHAT_MESSAGES_PER_THREAD || 80);
const MAX_CONTENT_CHARS = Number(process.env.QLO_CLOUD_CHAT_CONTENT_CHARS || 6000);

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

function isoDaysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function trimContent(value: unknown) {
  return String(value || '')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/(?:\+?\d[\s-]?){9,15}/g, '[phone]')
    .slice(0, MAX_CONTENT_CHARS);
}

async function cleanupUserChat(admin: any, userId: string) {
  const cutoff = new Date(Date.now() - CLOUD_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await admin.from('qv_chat_messages').delete().eq('user_id', userId).lt('created_at', cutoff);
  await admin.from('qv_chat_threads').delete().eq('user_id', userId).lt('updated_at', cutoff);
}

async function getUserPlan(admin: any, userId: string) {
  const { data } = await admin.from('qv_profiles').select('plan').eq('id', userId).maybeSingle();
  return String(data?.plan || 'Free');
}

export default async function handler(req: any, res: any) {
  const { admin, user } = await getUser(req);
  if (!admin) return res.status(503).json({ error: 'Chat history storage is not configured. Add Supabase service role key.' });
  if (!user) return res.status(401).json({ error: 'Login required for cloud chat history.' });

  await cleanupUserChat(admin, user.id);
  const plan = await getUserPlan(admin, user.id);

  if (req.method === 'GET') {
    const { data: threads, error: threadError } = await admin
      .from('qv_chat_threads')
      .select('id,title,model,mode,created_at,updated_at,expires_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(MAX_THREADS);
    if (threadError) return res.status(500).json({ error: threadError.message });
    const ids = (threads || []).map((thread: any) => thread.id);
    const { data: messages, error: msgError } = ids.length
      ? await admin.from('qv_chat_messages').select('thread_id,role,content,model,created_at').in('thread_id', ids).eq('user_id', user.id).order('created_at', { ascending: true }).limit(MAX_THREADS * MAX_MESSAGES_PER_THREAD)
      : { data: [], error: null };
    if (msgError) return res.status(500).json({ error: msgError.message });
    const byThread = new Map<string, any[]>();
    (messages || []).forEach((message: any) => {
      const list = byThread.get(message.thread_id) || [];
      list.push({ role: message.role, content: message.content, model: message.model, createdAt: message.created_at });
      byThread.set(message.thread_id, list);
    });
    return res.status(200).json({
      strategy: 'local-first-hybrid',
      plan,
      cloud_retention_days: CLOUD_RETENTION_DAYS,
      local_free_retention_days: 60,
      limits: { max_threads: MAX_THREADS, max_messages_per_thread: MAX_MESSAGES_PER_THREAD, max_content_chars: MAX_CONTENT_CHARS },
      threads: (threads || []).map((thread: any) => ({
        id: thread.id,
        title: thread.title,
        model: thread.model,
        mode: thread.mode,
        createdAt: thread.created_at,
        updatedAt: thread.updated_at,
        expiresAt: thread.expires_at,
        messages: byThread.get(thread.id) || []
      }))
    });
  }

  if (req.method === 'DELETE') {
    await admin.from('qv_chat_messages').delete().eq('user_id', user.id);
    await admin.from('qv_chat_threads').delete().eq('user_id', user.id);
    return res.status(200).json({ ok: true, deleted: 'cloud_chat_history' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const thread = req.body?.thread || {};
  const id = String(thread.id || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid thread id.' });

  const now = new Date().toISOString();
  const messages = Array.isArray(thread.messages) ? thread.messages.slice(-MAX_MESSAGES_PER_THREAD) : [];
  const expiresAt = isoDaysFromNow(Math.max(1, Math.min(Number(req.body?.retentionDays || CLOUD_RETENTION_DAYS), CLOUD_RETENTION_DAYS)));
  const title = String(thread.title || 'New chat').slice(0, 80);
  const model = String(thread.model || 'QLO Auto').slice(0, 64);
  const mode = String(thread.mode || 'Auto').slice(0, 64);

  const { error: threadError } = await admin.from('qv_chat_threads').upsert({
    id,
    user_id: user.id,
    title,
    model,
    mode,
    updated_at: now,
    expires_at: expiresAt,
    storage_policy: 'cloud-compact'
  }, { onConflict: 'id' });
  if (threadError) return res.status(500).json({ error: threadError.message });

  await admin.from('qv_chat_messages').delete().eq('thread_id', id).eq('user_id', user.id);
  if (messages.length) {
    const rows = messages
      .filter((message: any) => ['user', 'assistant', 'system'].includes(message?.role))
      .map((message: any) => ({
        thread_id: id,
        user_id: user.id,
        role: message.role,
        content: trimContent(message.content),
        model
      }))
      .filter((row: any) => row.content.trim().length > 0);
    if (rows.length) {
      const { error: msgError } = await admin.from('qv_chat_messages').insert(rows);
      if (msgError) return res.status(500).json({ error: msgError.message });
    }
  }

  return res.status(200).json({ ok: true, strategy: 'local-first-hybrid', plan, cloud_retention_days: CLOUD_RETENTION_DAYS, expires_at: expiresAt });
}
