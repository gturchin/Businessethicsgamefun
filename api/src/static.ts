import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
export const securityHeaders = {
  'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'"
};
export async function serveStatic(directory: string, path: string) {
  let decoded: string; try { decoded = decodeURIComponent(path); } catch { return { status: 400, headers: securityHeaders, body: 'Invalid path.' }; }
  const shell = decoded === '/' || /^\/(demo|offline|control)$/.test(decoded) || /^\/(join|control|live)\/[a-zA-Z0-9]+$/.test(decoded);
  // Whitelist public artifacts; no arbitrary filesystem path can be requested.
  const asset = /^\/assets\/[a-zA-Z0-9_-]+\.(js|css|woff2|png|svg)$/.test(decoded) || ['/sw.js', '/favicon.svg', '/index.html'].includes(decoded);
  if (!shell && !asset) return { status: 404, headers: securityHeaders, body: 'Page not found.' };
  const file = shell ? 'index.html' : decoded.slice(1);
  const mime = file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.woff2') ? 'font/woff2' : file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8';
  try {
    return { status: 200, body: await readFile(join(directory, file)), headers: { ...securityHeaders, 'Content-Type': mime,
      'Cache-Control': file.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache', ...(file === 'sw.js' ? { 'Service-Worker-Allowed': '/' } : {}) } };
  } catch { return { status: 404, headers: securityHeaders, body: 'Page not found.' }; }
}
