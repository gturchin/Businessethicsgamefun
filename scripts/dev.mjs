import { spawn } from 'node:child_process';
const children = [spawn('npm', ['run', 'dev:api'], { stdio: 'inherit' }), spawn('node', ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], { stdio: 'inherit' })];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill('SIGTERM'); process.exitCode = code; }
for (const child of children) { child.on('exit', code => stop(code ?? 0)); child.on('error', () => stop(1)); }
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
