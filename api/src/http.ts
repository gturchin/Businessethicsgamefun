import type { Action } from '../../shared/model';
import { ApiError, type Engine } from './engine';
export interface Input { method: string; path: string; token?: string; body?: unknown }
export async function handle(engine: Engine, input: Input): Promise<{ status: number; body: unknown }> {
  try {
    const parts = input.path.replace(/^\/api\/?/, '').split('/').filter(Boolean);
    const body = input.body as Record<string, unknown> | undefined;
    if (input.method === 'POST' && (!body || typeof body !== 'object' || Array.isArray(body))) throw new ApiError(400, 'Send a JSON object.');
    if (parts[0] !== 'sessions') throw new ApiError(404, 'Endpoint not found.');
    if (parts.length === 1 && input.method === 'POST') {
      if (body?.demo !== undefined && typeof body.demo !== 'boolean') throw new ApiError(400, 'Demo must be true or false.');
      return { status: 201, body: await engine.create(body?.demo === true) };
    }
    if (parts.length !== 3) throw new ApiError(404, 'Endpoint not found.');
    const code = parts[1].toUpperCase(); const endpoint = parts[2];
    if (input.method === 'GET' && ['state', 'display', 'summary'].includes(endpoint)) return { status: 200, body: await engine.state(code, input.token, endpoint === 'summary') };
    if (input.method === 'POST') {
      if (endpoint === 'join') return { status: 200, body: await engine.join(code, input.token) };
      if (endpoint === 'responses') {
        if (!Number.isInteger(body?.epoch) || Number(body?.epoch) < 0) throw new ApiError(400, 'A current session version is required.');
        if (!Number.isInteger(body?.round) || Number(body?.round) < 1 || Number(body?.round) > 5) throw new ApiError(400, 'Choose a valid round.');
        return { status: 201, body: await engine.respond(code, input.token, Number(body?.round), body?.value, Number(body?.epoch)) };
      }
      if (endpoint === 'final-poll') {
        if (!Number.isInteger(body?.epoch) || Number(body?.epoch) < 0) throw new ApiError(400, 'A current session version is required.');
        return { status: 201, body: await engine.respond(code, input.token, 6, body?.value, Number(body?.epoch)) };
      }
      if (endpoint === 'control') return { status: 200, body: await engine.control(code, input.token, body?.action as Action, body?.confirmed === true) };
    }
    throw new ApiError(404, 'Endpoint not found.');
  } catch (e) {
    if (e instanceof ApiError) return { status: e.status, body: { error: e.message } };
    // Logs contain no request body, URLs, credentials, or participant tokens.
    console.error('Riverton storage operation failed.', (e as { name?: string }).name ?? 'Error');
    return { status: 503, body: { error: 'Riverton is reconnecting. Keep this page open and try again.' } };
  }
}
