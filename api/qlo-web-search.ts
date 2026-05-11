type WebSource = {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  weight: number;
};

const TRUSTED_HINTS = [
  '.gov', '.edu', 'who.int', 'nih.gov', 'ncbi.nlm.nih.gov', 'nasa.gov', 'noaa.gov',
  'britannica.com', 'khanacademy.org', 'wikipedia.org', 'nature.com', 'science.org',
  'nationalgeographic.com', 'ourworldindata.org', 'worldbank.org', 'oecd.org',
  'arxiv.org', 'doi.org', 'pubmed.ncbi.nlm.nih.gov', 'scholar.google.com', 'ieee.org', 'acm.org', 'springer.com', 'sciencedirect.com', 'jstor.org',
  'developer.mozilla.org', 'web.dev', 'react.dev', 'typescriptlang.org', 'nodejs.org'
];

function domainOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

function sourceWeight(url: string, mode = 'web') {
  const domain = domainOf(url).toLowerCase();
  let score = 1;
  if (TRUSTED_HINTS.some((hint) => domain.includes(hint))) score += 4;
  if (domain.endsWith('.gov') || domain.endsWith('.edu')) score += 5;
  if (mode === 'academic' && /(\.edu|arxiv\.org|doi\.org|pubmed|ncbi|ieee|acm|springer|sciencedirect|jstor|researchgate)/i.test(domain)) score += 4;
  if (/blogspot|medium\.com|quora|reddit|pinterest|facebook|tiktok|random|answers\.com/i.test(domain)) score -= 3;
  return score;
}

function dedupeSources(items: WebSource[], mode = 'web') {
  const seen = new Set<string>();
  return items
    .filter((item) => item.url && item.title)
    .map((item) => ({ ...item, domain: item.domain || domainOf(item.url), weight: Math.max(Number(item.weight || 0), sourceWeight(item.url, mode)) }))
    .sort((a, b) => b.weight - a.weight)
    .filter((item) => {
      const key = item.url.split('#')[0].replace(/\/$/, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

async function searchBrave(query: string): Promise<WebSource[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return [];
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=6&text_decorations=false`;
  const r = await fetch(url, { headers: { 'Accept': 'application/json', 'X-Subscription-Token': key } });
  if (!r.ok) return [];
  const data = await r.json();
  return (data?.web?.results || []).map((x: any) => ({
    title: String(x.title || '').replace(/<[^>]*>/g, ''),
    url: String(x.url || ''),
    snippet: String(x.description || '').replace(/<[^>]*>/g, '').slice(0, 520),
    domain: domainOf(String(x.url || '')),
    weight: sourceWeight(String(x.url || ''))
  }));
}

async function searchSerper(query: string): Promise<WebSource[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return [];
  const r = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
    body: JSON.stringify({ q: query, num: 6 })
  });
  if (!r.ok) return [];
  const data = await r.json();
  return (data?.organic || []).map((x: any) => ({
    title: String(x.title || ''),
    url: String(x.link || ''),
    snippet: String(x.snippet || '').slice(0, 520),
    domain: domainOf(String(x.link || '')),
    weight: sourceWeight(String(x.link || ''))
  }));
}

async function searchTavily(query: string): Promise<WebSource[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  const r = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: key, query, max_results: 6, search_depth: 'basic', include_answer: false })
  });
  if (!r.ok) return [];
  const data = await r.json();
  return (data?.results || []).map((x: any) => ({
    title: String(x.title || ''),
    url: String(x.url || ''),
    snippet: String(x.content || '').slice(0, 520),
    domain: domainOf(String(x.url || '')),
    weight: sourceWeight(String(x.url || ''))
  }));
}

async function searchBing(query: string): Promise<WebSource[]> {
  const key = process.env.BING_SEARCH_API_KEY;
  if (!key) return [];
  const r = await fetch(`https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=6&responseFilter=Webpages`, {
    headers: { 'Ocp-Apim-Subscription-Key': key }
  });
  if (!r.ok) return [];
  const data = await r.json();
  return (data?.webPages?.value || []).map((x: any) => ({
    title: String(x.name || ''),
    url: String(x.url || ''),
    snippet: String(x.snippet || '').slice(0, 520),
    domain: domainOf(String(x.url || '')),
    weight: sourceWeight(String(x.url || ''))
  }));
}

async function searchWikipedia(query: string, language: string): Promise<WebSource[]> {
  const wikiLang = language === 'ar' ? 'ar' : 'en';
  const r = await fetch(`https://${wikiLang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=4&namespace=0&format=json&origin=*`);
  if (!r.ok) return [];
  const data = await r.json();
  const titles: string[] = data?.[1] || [];
  const snippets: string[] = data?.[2] || [];
  const urls: string[] = data?.[3] || [];
  return titles.map((title, i) => ({
    title: String(title || ''),
    url: String(urls[i] || ''),
    snippet: String(snippets[i] || '').slice(0, 520),
    domain: domainOf(String(urls[i] || '')),
    weight: sourceWeight(String(urls[i] || ''))
  }));
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { query = '', language = 'en', mode = 'web' } = req.body || {};
    const clean = String(query || '').trim().slice(0, 260);
    if (!clean) return res.status(400).json({ error: language === 'ar' ? 'اكتب سؤال للبحث.' : 'Search query required.' });

    const academic = String(mode) === 'academic';
    const searchQuery = academic ? `${clean} university research sources OR site:edu OR filetype:pdf` : clean;

    const results = dedupeSources([
      ...(await searchBrave(searchQuery)),
      ...(await searchSerper(searchQuery)),
      ...(await searchTavily(searchQuery)),
      ...(await searchBing(searchQuery))
    ], academic ? 'academic' : 'web');

    const fallback = results.length ? [] : await searchWikipedia(clean, language);
    const sources = dedupeSources([...results, ...fallback], academic ? 'academic' : 'web');

    return res.status(200).json({
      query: clean,
      sources,
      mode: sources.length ? 'grounded' : 'empty'
    });
  } catch (err: any) {
    return res.status(200).json({ query: '', sources: [], mode: 'failed' });
  }
}
