import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const dist = path.resolve('dist'); fs.mkdirSync(dist, { recursive: true });
const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-pocket-npm-cache-'));
let result;
try { result = JSON.parse(execFileSync('npm', ['--cache', cache, 'pack', '--json', '--pack-destination', dist], { encoding: 'utf8' }))[0]; }
finally { fs.rmSync(cache, { recursive: true, force: true }); }
const name = `dsh-pocket-todo-kit-${pkg.version}`;
// Recreate staging from the allowlist: never carry files left by a local
// trial (state, logs, screenshots, credentials) into the next release zip.
const kit = path.join(dist, name); fs.rmSync(kit, { recursive: true, force: true }); fs.mkdirSync(kit, { recursive: true });
fs.copyFileSync(path.join(dist, result.filename), path.join(kit, result.filename));
for (const file of ['README.md', 'targets.example.json']) fs.copyFileSync(file, path.join(kit, file));
for (const file of ['install.sh', 'start.sh']) { fs.copyFileSync(path.join('kit', file), path.join(kit, file)); fs.chmodSync(path.join(kit, file), 0o755); }
const archive = path.join(dist, name + '.zip');
fs.rmSync(archive, { force: true });
execFileSync('zip', ['-qr', archive, name], { cwd: dist });
console.log(JSON.stringify({ npmPackage: path.join(dist, result.filename), kit: archive }, null, 2));
