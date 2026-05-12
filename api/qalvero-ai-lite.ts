type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type ProviderResult = { provider: string; model: string; text: string };

function json(res: any, status: number, body: any) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function pickMessages(body: any): ChatMessage[] {
  if (Array.isArray(body?.messages)) {
    return body.messages
      .filter((m: any) => m && typeof m.content === 'string')
      .map((m: any) => ({ role: ['system', 'assistant', 'user'].includes(m.role) ? m.role : 'user', content: String(m.content || '') }))
      .slice(-12);
  }
  const text = String(body?.message || body?.prompt || body?.input || body?.text || '').trim();
  return text ? [{ role: 'user', content: text }] : [];
}

function latestUser(messages: ChatMessage[]) {
  return [...messages].reverse().find((m) => m.role === 'user')?.content || '';
}

function isArabic(text: string) {
  return /[\u0600-\u06FF]/.test(text || '');
}

function systemText(messages: ChatMessage[]) {
  const user = latestUser(messages);
  const ar = isArabic(user);
  return ar
    ? 'أنت QLO داخل Qalvero AI. رد بلغة المستخدم. لو السؤال عربي استخدم عربية واضحة أو عامية مصرية طبيعية حسب الأسلوب. لا تذكر مزودات الذكاء أو المفاتيح. لو توجد مصادر داخل الرسالة استخدمها واكتب إجابة منظمة قصيرة.'
    : 'You are QLO inside Qalvero AI. Reply in the user language. Do not mention providers or API keys. If sources are included, use them and answer clearly.';
}

function withSystem(messages: ChatMessage[]) {
  return [{ role: 'system' as const, content: systemText(messages) }, ...messages.filter((m) => m.content.trim())];
}

async function callGemini(messages: ChatMessage[]): Promise<ProviderResult | null> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.QLO_AI_API_KEY || process.env.QLO_AGENTS_API_KEY;
  if (!key) return null;
  const model = process.env.QLO_FAST_MODEL || process.env.QLO_DEFAULT_MODEL || 'gemini-1.5-flash';
  const merged = withSystem(messages).map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: merged }] }], generationConfig: { temperature: 0.35, topP: 0.85, maxOutputTokens: 1600 } })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || `Gemini failed ${r.status}`);
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
  if (!text.trim()) throw new Error('Gemini empty response');
  return { provider: 'gemini', model, text };
}

async function callChatCompletions(endpoint: string, key: string, model: string, messages: ChatMessage[], provider: string, headers: Record<string, string> = {}): Promise<ProviderResult> {
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...headers },
    body: JSON.stringify({ model, messages: withSystem(messages), temperature: 0.35, max_tokens: 1600 })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || data?.message || `${provider} failed ${r.status}`);
  const text = data?.choices?.[0]?.message?.content || '';
  if (!String(text).trim()) throw new Error(`${provider} empty response`);
  return { provider, model, text };
}

async function callOpenRouter(messages: ChatMessage[]) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const model = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat';
  return callChatCompletions('https://openrouter.ai/api/v1/chat/completions', key, model, messages, 'openrouter', {
    'HTTP-Referer': 'https://qalvero.ai',
    'X-Title': 'Qalvero AI'
  });
}

async function callDeepSeek(messages: ChatMessage[]) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const model = process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-chat';
  return callChatCompletions('https://api.deepseek.com/chat/completions', key, model, messages, 'deepseek');
}

async function callGroq(messages: ChatMessage[]) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const model = process.env.GROQ_MODEL || process.env.GROQ_FAST_MODEL || 'llama-3.1-8b-instant';
  return callChatCompletions('https://api.groq.com/openai/v1/chat/completions', key, model, messages, 'groq');
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

  const messages = pickMessages(req.body || {});
  if (!messages.length) return json(res, 400, { ok: false, error: 'Missing message' });

  const attempts = [callGemini, callOpenRouter, callDeepSeek, callGroq];
  const errors: string[] = [];

  for (const fn of attempts) {
    try {
      const result = await fn(messages);
      if (!result) continue;
      return json(res, 200, {
        ok: true,
        reply: result.text,
        content: result.text,
        text: result.text,
        message: result.text,
        sources: [],
        provider: result.provider,
        model: result.model,
        fallback: true
      });
    } catch (error: any) {
      errors.push(String(error?.message || error).slice(0, 180));
    }
  }

  return json(res, 200, {
    ok: false,
    reply: 'الموديل مش قادر يرد حاليًا. المفاتيح الموجودة لم تنجح مع Gemini/OpenRouter/DeepSeek/Groq أو فيها صلاحية/رصيد/اسم موديل غير صحيح.',
    content: 'الموديل مش قادر يرد حاليًا. المفاتيح الموجودة لم تنجح مع Gemini/OpenRouter/DeepSeek/Groq أو فيها صلاحية/رصيد/اسم موديل غير صحيح.',
    text: 'الموديل مش قادر يرد حاليًا. المفاتيح الموجودة لم تنجح مع Gemini/OpenRouter/DeepSeek/Groq أو فيها صلاحية/رصيد/اسم موديل غير صحيح.',
    sources: [],
    fallback: true,
    errors
  });
}
