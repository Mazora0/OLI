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

await mkdir(serverDir, { recursive: true });

for (const helper of helpers) {
  const source = path.join(apiDir, helper);
  const target = path.join(serverDir, helper);
  if (await exists(source)) {
    await copyFile(source, target);
  }
}

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
} else {
  console.log('Server helper copies prepared for local build.');
}
