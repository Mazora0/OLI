import { parseConfiguredMcpServers, qloMcpTools, qloMcpResources, qloMcpPrompts } from './_mcp';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const has = (name: string) => Boolean(process.env[name] && String(process.env[name]).trim());
  const providerKeys = {
    gemini: has('GEMINI_API_KEY') || has('GOOGLE_API_KEY') || has('GOOGLE_GENERATIVE_AI_API_KEY'),
    groq: has('GROQ_API_KEY'),
    openrouter: has('OPENROUTER_API_KEY'),
    deepseek: has('DEEPSEEK_API_KEY'),
    cloudflare: has('CLOUDFLARE_ACCOUNT_ID') && (has('CLOUDFLARE_API_TOKEN') || has('CLOUDFLARE_WORKERS_AI_TOKEN'))
  };
  const agentKeys = {
    dedicated: has('QLO_AGENTS_API_KEY') || has('AGENTS_API_KEY'),
    geminiFallback: has('AGENTS_GEMINI_API_KEY') || providerKeys.gemini,
    groqFallback: has('AGENTS_GROQ_API_KEY') || providerKeys.groq,
    openrouterFallback: has('AGENTS_OPENROUTER_API_KEY') || providerKeys.openrouter,
    deepseekFallback: has('AGENTS_DEEPSEEK_API_KEY') || providerKeys.deepseek
  };
  res.status(200).json({
    ok: Object.values(providerKeys).some(Boolean),
    chatProvidersConfigured: providerKeys,
    agentConfigured: Object.values(agentKeys).some(Boolean),
    agentKeysConfigured: agentKeys,
    creditResetHours: Number(process.env.QLO_CREDIT_RESET_HOURS || 6),
    mcp: {
      enabled: String(process.env.QLO_MCP_ENABLED || 'true').toLowerCase() !== 'false',
      endpoint: '/api/mcp',
      authRequired: Boolean(process.env.QLO_MCP_API_KEY || process.env.QLO_MCP_ADMIN_KEY),
      localTools: qloMcpTools.length,
      resources: qloMcpResources.length,
      prompts: qloMcpPrompts.length,
      remoteServers: parseConfiguredMcpServers().length,
      strict: true
    },
    toolHub: {
      endpoint: '/api/qlo-tool-hub',
      strict: true,
      hiddenInternalPatterns: true,
      tools: qloMcpTools.length
    },
    note: 'This endpoint only checks whether server keys exist. It never returns secrets.'
  });
}
