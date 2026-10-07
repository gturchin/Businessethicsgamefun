import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const assets = (await readdir('dist/assets')).map(file => `/assets/${file}`);
const version = createHash('sha256').update('v2').update(await readFile('dist/index.html')).update(assets.join(',')).digest('hex').slice(0, 12);
await writeFile('dist/sw.js', `const CACHE = 'riverton-${version}';
const FILES = ${JSON.stringify(['/index.html', '/favicon.svg', ...assets])};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('riverton-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') { event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match('/index.html')))); return; }
  // Module requests include Origin; install-time same-origin requests may not.
  // These fixed public assets are identical for both requests.
  if (FILES.includes(url.pathname)) event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname, { ignoreVary: true })).then(cached => cached || fetch(event.request)));
});
`);
console.log('Offline presentation assets prepared.');
