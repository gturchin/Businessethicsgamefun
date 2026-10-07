import { app } from '@azure/functions';
import { Engine } from './engine';
import { AzureStore } from './store';
import { handle } from './http';
import { resolve } from 'node:path';
import { securityHeaders, serveStatic } from './static';
let engine: Engine;
const standalone = process.env.RIVERTON_SERVE_FRONTEND === 'true';
app.http('sessions', { methods: ['GET', 'POST'], authLevel: 'anonymous', route: standalone ? '{*rest}' : 'sessions/{*rest}', handler: async request => {
  const path = new URL(request.url).pathname;
  if (standalone && !path.startsWith('/api/')) return request.method === 'GET' ? serveStatic(resolve(process.cwd(), 'static'), path) : { status: 405, body: 'Method not allowed.' };
  const headers = { ...securityHeaders, 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
  const connection = process.env.RIVERTON_STORAGE_CONNECTION;
  if (!connection) return { status: 503, headers, jsonBody: { error: 'The class service is not configured. Ask the presenter to use the rehearsal backup.' } };
  engine ??= new Engine(new AzureStore(connection));
  let body: unknown;
  if (request.method === 'POST') {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 4096) return { status: 413, headers, jsonBody: { error: 'Request is too large.' } };
    try { body = JSON.parse(raw); } catch { return { status: 400, headers, jsonBody: { error: 'Invalid JSON.' } }; }
  }
  const result = await handle(engine, { method: request.method, path: new URL(request.url).pathname, token: request.headers.get('authorization')?.replace(/^Bearer /, ''), body });
  return { status: result.status, headers, jsonBody: result.body };
} });
