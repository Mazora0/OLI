import { getSupabaseAdminClient, requireAdmin } from './_observability';

type Check = {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'fail';
  message: string;
};

function boolEnv(name: string, fallback = false) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
}

function hasAny(...names: string[]) {
  return names.some((name) => Boolean(process.env[name]));
}

function numberEnv(name: string, fallback: number) {
  const n = Number(process.env[name] ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function check(id: string, label: string, status: Check['status'], message: string): Check {
  return { id, label, status, message };
}

async function tableExists(admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>, table: string) {
  try {
    const { error } = await admin.from(table).select('*').limit(1);
    return !error;
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const adminAccess = await requireAdmin(req);
  if (!adminAccess.configured) return res.status(403).json({ error: 'Set QLO_ADMIN_EMAILS first to unlock preflight checks.' });
  if (!adminAccess.ok) return res.status(403).json({ error: 'Admin access required.' });

  const checks: Check[] = [];
  const nodeMajor = Number(process.version.replace(/^v/, '').split('.')[0]);
  checks.push(check(
    'node-runtime',
    'Node.js runtime',
    nodeMajor >= 22 ? 'ok' : 'fail',
    nodeMajor >= 22 ? `Running on ${process.version}.` : `Running on ${process.version}. Set Vercel Node.js Version to 22.x.`
  ));

  const hasSupabaseUrl = hasAny('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const hasSupabaseAnon = hasAny('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const hasServiceRole = hasAny('SUPABASE_SERVICE_ROLE_KEY');
  checks.push(check('supabase-url', 'Supabase URL', hasSupabaseUrl ? 'ok' : 'fail', hasSupabaseUrl ? 'Configured.' : 'Missing SUPABASE_URL or VITE_SUPABASE_URL.'));
  checks.push(check('supabase-anon', 'Supabase anon key', hasSupabaseAnon ? 'ok' : 'fail', hasSupabaseAnon ? 'Configured.' : 'Missing SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY.'));
  checks.push(check('supabase-service-role', 'Supabase service role', hasServiceRole ? 'ok' : 'fail', hasServiceRole ? 'Configured server-side.' : 'Missing SUPABASE_SERVICE_ROLE_KEY. Admin, retention, logs, and training sync need it.'));

  const admin = getSupabaseAdminClient();
  if (admin) {
    const requiredTables = ['qv_profiles', 'qv_usage_events', 'qv_error_logs', 'qv_api_rate_limits', 'qv_ai_response_cache', 'qlo_training_examples'];
    const results = await Promise.all(requiredTables.map(async (table) => ({ table, ok: await tableExists(admin, table) })));
    const missing = results.filter((x) => !x.ok).map((x) => x.table);
    checks.push(check(
      'supabase-schema',
      'Supabase schema',
      missing.length ? 'fail' : 'ok',
      missing.length ? `Missing tables: ${missing.join(', ')}. Run supabase/schema.sql in Supabase SQL Editor.` : 'Required tables are reachable.'
    ));
  } else {
    checks.push(check('supabase-schema', 'Supabase schema', 'fail', 'Could not connect to Supabase admin client.'));
  }

  const hasAi = hasAny('GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'DEEPSEEK_API_KEY', 'CLOUDFLARE_API_TOKEN');
  checks.push(check('ai-provider', 'Normal chat AI key', hasAi ? 'ok' : 'fail', hasAi ? 'At least one AI provider key is configured.' : 'Missing AI provider key. Add GEMINI_API_KEY first for the simplest setup.'));

  const agentProvider = String(process.env.QLO_AGENTS_PROVIDER || 'gemini').toLowerCase();
  const hasAgentDedicated = Boolean(process.env.QLO_AGENTS_API_KEY || process.env.AGENTS_GEMINI_API_KEY || process.env.AGENTS_OPENROUTER_API_KEY || process.env.AGENTS_GROQ_API_KEY || process.env.AGENTS_DEEPSEEK_API_KEY);
  checks.push(check(
    'agent-provider',
    'QLO Agent key',
    hasAgentDedicated || hasAi ? (hasAgentDedicated ? 'ok' : 'warn') : 'fail',
    hasAgentDedicated ? `Dedicated Agent key configured for ${agentProvider}.` : hasAi ? 'No dedicated Agent key. Agent will fall back to normal chat keys when possible.' : 'Missing Agent key and no fallback AI key found.'
  ));

  const hasSearch = hasAny('SERPER_API_KEY', 'BRAVE_SEARCH_API_KEY', 'TAVILY_API_KEY', 'BING_SEARCH_API_KEY');
  checks.push(check('web-search', 'Web / academic search', hasSearch ? 'ok' : 'warn', hasSearch ? 'Search provider configured.' : 'No search key configured. Study/research will use limited fallback behavior.'));

  const gcloudReady = Boolean(process.env.GCLOUD_PROJECT_ID && process.env.GCLOUD_TRAINING_BUCKET && (process.env.GCLOUD_SERVICE_ACCOUNT_BASE64 || process.env.GCLOUD_SERVICE_ACCOUNT_JSON));
  checks.push(check('google-cloud', 'Google Cloud training storage', gcloudReady ? 'ok' : 'warn', gcloudReady ? 'Google Cloud dataset backup is configured.' : 'Google Cloud is optional. Add project, bucket, and service account to enable dataset backup/training.'));

  const apkEnabled = boolEnv('QLO_APK_AUTO_BUILD', false);
  checks.push(check('apk-builder', 'Remote APK builder', apkEnabled && gcloudReady ? 'ok' : apkEnabled ? 'warn' : 'warn', apkEnabled && gcloudReady ? 'Remote APK build can start Cloud Build jobs.' : apkEnabled ? 'APK builder is on, but Google Cloud settings are incomplete.' : 'APK builder is optional and currently off.'));

  const mcpEnabled = boolEnv('QLO_MCP_ENABLED', true);
  checks.push(check('mcp', 'MCP support', mcpEnabled ? 'ok' : 'warn', mcpEnabled ? 'Local MCP layer is enabled.' : 'MCP layer is disabled by QLO_MCP_ENABLED=false.'));

  const chatRate = numberEnv('QLO_CHAT_RATE_LIMIT_PER_MINUTE', 45);
  const agentRate = numberEnv('QLO_AGENT_RATE_LIMIT_PER_MINUTE', 12);
  const resetHours = numberEnv('QLO_CREDIT_RESET_HOURS', 6);
  checks.push(check(
    'limits',
    'Limits sanity',
    chatRate > 0 && agentRate > 0 && resetHours > 0 ? 'ok' : 'fail',
    `Chat rate: ${chatRate}/min, Agent rate: ${agentRate}/min, chat credit reset: ${resetHours}h, Agent reset: daily.`
  ));

  const blockers = checks.filter((c) => c.status === 'fail');
  const warnings = checks.filter((c) => c.status === 'warn');
  return res.status(200).json({
    ok: blockers.length === 0,
    summary: {
      blockers: blockers.length,
      warnings: warnings.length,
      passed: checks.filter((c) => c.status === 'ok').length
    },
    checks
  });
}
