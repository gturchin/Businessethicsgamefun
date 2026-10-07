import { createServer } from 'node:http';
import { Engine } from './engine';
import { LocalStore, AzureStore } from './store';
import { handle } from './http';
const engine = new Engine(process.env.RIVERTON_STORAGE_CONNECTION ? new AzureStore(process.env.RIVERTON_STORAGE_CONNECTION) : new LocalStore());
createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  try {
    let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 4096) { res.writeHead(413).end(JSON.stringify({ error: 'Request is too large.' })); return; } }
    let body: unknown; try { body = raw ? JSON.parse(raw) : undefined; } catch { res.writeHead(400).end(JSON.stringify({ error: 'Invalid JSON.' })); return; }
    const result = await handle(engine, { method: req.method ?? 'GET', path: new URL(req.url ?? '/', 'http://localhost').pathname, token: req.headers.authorization?.replace(/^Bearer /, ''), body });
    res.writeHead(result.status).end(JSON.stringify(result.body));
  } catch { res.writeHead(503).end(JSON.stringify({ error: 'Riverton is reconnecting.' })); }
}).listen(7071, '127.0.0.1', () => console.log('Riverton local API ready on port 7071.'));
