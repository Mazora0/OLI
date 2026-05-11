import { getSupabaseAdminClient, requireAdmin } from './_observability';

function startOfDayIso() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
function startDaysAgo(days: number) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}
function groupCount<T extends Record<string, any>>(rows: T[] = [], key: keyof T) {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const k = String(row[key] ?? 'unknown');
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}
function sum(rows: any[] = [], key: string) {
  return rows.reduce((n, row) => n + Number(row?.[key] || 0), 0);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const adminAccess = await requireAdmin(req);
  if (!adminAccess.configured) return res.status(403).json({ error: 'Admin dashboard is locked. Add QLO_ADMIN_EMAILS in Vercel env first.' });
  if (!adminAccess.ok) return res.status(403).json({ error: 'Admin access required.' });
  const admin = getSupabaseAdminClient();
  if (!admin) return res.status(500).json({ error: 'Supabase service role is not configured.' });

  const action = String(req.query?.action || req.body?.action || 'summary');

  if (action === 'cleanup') {
    const before = startDaysAgo(Number(process.env.QLO_LOG_RETENTION_DAYS || 30));
    const cacheBefore = new Date().toISOString();
    const [usage, errors, rates, cache] = await Promise.all([
      admin.from('qv_usage_events').delete().lt('created_at', before),
      admin.from('qv_error_logs').delete().lt('created_at', before),
      admin.from('qv_api_rate_limits').delete().lt('created_at', before),
      admin.from('qv_ai_response_cache').delete().lt('expires_at', cacheBefore)
    ]);
    return res.status(200).json({ ok: true, deletedBefore: before, errors: [usage.error, errors.error, rates.error, cache.error].filter(Boolean).map((e: any) => e.message) });
  }

  const sinceDay = startOfDayIso();
  const sinceWeek = startDaysAgo(7);

  const [todayUsage, weekUsage, recentErrors, recentRates, profiles, training] = await Promise.all([
    admin.from('qv_usage_events').select('*').gte('created_at', sinceDay).order('created_at', { ascending: false }).limit(500),
    admin.from('qv_usage_events').select('*').gte('created_at', sinceWeek).order('created_at', { ascending: false }).limit(2000),
    admin.from('qv_error_logs').select('*').order('created_at', { ascending: false }).limit(30),
    admin.from('qv_api_rate_limits').select('scope,count,window_key,created_at').order('created_at', { ascending: false }).limit(50),
    admin.from('qv_profiles').select('id,plan,country,created_at').order('created_at', { ascending: false }).limit(1000),
    admin.from('qlo_training_examples').select('id,language_tag,task,created_at').gte('created_at', sinceWeek).limit(1000)
  ]);

  const today = todayUsage.data || [];
  const week = weekUsage.data || [];
  const profileRows = profiles.data || [];
  const trainingRows = training.data || [];

  const providersConfigured = {
    gemini: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
    search: Boolean(process.env.SERPER_API_KEY || process.env.BRAVE_SEARCH_API_KEY || process.env.TAVILY_API_KEY || process.env.BING_SEARCH_API_KEY),
    googleCloud: Boolean(process.env.GCLOUD_PROJECT_ID && process.env.GCLOUD_TRAINING_BUCKET && (process.env.GCLOUD_SERVICE_ACCOUNT_BASE64 || process.env.GCLOUD_SERVICE_ACCOUNT_JSON)),
    apkBuilder: String(process.env.QLO_APK_AUTO_BUILD || '').toLowerCase() === 'on',
    mcp: String(process.env.QLO_MCP_ENABLED || 'true').toLowerCase() !== 'false'
  };

  return res.status(200).json({
    ok: true,
    admin: { email: adminAccess.user.email },
    status: providersConfigured,
    users: {
      recentProfiles: profileRows.length,
      byPlan: groupCount(profileRows, 'plan'),
      byCountry: groupCount(profileRows, 'country')
    },
    usage: {
      todayEvents: today.length,
      weekEvents: week.length,
      chargedToday: today.filter((r) => r.charged).length,
      cachedToday: today.filter((r) => r.cached).length,
      optimizedToday: today.filter((r) => r.optimized).length,
      promptTokensToday: sum(today, 'prompt_tokens'),
      responseTokensToday: sum(today, 'response_tokens'),
      byKindToday: groupCount(today, 'kind'),
      byModelToday: groupCount(today, 'model'),
      byRouteToday: groupCount(today, 'route'),
      latest: today.slice(0, 12).map((r) => ({ kind: r.kind, model: r.model, route: r.route, plan: r.plan, charged: r.charged, cached: r.cached, optimized: r.optimized, tokens: Number(r.prompt_tokens || 0) + Number(r.response_tokens || 0), created_at: r.created_at }))
    },
    errors: {
      count: (recentErrors.data || []).length,
      latest: (recentErrors.data || []).map((e) => ({ scope: e.scope, code: e.code, severity: e.severity, message: e.message, created_at: e.created_at }))
    },
    rateLimits: recentRates.data || [],
    training: {
      weekExamples: trainingRows.length,
      byLanguage: groupCount(trainingRows, 'language_tag'),
      byTask: groupCount(trainingRows, 'task')
    },
    limits: {
      chatRatePerMinute: Number(process.env.QLO_CHAT_RATE_LIMIT_PER_MINUTE || 45),
      agentRatePerMinute: Number(process.env.QLO_AGENT_RATE_LIMIT_PER_MINUTE || 12),
      creditResetHours: Number(process.env.QLO_CREDIT_RESET_HOURS || 6),
      agentReset: 'daily',
      cloudChatRetentionDays: Number(process.env.QLO_CLOUD_CHAT_RETENTION_DAYS || 10)
    }
  });
}
