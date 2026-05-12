import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

const checks = [
  { name: 'package.json', file: 'package.json', required: true },
  { name: 'Capacitor config', any: ['capacitor.config.ts', 'capacitor.config.json'], required: true },
  { name: 'Android workflow', any: ['.github/workflows/build-apk.yml', '.github/workflows/android-apk.yml', '.github/workflows/build-android.yml'], required: true },
  { name: 'Web source', any: ['src', 'index.html'], required: true },
  { name: 'Build output target', any: ['dist', 'public'], required: false },
  { name: 'Android platform', file: 'android', required: false }
];

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function result(check) {
  if (check.file) return exists(check.file);
  if (check.any) return check.any.some(exists);
  return false;
}

const rows = checks.map((check) => ({ ...check, ok: result(check) }));
const failed = rows.filter((row) => row.required && !row.ok);

console.log(`\nQalvero APK readiness check`);
console.log(`Project: ${root}\n`);
for (const row of rows) {
  console.log(`${row.ok ? '✅' : row.required ? '❌' : '⚠️'} ${row.name}`);
}

if (failed.length) {
  console.log('\nMissing required APK-ready files:');
  for (const row of failed) console.log(`- ${row.name}`);
  console.log('\nExpected generated APK-ready projects to include at least:');
  console.log('- package.json');
  console.log('- capacitor.config.ts or capacitor.config.json');
  console.log('- .github/workflows/build-apk.yml');
  console.log('- src/ or index.html');
  process.exit(1);
}

console.log('\nAPK-ready structure looks good. GitHub Actions can build the APK if Android SDK/JDK steps are configured in the workflow.');
