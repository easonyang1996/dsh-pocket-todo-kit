import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const files = [];
for (const root of ['lib', 'scripts', 'test']) for (const name of fs.readdirSync(root)) {
  if (/\.(mjs|js)$/.test(name)) files.push(path.join(root, name));
}
for (const file of files) {
  const r = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (r.status) process.exit(r.status);
}
console.log(`Syntax checked ${files.length} JavaScript modules`);
