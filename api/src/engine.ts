import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { Action, Aggregates, Choice, HostState, PublicState, RoundStats, Strategy } from '../../shared/model';
import { commitments, expansion, plans, pollChoices } from '../../shared/content';
import { score } from './scoring';
import type { Participant, Session, Store } from './store';
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const secureToken = () => randomBytes(32).toString('base64url');
function matches(token: string | undefined, digest: string) { return !!token && token.length <= 256 && timingSafeEqual(Buffer.from(hash(token)), Buffer.from(digest)); }
const fail = (message: string, status = 409): never => { throw new ApiError(status, message); };
export function validateChoice(round: number, value: unknown): Choice {
  if (round === 1 && plans.some(p => p.id === value)) return value as string;
  if (round === 2 && typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 8_000_000) return value;
  if (round === 3 && Array.isArray(value) && value.length === 2 && value[0] !== value[1] && value.every(v => commitments.some(c => c.id === v))) return [...value].sort();
  if (round === 4 && typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100) return value;
  if (round === 5 && expansion.some(p => p.id === value)) return value as string;
  if (round === 6 && pollChoices.some(p => p.id === value)) return value as string;
  return fail('Choose a valid answer for this round.', 400);
}
export function sampleAnswer(round: number, index: number): Choice {
  const wave = (index * 7 + index % 4 * 3) % 30;
  if (round === 1) return wave < 7 ? 'public' : wave < 12 ? 'private' : 'shared';
  if (round === 2) return Math.min(8_000_000, Math.max(0, 1_000_000 + wave * 170_000));
  if (round === 3) { const a = ['pollution', 'hiring', 'pollution', 'training', 'monitoring', 'renewables'][index % 6]; const b = commitments[(index * 3 + Math.floor(index / 6)) % 6].id; return [a, a === b ? 'parks' : b]; }
  if (round === 4) return Math.min(100, 10 + wave * 3);
  if (round === 5) return wave < 4 ? 'approve' : wave < 16 ? 'conditions' : wave < 27 ? 'negotiate' : 'reject';
  return wave < 4 ? 'yes' : wave < 23 ? 'no' : 'depends';
}
function stats(session: Session, round: number): RoundStats {
  const responses = session.responses.filter(r => r.round === round);
  const count = responses.length;
  if (round === 2 || round === 4) {
    const values = responses.map(r => Number(r.value));
    return { count, average: count ? values.reduce((a, b) => a + b, 0) / count : 0,
      ...(round === 4 ? { bins: Array.from({ length: 10 }, (_, i) => values.filter(v => Math.min(9, Math.floor(v / 10)) === i).length) } : {}) };
  }
  const options = round === 1 ? plans : round === 3 ? commitments : round === 5 ? expansion : pollChoices;
  return { count, items: options.map(option => {
    const selected = responses.filter(r => Array.isArray(r.value) ? r.value.includes(option.id) : r.value === option.id).length;
    return { id: option.id, count: selected, percent: count ? selected / count * 100 : 0 };
  }) };
}
export function aggregate(session: Session): Aggregates {
  const results = session.participants.map(p => score(Object.fromEntries(session.responses.filter(r => r.participantId === p.id && r.round <= 5).map(r => [r.round, r.value])))).filter(r => r !== undefined);
  const strategies = Object.fromEntries(['public', 'corporate', 'community', 'growth', 'shared'].map(key => [key, results.filter(r => r.strategy === key).length])) as Record<Strategy, number>;
  const priorities = { government: 0, business: 0, community: 0, environment: 0, economy: 0 };
  for (const key of Object.keys(priorities) as (keyof typeof priorities)[]) priorities[key] = results.length ? Math.round(results.reduce((sum, r) => sum + r.priorities[key], 0) / results.length) : 0;
  return { rounds: Object.fromEntries([1, 2, 3, 4, 5].map(r => [r, stats(session, r)])), strategies, priorities, completed: results.length, poll: stats(session, 6) };
}
export class Engine {
  private writes = new Map<string, Promise<unknown>>();
  constructor(private store: Store) {}
  async get(code: string) {
    if (!/^RIVER[A-Z2-9]{3}$/.test(code)) fail('Enter the complete class code.', 400);
    const snapshot = await this.store.read(code);
    if (!snapshot) return fail('Class session not found. Check the code.', 404);
    if (Date.now() - snapshot.data.createdAt > 24 * 60 * 60_000) fail('This session has expired. Ask the presenter for a new code.', 410);
    return snapshot;
  }
  private mutate<T>(code: string, fn: (s: Session) => T): Promise<T> {
    // Avoid a classroom burst competing with itself on one Functions worker.
    // ETags still protect writes made by other workers or app instances.
    const previous = this.writes.get(code) ?? Promise.resolve();
    const task = previous.catch(() => undefined).then(() => this.mutateWithRetry(code, fn));
    this.writes.set(code, task);
    return task.finally(() => { if (this.writes.get(code) === task) this.writes.delete(code); });
  }
  private async mutateWithRetry<T>(code: string, fn: (s: Session) => T): Promise<T> {
    for (let tries = 0; tries < 30; tries++) {
      const snapshot = await this.get(code); const next = structuredClone(snapshot.data);
      const value = fn(next); next.revision++;
      if (await this.store.commit(next, snapshot)) return value;
      await new Promise(resolve => setTimeout(resolve, randomInt(10, 50)));
    }
    return fail('Riverton is busy. Please try again.', 503);
  }
  private host(s: Session, token?: string) { if (!matches(token, s.tokenHash)) fail('Presenter access required. Reopen your saved control link.', 403); }
  private participant(s: Session, token?: string): Participant {
    const p = s.participants.find(p => matches(token, p.tokenHash));
    if (!p || p.sample) return fail('Your seat could not be verified. Rejoin this class.', 403);
    return p;
  }
  async create(demo = false) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const code = 'RIVER' + Array.from({ length: 3 }, () => alphabet[randomInt(alphabet.length)]).join('');
      const token = secureToken(); const now = Date.now();
      const s: Session = { code, id: randomBytes(16).toString('hex'), tokenHash: hash(token), createdAt: now, screen: 'lobby', round: 0, votingOpen: false, epoch: 0, demo, revision: 0, participants: [], responses: [] };
      if (await this.store.create(s)) {
        if (demo) await this.addSamples(code, token);
        return { code, hostToken: token };
      }
    }
    return fail('Could not allocate a session code. Try again.', 503);
  }
  async join(code: string, token?: string) {
    if (token) { const { data } = await this.get(code); this.participant(data, token); return { participantToken: token }; }
    const newToken = secureToken();
    await this.mutate(code, s => {
      if (s.screen === 'ended') fail('This class has ended.', 410);
      if (s.participants.length >= 120) fail('This class is full.', 409);
      const now = Date.now(); s.participants.push({ id: randomBytes(12).toString('hex'), tokenHash: hash(newToken), joinedAt: now, lastSeenAt: now, sample: false });
    });
    return { participantToken: newToken };
  }
  async state(code: string, token?: string, presenter = false): Promise<PublicState | HostState> {
    let { data: s } = await this.get(code);
    if (presenter) this.host(s, token);
    else if (token) {
      const p = this.participant(s, token);
      if (s.screen !== 'ended' && Date.now() - p.lastSeenAt > 30_000) {
        await this.mutate(code, next => { this.participant(next, token).lastSeenAt = Date.now(); });
        s = (await this.get(code)).data;
      }
    }
    const state: PublicState = { code, screen: s.screen, round: s.round, votingOpen: s.votingOpen, epoch: s.epoch, joined: s.participants.length,
      submitted: s.responses.filter(r => r.round === s.round).length, pollSubmitted: s.responses.filter(r => r.round === 6).length, createdAt: s.createdAt, endedAt: s.endedAt };
    if (token && !presenter) {
      const p = this.participant(s, token);
      state.answers = Object.fromEntries(s.responses.filter(r => r.participantId === p.id && r.round <= 5).map(r => [r.round, r.value]));
      state.pollAnswer = s.responses.find(r => r.participantId === p.id && r.round === 6)?.value as string | undefined;
      state.result = score(state.answers);
    }
    if (presenter) return { ...state, aggregates: aggregate(s), demo: s.demo, sampleCount: s.participants.filter(p => p.sample).length, connected: s.participants.filter(p => p.sample || Date.now() - p.lastSeenAt < 120_000).length };
    if (['round-results', 'class-profile', 'real-world', 'method', 'valley', 'comparison', 'poll-results', 'ended'].includes(s.screen)) {
      const all = aggregate(s);
      // Only reveal the current round on its results screen. Final poll stays
      // private until its own reveal, including when someone loads /display.
      state.aggregates = { rounds: s.screen === 'round-results' ? { [s.round]: all.rounds[s.round] } : {},
        strategies: s.round === 5 && s.screen !== 'round-results' ? all.strategies : { public: 0, corporate: 0, community: 0, growth: 0, shared: 0 },
        priorities: s.round === 5 && s.screen !== 'round-results' ? all.priorities : { government: 0, business: 0, community: 0, environment: 0, economy: 0 },
        completed: all.completed, poll: ['poll-results', 'ended'].includes(s.screen) ? all.poll : { count: state.pollSubmitted } };
    }
    return state;
  }
  async respond(code: string, token: string | undefined, round: number, value: unknown, epoch?: number) {
    const answer = validateChoice(round, value);
    return this.mutate(code, s => {
      const p = this.participant(s, token);
      if (epoch !== undefined && epoch !== s.epoch) fail('This class was reset. Refresh before making another decision.');
      if (!s.votingOpen || (round === 6 ? s.screen !== 'poll' : s.screen !== 'round' || s.round !== round)) fail('Voting is closed for this round.');
      if (s.responses.some(r => r.participantId === p.id && r.round === round)) fail('Your decision is already locked.');
      s.responses.push({ participantId: p.id, round, value: answer, submittedAt: Date.now() });
      p.lastSeenAt = Date.now(); return { accepted: true };
    });
  }
  private async addSamples(code: string, token: string) {
    await this.mutate(code, s => {
      this.host(s, token); if (s.participants.some(p => p.sample)) return;
      if (s.participants.length > 90) fail('Too many participants to add a demo class.');
      for (let i = 0; i < 30; i++) s.participants.push({ id: `sample${i}`, tokenHash: hash(secureToken()), joinedAt: Date.now(), lastSeenAt: Date.now(), sample: true });
    });
  }
  private async seedRound(code: string, token: string, round: number) {
    await this.mutate(code, s => {
      this.host(s, token);
      s.participants.filter(p => p.sample).forEach((p, i) => {
        if (!s.responses.some(r => r.participantId === p.id && r.round === round)) s.responses.push({ participantId: p.id, round, value: validateChoice(round, sampleAnswer(round, i)), submittedAt: Date.now() });
      });
    });
  }
  async control(code: string, token: string | undefined, action: Action, confirmed = false) {
    await this.mutate(code, s => {
      this.host(s, token);
      if (['reset', 'end', 'seed'].includes(action) && !confirmed) fail('Confirm this presenter action.', 400);
      if (s.screen === 'ended' && action !== 'reset') fail('This session has ended. Reset to start again.');
      switch (action) {
        case 'intro': if (s.screen !== 'lobby') fail('The introduction is available from the lobby.'); s.screen = 'intro'; break;
        case 'open':
          if (!['lobby', 'intro', 'round'].includes(s.screen) || s.votingOpen) fail('Reveal the previous round before opening another.');
          if (s.round === 0) s.round = 1; s.screen = 'round'; s.votingOpen = true; break;
        case 'close': if (!s.votingOpen) fail('Voting is already closed.'); s.votingOpen = false; break;
        case 'reveal': if (s.screen !== 'round') fail('Open a round first.'); s.votingOpen = false; s.screen = 'round-results'; break;
        case 'next': if (s.screen !== 'round-results' || s.round >= 5) fail('Reveal this round before advancing.'); s.round++; s.screen = 'round'; s.votingOpen = false; break;
        case 'profile': if (s.screen !== 'round-results' || s.round !== 5) fail('Finish the fifth round first.'); s.screen = 'class-profile'; break;
        case 'real-world': if (s.screen !== 'class-profile') fail('Show the class profile first.'); s.screen = 'real-world'; break;
        case 'method': if (s.screen !== 'real-world') fail('Start the real-world reveal first.'); s.screen = 'method'; break;
        case 'valley': if (s.screen !== 'method') fail('Show Method first.'); s.screen = 'valley'; break;
        case 'comparison': if (s.screen !== 'valley') fail('Show Menomonee Valley first.'); s.screen = 'comparison'; break;
        case 'poll': if (s.screen !== 'comparison') fail('Show the case comparison first.'); s.screen = 'poll'; s.votingOpen = true; break;
        case 'poll-reveal': if (s.screen !== 'poll') fail('Open the final poll first.'); s.screen = 'poll-results'; s.votingOpen = false; break;
        case 'end': s.screen = 'ended'; s.votingOpen = false; s.endedAt = Date.now(); break;
        case 'reset': s.epoch++; s.round = 0; s.screen = 'lobby'; s.votingOpen = false; s.responses = []; delete s.endedAt; break;
        case 'seed': break;
        default: fail('Unknown presenter action.', 400);
      }
    });
    const s = (await this.get(code)).data;
    if (action === 'seed') {
      await this.addSamples(code, token!);
      for (let r = 1; r <= s.round; r++) await this.seedRound(code, token!, r);
      if (s.screen === 'poll') await this.seedRound(code, token!, 6);
    } else if (s.demo && action === 'open') await this.seedRound(code, token!, s.round);
    else if (s.demo && action === 'poll') await this.seedRound(code, token!, 6);
    return { updated: true };
  }
}
