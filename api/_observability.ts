import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export type TelemetryKind = 'chat' | 'agent' | 'search' | 'mcp' | 'tool' | 'apk' | 'training';

export function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function getClientIp(req: any) {
  const raw = req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'] || req?.socket?.remoteAddress || 'unknown';
  return String(raw).split(',')[0].trim();
}

export function sha(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function hashIp(req: any) {
  const salt = process.env.IP_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'qlo-local-salt';
  return sha(`${salt}:${getClientIp(req)}`);
}

export async function getRequestUser(req: any) {
  const admin = getSupabaseAdminClient();
  const token = String(req?.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!admin || !token) return { id: null as string | null, email: null as string | null, plan: 'Free' };
  try {
    const { data } = await admin.auth.getUser(token);
    const user = data?.user;
    if (!user) return { id: null as string | null, email: null as string | null, plan: 'Free' };
    const { data: profile } = await admin.from('qv_profiles').select('plan,email').eq('id', user.id).maybeSingle();
    const { data: sub } = await admin.from('qv_subscriptions').select('plan,status').eq('user_id', user.id).in('status', ['active', 'trialing']).order('created_at', { ascending: false }).limit(1).maybeSingle();
    return { id: user.id, email: user.email || profile?.email || null, plan: String(sub?.plan || profile?.plan || 'Free') };
  } catch {
    return { id: null as string | null, email: null as string | null, plan: 'Free' };
  }
}

export function configuredAdminEmails() {
  return String(process.env.QLO_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdmin(req: any) {
  const user = await getRequestUser(req);
  const emails = configuredAdminEmails();
  const ok = Boolean(user.email && emails.includes(String(user.email).toLowerCase()));
  return { ok, user, configured: emails.length > 0 };
}

export function estimateTokens(text = '') {
  // Conservative cheap estimate. Good enough for dashboards without paying tokenizer costs.
  return Math.ceil(String(text || '').length / 4);
}

export function safeSample(value = '', max = 240) {
  return String(value || '')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[redacted-google-key]')
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, '[redacted-openai-like-key]')
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .slice(0, max);
}

export async function checkApiRateLimit(req: any, scope: string, limit = 60, windowSeconds = 60) {
  const admin = getSupabaseAdminClient();
  if (!admin || limit <= 0) return { ok: true, count: 0, limit, retryAfter: 0 };
  const user = await getRequestUser(req);
  const subject = user.id ? `user:${user.id}` : `ip:${hashIp(req)}`;
  const now = Math.floor(Date.now() / 1000);
  const windowKey = String(Math.floor(now / windowSeconds));
  try {
    const { data } = await admin
      .from('qv_api_rate_limits')
      .select('id,count')
      .eq('subject_hash', sha(subject))
      .eq('scope', scope)
      .eq('window_key', windowKey)
      .maybeSingle();
    const nextCount = Number(data?.count || 0) + 1;
    if (data?.id) {
      await admin.from('qv_api_rate_limits').update({ count: nextCount, updated_at: new Date().toISOString() }).eq('id', data.id);
    } else {
      await admin.from('qv_api_rate_limits').insert({ subject_hash: sha(subject), user_id: user.id, ip_hash: user.id ? null : hashIp(req), scope, window_key: windowKey, count: nextCount });
    }
    return { ok: nextCount <= limit, count: nextCount, limit, retryAfter: Math.max(1, windowSeconds - (now % windowSeconds)) };
  } catch {
    // Never break production traffic because a telemetry table is missing.
    return { ok: true, count: 0, limit, retryAfter: 0 };
  }
}

export async function logUsageEvent(req: any, event: {
  kind: TelemetryKind;
  route?: string;
  model?: string;
  provider?: string;
  plan?: string;
  charged?: boolean;
  cached?: boolean;
  optimized?: boolean;
  promptChars?: number;
  responseChars?: number;
  promptTokens?: number;
  responseTokens?: number;
  costUnits?: number;
  status?: string;
  meta?: Record<string, unknown>;
}) {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  try {
    const user = await getRequestUser(req);
    await admin.from('qv_usage_events').insert({
      user_id: user.id,
      ip_hash: user.id ? null : hashIp(req),
      kind: event.kind,
      route: event.route || null,
      model: event.model || null,
      provider: event.provider || null,
      plan: event.plan || user.plan || 'Free',
      charged: event.charged ?? false,
      cached: event.cached ?? false,
      optimized: event.optimized ?? false,
      prompt_chars: event.promptChars || 0,
      response_chars: event.responseChars || 0,
      prompt_tokens: event.promptTokens ?? estimateTokens('x'.repeat(event.promptChars || 0)),
      response_tokens: event.responseTokens ?? estimateTokens('x'.repeat(event.responseChars || 0)),
      cost_units: event.costUnits || 0,
      status: event.status || 'ok',
      meta: event.meta || {}
    });
  } catch {
    // Optional telemetry only.
  }
}

export async function logApiError(req: any, event: {
  scope: string;
  code?: string;
  message?: string;
  severity?: 'low' | 'medium' | 'high';
  sample?: string;
  meta?: Record<string, unknown>;
}) {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  try {
    const user = await getRequestUser(req);
    await admin.from('qv_error_logs').insert({
      user_id: user.id,
      ip_hash: user.id ? null : hashIp(req),
      scope: event.scope,
      code: event.code || 'error',
      message: safeSample(event.message || 'Unknown error', 500),
      severity: event.severity || 'medium',
      sample: safeSample(event.sample || '', 500),
      meta: event.meta || {}
    });
  } catch {
    // Optional telemetry only.
  }
}
