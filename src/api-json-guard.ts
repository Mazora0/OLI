const originalFetch = window.fetch.bind(window);

function requestUrl(input: RequestInfo | URL) {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
}

function isQalveroAiRequest(input: RequestInfo | URL) {
  const value = requestUrl(input);
  return value.includes('/api/qalvero-ai') && !value.includes('/api/qalvero-ai-lite');
}

function fallbackUrl(input: RequestInfo | URL) {
  const value = requestUrl(input);
  return value.replace('/api/qalvero-ai', '/api/qalvero-ai-lite');
}

async function tryLiteFallback(input: RequestInfo | URL, init?: RequestInit) {
  try {
    const lite = await originalFetch(fallbackUrl(input), init);
    const clone = lite.clone();
    const raw = await clone.text().catch(() => '');
    if (!raw) return null;
    JSON.parse(raw);
    return lite;
  } catch {
    return null;
  }
}

function safeAiErrorMessage(raw: string, status: number) {
  const lower = raw.toLowerCase();
  if (lower.includes('unauthorized') || status === 401 || status === 403) {
    return 'في مشكلة صلاحيات أو مفتاح API غير صحيح. راجع مفاتيح الذكاء الاصطناعي في Vercel.';
  }
  if (lower.includes('rate') || status === 429) {
    return 'الموديل وصل لحد الاستخدام مؤقتًا. جرّب بعد شوية أو بدّل الموديل.';
  }
  return 'الموديل مش قادر يرد حاليًا. جرّب تبديل الموديل أو راجع Vercel Function Logs.';
}

window.fetch = async (input, init) => {
  const response = await originalFetch(input, init);
  if (!isQalveroAiRequest(input)) return response;

  const clone = response.clone();
  const raw = await clone.text().catch(() => '');

  if (!raw) return response;

  try {
    JSON.parse(raw);
    return response;
  } catch {
    const lite = await tryLiteFallback(input, init);
    if (lite) return lite;

    const message = safeAiErrorMessage(raw, response.status);
    const body = JSON.stringify({
      ok: false,
      reply: message,
      content: message,
      text: message,
      message,
      error: message,
      sources: [],
      safeJsonGuard: true
    });

    return new Response(body, {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Qalvero-Safe-Json-Guard': '1'
      }
    });
  }
};

export {};
