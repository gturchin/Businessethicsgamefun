import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Engine, sampleAnswer, validateChoice } from '../src/engine';
import { LocalStore } from '../src/store';
import { handle } from '../src/http';
import { score } from '../src/scoring';
import type { Action, Choice, HostState } from '../../shared/model';

test('scoring requires all five choices and combines the whole pattern', () => {
  assert.equal(score({ 1: 'public' }), undefined);
  const paths: Record<string, Record<number, Choice>> = {
    public: { 1: 'public', 2: 8e6, 3: ['pollution', 'parks'], 4: 60, 5: 'reject' },
    corporate: { 1: 'private', 2: 0, 3: ['pollution', 'renewables'], 4: 40, 5: 'conditions' },
    community: { 1: 'shared', 2: 4e6, 3: ['hiring', 'monitoring'], 4: 100, 5: 'negotiate' },
    growth: { 1: 'private', 2: 1e6, 3: ['hiring', 'training'], 4: 0, 5: 'approve' },
    shared: { 1: 'shared', 2: 4e6, 3: ['hiring', 'training'], 4: 50, 5: 'conditions' }
  };
  for (const [strategy, answers] of Object.entries(paths)) {
    const result = score(answers)!; assert.equal(result.strategy, strategy, `representative ${strategy} pattern`);
    assert.ok(Object.values(result.priorities).every(v => v >= 0 && v <= 100));
    assert.deepEqual(score({ ...answers, 6: 'yes' }), result, 'final poll cannot change strategy');
  }
  const base = paths.shared;
  assert.notDeepEqual(score(base)?.priorities, score({ ...base, 2: 0 })?.priorities);
  assert.notDeepEqual(score(base)?.priorities, score({ ...base, 4: 100 })?.priorities);
  assert.notDeepEqual(score(base)?.priorities, score({ ...base, 3: ['pollution', 'monitoring'] })?.priorities);
});

test('boundaries reject invalid answers and demo answers are valid', () => {
  for (const [round, value] of [[1, 'anything'], [2, -1], [2, 8_000_001], [2, 1.5], [2, '3000000'], [3, ['hiring']], [3, ['hiring', 'hiring']], [3, ['hiring', 'other']], [4, NaN], [4, 101], [5, 'yes'], [6, 'maybe']] as [number, unknown][]) assert.throws(() => validateChoice(round, value));
  assert.equal(validateChoice(2, 3_000_001), 3_000_001);
  for (let round = 1; round <= 6; round++) for (let i = 0; i < 30; i++) assert.doesNotThrow(() => validateChoice(round, sampleAnswer(round, i)));
});

test('full class flow, permissions, duplicate races, reveal privacy, reset, persistence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'riverton-'));
  try {
    const engine = new Engine(new LocalStore(directory));
    const session = await engine.create(); const host = session.hostToken;
    assert.equal((await handle(engine, { method: 'GET', path: `/api/sessions/${session.code}/summary` })).status, 403);
    assert.equal((await handle(engine, { method: 'POST', path: `/api/sessions/${session.code}/control`, body: { action: 'open' }, token: 'wrong' })).status, 403);
    const students = await Promise.all(Array.from({ length: 30 }, () => engine.join(session.code)));
    const tokens = students.map(s => s.participantToken);
    assert.equal((await engine.state(session.code)).joined, 30, 'simultaneous joins preserve all seats');
    await engine.join(session.code, tokens[0]); assert.equal((await engine.state(session.code)).joined, 30);
    const action = (name: Action, confirmed = false) => engine.control(session.code, host, name, confirmed);
    await assert.rejects(engine.respond(session.code, tokens[0], 1, 'shared'));
    await action('intro');
    for (let round = 1; round <= 5; round++) {
      await action('open');
      const duplicate = await Promise.allSettled([engine.respond(session.code, tokens[0], round, sampleAnswer(round, 0)), engine.respond(session.code, tokens[0], round, sampleAnswer(round, 0))]);
      assert.equal(duplicate.filter(r => r.status === 'fulfilled').length, 1);
      await Promise.all(tokens.slice(1).map((token, i) => engine.respond(session.code, token, round, sampleAnswer(round, i + 1))));
      assert.equal((await engine.state(session.code)).aggregates, undefined, 'public state hides results');
      assert.equal((await engine.state(session.code)).submitted, 30);
      await action('close'); await assert.rejects(engine.respond(session.code, tokens[0], round, sampleAnswer(round, 0)));
      await action('reveal'); const display = await engine.state(session.code);
      assert.equal(display.aggregates!.rounds[round].count, 30); assert.equal(display.aggregates!.poll.items, undefined);
      if (round < 5) await action('next');
    }
    const student = await engine.state(session.code, tokens[0]); assert.ok(student.result); const original = student.result;
    const hostState = await engine.state(session.code, host, true) as HostState;
    assert.equal(hostState.aggregates.completed, 30);
    assert.equal(Object.values(hostState.aggregates.strategies).reduce((a, b) => a + b), 30);
    assert.equal(hostState.aggregates.rounds[3].items!.reduce((a, b) => a + b.count, 0), 60);
    for (const name of ['profile', 'real-world', 'method', 'valley', 'comparison', 'poll'] as Action[]) await action(name);
    await engine.respond(session.code, tokens[0], 6, 'no');
    assert.equal((await engine.state(session.code)).aggregates, undefined);
    await action('poll-reveal'); assert.equal((await engine.state(session.code)).aggregates!.poll.items?.find(i => i.id === 'no')?.count, 1);
    assert.deepEqual((await engine.state(session.code, tokens[0])).result, original);
    await assert.rejects(action('reset')); await action('reset', true);
    const reset = await engine.state(session.code, tokens[0]); assert.deepEqual(reset.answers, {}); assert.equal(reset.epoch, 1); assert.equal(reset.joined, 30);
    const freshEngine = new Engine(new LocalStore(directory)); assert.equal((await freshEngine.state(session.code)).joined, 30);
    assert.equal(JSON.stringify(await engine.state(session.code)).includes(host), false);
    await action('end', true); await assert.rejects(engine.join(session.code));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('demo and failsafe preserve real responses and complete sample strategies', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'riverton-demo-'));
  try {
    const engine = new Engine(new LocalStore(directory)); const s = await engine.create(true);
    assert.equal((await engine.state(s.code)).joined, 30);
    for (let r = 1; r <= 5; r++) { await engine.control(s.code, s.hostToken, 'open'); assert.equal((await engine.state(s.code)).submitted, 30); await engine.control(s.code, s.hostToken, 'reveal'); if (r < 5) await engine.control(s.code, s.hostToken, 'next'); }
    assert.equal((await engine.state(s.code, s.hostToken, true) as HostState).aggregates.completed, 30);
    const live = await engine.create(); const p = await engine.join(live.code); await engine.control(live.code, live.hostToken, 'open'); await engine.respond(live.code, p.participantToken, 1, 'private');
    await engine.control(live.code, live.hostToken, 'seed', true);
    assert.equal((await engine.state(live.code, p.participantToken)).answers![1], 'private');
    assert.equal((await engine.state(live.code)).submitted, 31);
    await engine.control(live.code, live.hostToken, 'seed', true); assert.equal((await engine.state(live.code)).joined, 31);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
