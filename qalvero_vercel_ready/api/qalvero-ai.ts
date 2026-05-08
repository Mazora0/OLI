import { createClient } from '@supabase/supabase-js';

const system = `You are QLO 1.2 by Qalvero LLC. You are a modern AI assistant for productivity, learning, planning, writing, coding help, and daily digital workflows. Be clear, helpful, concise, and safe. You are branded as QLO 1.2. Do not claim that Qalvero trained a proprietary foundation model from scratch; you are Qalvero's assistant experience powered by secure provider APIs.`;

type QloModel = 'qlo-flash' | 'qlo-pro' | 'qlo-reason';
type Provider = 'auto' | 'gemini' | 'groq' | 'openrouter';
type Plan = 'Free' | 'Standard' | 'Premium';

type Req = { method?: string; body?: any; headers: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; json: (body: any) => void; setHeader?: (key: string, value: string) => void };

const limits: Record<Plan, { messages: number; models: QloModel[] }> = {
  Free: { messages: 15, models: ['qlo-flash'] },
  Standard: { messages: 250, models: ['qlo-flash', 'qlo-pro'] },
  Premium: { messages: 1000, models: ['qlo-flash', 'qlo-pro', 'qlo-reason'] },
};

const modelMap: Record<QloModel, Record<Exclude<Provider, 'auto'>, string>> = {
  'qlo-flash': {
    gemini: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    groq: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    openrouter: process.env.OPENROUTER_MODEL || 'google/gemini-flash-1.5',
  },
  'qlo-pro': {
    gemini: process.env.GEMINI_PRO_MODEL || process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    groq: process.env.GROQ_PRO_MODEL || process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
    openrouter: process.env.OPENROUTER_PRO_MODEL || 'openai/gpt-4o-mini',
  },
  'qlo-reason': {
    gemini: process.env.GEMINI_REASON_MODEL || process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    groq: process.env.GROQ_REASON_MODEL || process.env.GROQ_MODEL || 'deepseek-r1-distill-llama-70b',
    openrouter: process.env.OPENROUTER_REASON_MODEL || 'deepseek/deepseek-r1',
  },
};

function json(res: Res, code: number, body: any) {
  res.setHeader?.('Content-Type', 'application/json');
  return res.status(code).json(body);
}

function getBearer(headers: Req['headers']) {
  const raw = headers.authorization || headers.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value?.startsWith('Bearer ')) return null;
  return value.slice('Bearer '.length);
}

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  return createClient(url, service, { auth: { persistSession: false } });
}

async function getUserAndPlan(token: string | null) {
  const admin = getAdminClient();
  if (!admin) return { userId: null, plan: 'Free' as Plan, usage: 0, limit: limits.Free.messages, bypass: true };

  if (!token) throw new Error('Please log in to use QLO 1.2.');
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) throw new Error('Invalid or expired session. Please log in again.');

  const userId = userData.user.id;
  const { data: sub } = await admin
    .from('qv_subscriptions')
    .select('plan,status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const plan = ((sub?.plan as Plan) || 'Free') as Plan;
  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);
  const period = periodStart.toISOString().slice(0, 10);

  const { data: usageRow } = await admin
    .from('qv_ai_usage')
    .select('messages_used')
    .eq('user_id', userId)
    .eq('period_start', period)
    .maybeSingle();

  return { userId, plan, usage: usageRow?.messages_used || 0, limit: limits[plan]?.messages || 15, bypass: false, period };
}

async function incrementUsage(userId: string | null, period?: string) {
  const admin = getAdminClient();
  if (!admin || !userId || !period) return;
  await admin.rpc('qv_increment_ai_usage', { p_user_id: userId, p_period_start: period });
}

async function gemini(message: string, model: string, lang: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Missing GEMINI_API_KEY');
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `${system}\nRespond in language: ${lang}.\nUser: ${message}` }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
    }),
  });
  const j: any = await r.json();
  if (!r.ok) throw new Error(j.error?.message || 'Gemini failed');
  return j.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
}

async function groq(message: string, model: string, lang: string) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('Missing GROQ_API_KEY');
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: `${system}\nRespond in language: ${lang}.` }, { role: 'user', content: message }],
      temperature: 0.7,
      max_tokens: 1200,
    }),
  });
  const j: any = await r.json();
  if (!r.ok) throw new Error(j.error?.message || 'Groq failed');
  return j.choices?.[0]?.message?.content || 'No response.';
}

async function openrouter(message: string, model: string, lang: string) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('Missing OPENROUTER_API_KEY');
  const siteUrl = process.env.PUBLIC_SITE_URL || 'https://qalvero.vercel.app';
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': siteUrl,
      'X-Title': 'Qalvero AI',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: `${system}\nRespond in language: ${lang}.` }, { role: 'user', content: message }],
      temperature: 0.7,
      max_tokens: 1200,
    }),
  });
  const j: any = await r.json();
  if (!r.ok) throw new Error(j.error?.message || 'OpenRouter failed');
  return j.choices?.[0]?.message?.content || 'No response.';
}

export default async function handler(req: Req, res: Res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { message, model = 'qlo-flash', provider = 'auto', lang = 'en' } = body as { message?: string; model?: QloModel; provider?: Provider; lang?: string };
    if (!message?.trim()) return json(res, 400, { error: 'Message is required' });

    const token = getBearer(req.headers);
    const account = await getUserAndPlan(token);
    const requestedModel = (modelMap[model] ? model : 'qlo-flash') as QloModel;

    if (!limits[account.plan]?.models.includes(requestedModel)) {
      return json(res, 403, { error: `${requestedModel} is not available on your ${account.plan} plan.` });
    }
    if (!account.bypass && account.usage >= account.limit) {
      return json(res, 429, { error: `Monthly limit reached for ${account.plan}. Upgrade your plan to continue.` });
    }

    const chosen = modelMap[requestedModel];
    const order = provider === 'auto'
      ? [process.env.AI_DEFAULT_PROVIDER || 'gemini', 'groq', 'openrouter'].filter((v, i, a) => a.indexOf(v) === i)
      : [provider];

    let last = '';
    for (const p of order) {
      try {
        let reply = '';
        if (p === 'gemini') reply = await gemini(message, chosen.gemini, lang);
        if (p === 'groq') reply = await groq(message, chosen.groq, lang);
        if (p === 'openrouter') reply = await openrouter(message, chosen.openrouter, lang);
        if (reply) {
          await incrementUsage(account.userId, (account as any).period);
          return json(res, 200, { reply, provider: p, model: requestedModel, plan: account.plan, remaining: Math.max(account.limit - account.usage - 1, 0) });
        }
      } catch (e: any) {
        last = e.message || String(e);
      }
    }
    return json(res, 500, { error: last || 'No provider worked' });
  } catch (e: any) {
    return json(res, 500, { error: e.message || 'Server error' });
  }
}
