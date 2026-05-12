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
    const updated = original.replace(
      /(['"])\.\/_((observability)|(mcp)|(vertex))(\.ts)?\1/g,
      (_match, quote, helperName) => `${quote}../src/server/_${helperName}${quote}`
    );

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
} else {
  console.log('Server helper copies prepared for local build.');
  console.log('Egyptian local daily replies connected before AI fallback.');
}
