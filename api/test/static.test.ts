import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveStatic } from '../src/static';
test('alternate frontend adapter serves SPA routes and rejects path traversal or private files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'riverton-static-'));
  try {
    await mkdir(join(dir, 'assets')); await writeFile(join(dir, 'index.html'), 'Riverton'); await writeFile(join(dir, 'assets/app-abc.js'), 'console.log(1)');
    for (const path of ['/', '/demo', '/offline', '/control', '/join/RIVER27X', '/control/RIVER27X', '/live/RIVER27X']) assert.equal((await serveStatic(dir, path)).status, 200);
    const asset = await serveStatic(dir, '/assets/app-abc.js'); assert.equal(asset.status, 200); assert.ok(asset.headers['Content-Security-Policy']);
    for (const path of ['/../package.json', '/%2e%2e/package.json', '/assets/%2e%2e/host.json', '/host.json', '/.env', '/assets/missing.js']) assert.equal((await serveStatic(dir, path)).status, 404);
    assert.equal((await serveStatic(dir, '/%zz')).status, 400);
  } finally { await rm(dir, { force: true, recursive: true }); }
});
