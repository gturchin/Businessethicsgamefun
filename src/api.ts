import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action, HostState } from '../shared/model';
import { backupAction, backupState } from './backup';
export class RequestError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function request<T>(path: string, token?: string, body?: unknown): Promise<T> {
  if (path.includes('/OFFLINE/')) {
    if (body && typeof body === 'object' && 'action' in body) return backupAction((body as { action: Action }).action) as T;
    return backupState() as T;
  }
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`/api/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal, cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new RequestError(result.error ?? 'Please try again.', response.status);
    return result;
  } finally { clearTimeout(timer); }
}
export function usePolling<T>(path: string, token?: string, interval = 2000) {
  const [data, setData] = useState<T>(); const [error, setError] = useState(''); const [fatal, setFatal] = useState(false);
  const trigger = useRef<() => void>(() => {});
  const refresh = useCallback(() => trigger.current(), []);
  useEffect(() => {
    let active = true, running = false, attempts = 0, pending = false;
    let timer: ReturnType<typeof setTimeout>;
    setData(undefined); setError(''); setFatal(false);
    const poll = async () => {
      clearTimeout(timer);
      if (!active || document.hidden) return;
      if (running) { pending = true; return; }
      running = true;
      let terminal = false;
      try { const result = await request<T>(path, token); if (active) { setData(result); setError(''); setFatal(false); attempts = 0; } }
      catch (e) {
        if (active) {
          terminal = e instanceof RequestError && [400, 403, 404, 410].includes(e.status);
          setError(terminal ? (e as Error).message : 'Connection interrupted. Your last view is saved; reconnecting…'); setFatal(terminal); attempts++;
        }
      } finally {
        running = false;
        if (active && !terminal) { const delay = pending ? 0 : attempts ? Math.min(30_000, interval * 2 ** Math.min(attempts, 4)) : interval; pending = false; timer = setTimeout(poll, delay); }
      }
    };
    const resume = () => { attempts = 0; void poll(); };
    trigger.current = resume; void poll();
    document.addEventListener('visibilitychange', resume); window.addEventListener('online', resume);
    return () => { active = false; clearTimeout(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); };
  }, [path, token, interval]);
  return { data, error, fatal, refresh };
}
export function getHostToken(code: string): string | undefined {
  if (code === 'OFFLINE') return 'offline';
  const params = new URLSearchParams(location.search); const supplied = params.get('host');
  if (supplied) { localStorage.setItem(`riverton.host.${code}`, supplied); params.delete('host'); history.replaceState(null, '', `${location.pathname}${params.size ? '?' + params : ''}${location.hash}`); }
  return localStorage.getItem(`riverton.host.${code}`) ?? undefined;
}
export const isHostState = (state: unknown): state is HostState => !!state && typeof state === 'object' && 'connected' in state;
