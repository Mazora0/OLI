import { access, copyFile, mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = path.join(root, 'api');
const serverDir = path.join(root, 'src', 'server');
const helpers = ['_observability.ts', '_mcp.ts', '_vertex.ts'];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function repairEgyptianLocalReplyEngine() {
  const localReplyFile = path.join(serverDir, '_egyptian_daily_replies.ts');
  if (!(await exists(localReplyFile))) return;

  const original = await readFile(localReplyFile, 'utf8');
  let updated = original;

  updated = updated.replace(
    /seed\?: string;\n};/,
    'seed?: string;\n  messageCount?: string | number;\n};'
  );

  if (updated !== original) {
    await writeFile(localReplyFile, updated);
  }
}

function applyAiEnvAliases(source) {
  let updated = source;

  const helper = [
    'function qloEnv(names: string[], fallback = \'\') {',
    '  for (const name of names) {',
    '    const value = process.env[name];',
    '    if (typeof value === \'string\' && value.trim()) return value.trim();',
    '  }',
    '  return fallback;',
    '}',
    ''
  ].join('\n');

  if (!updated.includes('function qloEnv(')) {
    updated = updated.replace(
      "import { checkApiRateLimit, logApiError, logUsageEvent, estimateTokens } from './_observability';",
      "import { checkApiRateLimit, logApiError, logUsageEvent, estimateTokens } from './_observability';\n\n" + helper
    );
  }

  const replacements = [
    {
      pattern: /process\.env\.(GEMINI_API_KEY|GOOGLE_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY|AI_API_KEY|QLO_AI_API_KEY|QLO_AGENTS_API_KEY)/g,
      value: "qloEnv(['GEMINI_API_KEY','GOOGLE_API_KEY','GOOGLE_GENERATIVE_AI_API_KEY','AI_API_KEY','QLO_AI_API_KEY','QLO_AGENTS_API_KEY'])"
    },
    {
      pattern: /process\.env\.(DEEPSEEK_API_KEY|QLO_DEEPSEEK_API_KEY)/g,
      value: "qloEnv(['DEEPSEEK_API_KEY','QLO_DEEPSEEK_API_KEY','QLO_AGENTS_API_KEY'])"
    },
    {
      pattern: /process\.env\.(OPENROUTER_API_KEY|QLO_OPENROUTER_API_KEY)/g,
      value: "qloEnv(['OPENROUTER_API_KEY','QLO_OPENROUTER_API_KEY'])"
    },
    {
      pattern: /process\.env\.(GROQ_API_KEY|QLO_GROQ_API_KEY)/g,
      value: "qloEnv(['GROQ_API_KEY','QLO_GROQ_API_KEY'])"
    },
    {
      pattern: /process\.env\.(AI_PROVIDER|QLO_AI_PROVIDER)/g,
      value: "qloEnv(['QLO_AI_PROVIDER','AI_PROVIDER'], 'gemini')"
    },
    {
      pattern: /process\.env\.(QLO_DEFAULT_MODEL|QLO_FAST_MODEL|GEMINI_MODEL|GOOGLE_MODEL)/g,
      value: "qloEnv(['QLO_DEFAULT_MODEL','QLO_FAST_MODEL','GEMINI_MODEL','GOOGLE_MODEL'], 'gemini-1.5-flash')"
    },
    {
      pattern: /process\.env\.(QLO_SMART_MODEL|GEMINI_SMART_MODEL|GOOGLE_SMART_MODEL)/g,
      value: "qloEnv(['QLO_SMART_MODEL','GEMINI_SMART_MODEL','GOOGLE_SMART_MODEL'], 'gemini-1.5-pro')"
    },
    {
      pattern: /process\.env\.(DEEPSEEK_CHAT_MODEL)/g,
      value: "qloEnv(['DEEPSEEK_CHAT_MODEL'], 'deepseek-chat')"
    },
    {
      pattern: /process\.env\.(DEEPSEEK_REASON_MODEL)/g,
      value: "qloEnv(['DEEPSEEK_REASON_MODEL'], 'deepseek-reasoner')"
    },
    {
      pattern: /process\.env\.(OPENROUTER_MODEL)/g,
      value: "qloEnv(['OPENROUTER_MODEL'], 'deepseek/deepseek-chat')"
    },
    {
      pattern: /process\.env\.(OPENROUTER_REASON_MODEL)/g,
      value: "qloEnv(['OPENROUTER_REASON_MODEL'], 'deepseek/deepseek-r1')"
    },
    {
      pattern: /process\.env\.(GROQ_MODEL|GROQ_FAST_MODEL)/g,
      value: "qloEnv(['GROQ_MODEL','GROQ_FAST_MODEL'], 'llama-3.1-8b-instant')"
    },
    {
      pattern: /process\.env\.(GROQ_SMART_MODEL)/g,
      value: "qloEnv(['GROQ_SMART_MODEL'], 'llama-3.3-70b-versatile')"
    }
  ];

  for (const item of replacements) {
    updated = updated.replace(item.pattern, item.value);
  }

  return updated;
}

async function connectEgyptianLocalReplies() {
  const qalveroAiFile = path.join(apiDir, 'qalvero-ai.ts');
  if (!(await exists(qalveroAiFile))) return;

  const original = await readFile(qalveroAiFile, 'utf8');
  let updated = original;

  const importLine = "import { getEgyptianDailyLocalReply } from '../src/server/_egyptian_daily_replies';";
  if (!updated.includes('getEgyptianDailyLocalReply')) {
    updated = updated.replace(
      "import { checkApiRateLimit, logApiError, logUsageEvent, estimateTokens } from './_observability';",
      "import { checkApiRateLimit, logApiError, logUsageEvent, estimateTokens } from './_observability';\n" + importLine
    );
  }

  if (!updated.includes('QLO_EGYPTIAN_LOCAL_REPLIES')) {
    updated = updated.replace(
      /function localOptimizedReply\(args: \{ message: string; language: string; qloModel: QloModel; plan: UserPlan \}\) \{\n/,
      [
        'function localOptimizedReply(args: { message: string; language: string; qloModel: QloModel; plan: UserPlan }) {',
        "  if (process.env.QLO_EGYPTIAN_LOCAL_REPLIES !== 'false') {",
        '    const egyptianLocal = getEgyptianDailyLocalReply({',
        '      message: args.message,',
        '      language: args.language,',
        '      qloModel: args.qloModel,',
        '      plan: args.plan,',
        '      seed: `${args.qloModel}:${args.plan}:${args.message.length}`',
        '    });',
        '',
        '    if (egyptianLocal.matched && !egyptianLocal.shouldUseAi && egyptianLocal.confidence >= 0.68) {',
        '      return egyptianLocal.reply;',
        '    }',
        '  }',
        ''
      ].join('\n')
    );
  }

  updated = applyAiEnvAliases(updated);

  if (updated !== original) {
    await writeFile(qalveroAiFile, updated);
  }
}

await mkdir(serverDir, { recursive: true });

for (const helper of helpers) {
  const source = path.join(apiDir, helper);
  const target = path.join(serverDir, helper);
  if (await exists(source)) {
    await copyFile(source, target);
  }
}

await repairEgyptianLocalReplyEngine();
await connectEgyptianLocalReplies();

const runningOnVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

if (runningOnVercel) {
  const files = await readdir(apiDir);
  const apiFiles = files.filter((file) => file.endsWith('.ts') && !helpers.includes(file));

  for (const file of apiFiles) {
    const filePath = path.join(apiDir, file);
    const original = await readFile(filePath, 'utf8');
    let updated = original.replace(
      /(['"])\.\/_((observability)|(mcp)|(vertex))(\.ts)?\1/g,
      (_match, quote, helperName) => `${quote}../src/server/_${helperName}${quote}`
    );

    if (file === 'qalvero-ai.ts') {
      updated = applyAiEnvAliases(updated);
    }

    if (updated !== original) {
      await writeFile(filePath, updated);
    }
  }

  for (const helper of helpers) {
    const source = path.join(apiDir, helper);
    if (await exists(source)) {
      await unlink(source);
    }
  }

  console.log('Vercel API helper modules moved out of /api for this build.');
  console.log('Egyptian local daily replies connected before AI fallback.');
  console.log('AI key aliases enabled for Gemini, DeepSeek, OpenRouter, and Groq.');
} else {
  console.log('Server helper copies prepared for local build.');
  console.log('Egyptian local daily replies connected before AI fallback.');
  console.log('AI key aliases enabled for Gemini, DeepSeek, OpenRouter, and Groq.');
}
