import type { Action, Aggregates, HostState } from '../shared/model';
import { commitments, expansion, plans, pollChoices } from '../shared/content';
const key = 'riverton.offline';
// Deliberately illustrative, precomputed backup results. The actual live scoring
// implementation stays in the API and is never bundled into student screens.
const fixture: Aggregates = {
  rounds: {
    1: { count: 30, items: plans.map((p, i) => ({ id: p.id, count: [7, 6, 17][i], percent: [7, 6, 17][i] / 30 * 100 })) },
    2: { count: 30, average: 3_100_000 },
    3: { count: 30, items: commitments.map((c, i) => ({ id: c.id, count: [17, 9, 14, 9, 5, 6][i], percent: [17, 9, 14, 9, 5, 6][i] / 30 * 100 })) },
    4: { count: 30, average: 62, bins: [0, 1, 1, 2, 3, 4, 5, 6, 5, 3] },
    5: { count: 30, items: expansion.map((p, i) => ({ id: p.id, count: [3, 12, 12, 3][i], percent: [10, 40, 40, 10][i] })) }
  }, completed: 30, strategies: { public: 3, corporate: 5, community: 7, growth: 1, shared: 14 },
  priorities: { government: 58, business: 72, community: 64, environment: 75, economy: 76 },
  poll: { count: 30, items: pollChoices.map((p, i) => ({ id: p.id, count: [3, 21, 6][i], percent: [10, 70, 20][i] })) }
};
function initial(): HostState { return { code: 'RIVER27X', screen: 'intro', round: 0, votingOpen: false, epoch: 0, joined: 30, submitted: 0, pollSubmitted: 0, createdAt: Date.now(), connected: 30, demo: true, sampleCount: 30, aggregates: fixture }; }
export function backupState(): HostState { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initial(); }
export function backupAction(action: Action) {
  let s = backupState();
  switch (action) {
    case 'intro': s.screen = 'intro'; break;
    case 'open': s.round ||= 1; s.screen = 'round'; s.votingOpen = true; s.submitted = 30; break;
    case 'close': s.votingOpen = false; break;
    case 'reveal': s.screen = 'round-results'; s.votingOpen = false; break;
    case 'next': s.round++; s.screen = 'round'; s.votingOpen = false; s.submitted = 0; break;
    case 'profile': s.screen = 'class-profile'; break;
    case 'real-world': s.screen = 'real-world'; break;
    case 'method': s.screen = 'method'; break;
    case 'valley': s.screen = 'valley'; break;
    case 'comparison': s.screen = 'comparison'; break;
    case 'poll': s.screen = 'poll'; s.votingOpen = true; s.pollSubmitted = 30; break;
    case 'poll-reveal': s.screen = 'poll-results'; s.votingOpen = false; break;
    case 'end': s.screen = 'ended'; s.votingOpen = false; break;
    case 'reset': s = initial(); break;
    case 'seed': s.submitted = s.round ? 30 : 0; break;
  }
  localStorage.setItem(key, JSON.stringify(s)); return { updated: true };
}
