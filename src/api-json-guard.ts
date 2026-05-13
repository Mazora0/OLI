const originalFetch = window.fetch.bind(window);

function requestUrl(input: RequestInfo | URL) {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
}

function isQalveroAiRequest(input: RequestInfo | URL) {
  return requestUrl(input).includes('/api/qalvero-ai');
}

function normalizeAiInput(input: RequestInfo | URL): RequestInfo | URL {
  const raw = requestUrl(input);
  if (!raw.includes('/api/qalvero-ai/')) return input;
  const fixed = raw.replace('/api/qalvero-ai/', '/api/qalvero-ai');

  if (typeof input === 'string') return fixed;
  if (input instanceof URL) return new URL(fixed);

  try {
    return new Request(fixed, input);
  } catch {
    return fixed;
  }
}

function safeAiErrorMessage(raw: string, status: number) {
  const lower = raw.toLowerCase();
  if (lower.includes('unauthorized') || status === 401 || status === 403) {
    return 'مفتاح الموديل غير صحيح أو لا يملك صلاحية. راجع مفاتيح AI في Vercel Environment Variables.';
  }
  if (lower.includes('rate') || status === 429) {
    return 'الموديل وصل لحد الاستخدام مؤقتًا. جرّب بعد شوية أو بدّل الموديل.';
  }
  if (status === 404) {
    return 'مسار الموديل غير موجود. تأكد إن /api/qalvero-ai موجودة في النشر الحالي واعمل Redeploy بدون cache.';
  }
  if (status >= 500 || lower.includes('a server error')) {
    return 'حصل خطأ في سيرفر الموديل. افتح Vercel Function Logs لمسار /api/qalvero-ai وشوف الخطأ الحقيقي.';
  }
  return 'الموديل مش قادر يرد حاليًا. جرّب تبديل الموديل أو راجع Vercel Function Logs.';
}

window.fetch = async (input, init) => {
  const normalizedInput = isQalveroAiRequest(input) ? normalizeAiInput(input) : input;
  const response = await originalFetch(normalizedInput, init);
  if (!isQalveroAiRequest(normalizedInput)) return response;

  const clone = response.clone();
  const raw = await clone.text().catch(() => '');
  if (!raw) return response;

  try {
    JSON.parse(raw);
    return response;
  } catch {
    const message = safeAiErrorMessage(raw, response.status);
    return new Response(JSON.stringify({
      ok: false,
      reply: message,
      content: message,
      text: message,
      message,
      error: message,
      sources: [],
      safeJsonGuard: true,
      status: response.status
    }), {
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
