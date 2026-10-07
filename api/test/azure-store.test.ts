import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TableClient } from '@azure/data-tables';
import { AzureStore } from '../src/store';
import { Engine, sampleAnswer } from '../src/engine';
const connection = process.env.RIVERTON_TEST_STORAGE;
test('Azure Table transactions preserve concurrent joins, duplicates, reveals, and reset', { skip: !connection }, async () => {
  const table = 'Test' + Date.now(); const client = TableClient.fromConnectionString(connection!, table);
  await client.createTable();
  try {
    const engine = new Engine(new AzureStore(connection!, table)); const session = await engine.create();
    const workers = [engine, new Engine(new AzureStore(connection!, table)), new Engine(new AzureStore(connection!, table))];
    const students = await Promise.all(Array.from({ length: 30 }, (_, i) => workers[i % workers.length].join(session.code)));
    assert.equal((await engine.state(session.code)).joined, 30);
    await engine.control(session.code, session.hostToken, 'open');
    await Promise.all(students.map((p, i) => workers[i % workers.length].respond(session.code, p.participantToken, 1, sampleAnswer(1, i), 0)));
    assert.equal((await engine.state(session.code)).submitted, 30);
    await assert.rejects(engine.respond(session.code, students[0].participantToken, 1, 'public', 0));
    await engine.control(session.code, session.hostToken, 'reveal');
    const state = await engine.state(session.code); assert.equal(state.aggregates!.rounds[1].count, 30);
    assert.equal(state.aggregates!.rounds[1].items!.reduce((a, b) => a + b.count, 0), 30);
    await engine.control(session.code, session.hostToken, 'reset', true);
    await engine.control(session.code, session.hostToken, 'open');
    await assert.rejects(engine.respond(session.code, students[0].participantToken, 1, 'public', 0));
    await engine.respond(session.code, students[0].participantToken, 1, 'shared', 1);
    assert.equal((await engine.state(session.code)).submitted, 1);
  } finally { await client.deleteTable(); }
});
