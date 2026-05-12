const originalFetch = window.fetch.bind(window);

function isQalveroAiRequest(input: RequestInfo | URL) {
  const value = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
  return value.includes('/api/qalvero-ai');
}

function safeAiErrorMessage(raw: string, status: number) {
  const lower = raw.toLowerCase();
  if (lower.includes('a server error') || status >= 500) {
    return 'اتصال الذكاء الاصطناعي مش متفعل دلوقتي. راجع مفاتيح AI في Vercel Environment Variables ثم اعمل Redeploy بدون cache.';
  }
  if (lower.includes('unauthorized') || status === 401 || status === 403) {
    return 'في مشكلة صلاحيات أو مفتاح API غير صحيح. راجع مفاتيح الذكاء الاصطناعي في Vercel.';
  }
  if (lower.includes('rate') || status === 429) {
    return 'الموديل وصل لحد الاستخدام مؤقتًا. جرّب بعد شوية أو بدّل الموديل.';
  }
  return 'حصل خطأ في اتصال الذكاء الاصطناعي، لكن الواجهة اتحكمت في الخطأ بدل رسالة JSON المكسورة.';
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
