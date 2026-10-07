import { TableClient, type TransactionAction } from '@azure/data-tables';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomInt } from 'node:crypto';
import type { Choice, Screen } from '../../shared/model';
export interface Participant { id: string; tokenHash: string; joinedAt: number; lastSeenAt: number; sample: boolean }
export interface Response { participantId: string; round: number; value: Choice; submittedAt: number }
export interface Session {
  code: string; id: string; tokenHash: string; createdAt: number; endedAt?: number; screen: Screen;
  round: number; votingOpen: boolean; epoch: number; demo: boolean; revision: number;
  participants: Participant[]; responses: Response[];
}
export interface Snapshot { data: Session; etag: string }
export interface Store { create(data: Session): Promise<boolean>; read(code: string): Promise<Snapshot | undefined>; commit(data: Session, previous: Snapshot): Promise<boolean> }
const status = (error: unknown) => (error as { statusCode?: number }).statusCode;
const meta = (s: Session) => { const { participants: _p, responses: _r, ...rest } = s; return rest; };

export class AzureStore implements Store {
  private client: TableClient;
  constructor(connection: string, table = 'Riverton') { this.client = TableClient.fromConnectionString(connection, table); }
  async create(data: Session) {
    try { await this.client.createEntity({ partitionKey: data.code, rowKey: 'session', json: JSON.stringify(meta(data)) }); return true; }
    catch (e) { if (status(e) === 409) return false; throw e; }
  }
  async read(code: string): Promise<Snapshot | undefined> {
    for (let attempt = 0; attempt < 40; attempt++) {
      let first;
      try { first = await this.client.getEntity<{ json: string }>(code, 'session'); }
      catch (e) { if (status(e) === 404) return undefined; throw e; }
      const data: Session = { ...JSON.parse(first.json), participants: [], responses: [] };
      for await (const row of this.client.listEntities<{ json: string }>({ queryOptions: { filter: `PartitionKey eq '${code}'` } })) {
        if (row.rowKey?.startsWith('p:')) data.participants.push(JSON.parse(row.json));
        if (row.rowKey?.startsWith(`r:${data.epoch}:`)) data.responses.push(JSON.parse(row.json));
      }
      const last = await this.client.getEntity(code, 'session');
      if (first.etag === last.etag) return { data, etag: first.etag! };
      await new Promise(resolve => setTimeout(resolve, randomInt(10, 40)));
    }
    throw new Error('Session is busy. Please retry.');
  }
  async commit(data: Session, previous: Snapshot) {
    const transactions: TransactionAction[] = [['update', { partitionKey: data.code, rowKey: 'session', json: JSON.stringify(meta(data)) }, 'Replace', { etag: previous.etag }]];
    for (const p of data.participants) {
      if (JSON.stringify(p) !== JSON.stringify(previous.data.participants.find(old => old.id === p.id)))
        transactions.push(['upsert', { partitionKey: data.code, rowKey: `p:${p.id}`, json: JSON.stringify(p) }, 'Replace']);
    }
    for (const r of data.responses) {
      if (data.epoch !== previous.data.epoch || !previous.data.responses.some(old => old.participantId === r.participantId && old.round === r.round))
        transactions.push(['create', { partitionKey: data.code, rowKey: `r:${data.epoch}:${r.participantId}:${r.round}`, json: JSON.stringify(r) }]);
    }
    if (transactions.length > 100) throw new Error('Transaction exceeds classroom batch size.');
    try { await this.client.submitTransaction(transactions); return true; }
    catch (e) { if ([409, 412].includes(status(e) ?? 0)) return false; throw e; }
  }
}

// One local API process; an atomic file rename persists rehearsal across restarts.
// Production always uses AzureStore. This store is never selected by azure.ts.
export class LocalStore implements Store {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private directory = resolve('.local/sessions')) {}
  private async exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const task = this.queue.then(fn); this.queue = task.catch(() => undefined); return task;
  }
  private file(code: string) { return resolve(this.directory, `${code}.json`); }
  async read(code: string): Promise<Snapshot | undefined> {
    try { const data: Session = JSON.parse(await readFile(this.file(code), 'utf8')); return { data, etag: String(data.revision) }; }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw e; }
  }
  private async write(data: Session) {
    await mkdir(this.directory, { recursive: true });
    await writeFile(`${this.file(data.code)}.tmp`, JSON.stringify(data));
    await rename(`${this.file(data.code)}.tmp`, this.file(data.code));
  }
  create(data: Session) { return this.exclusive(async () => { if (await this.read(data.code)) return false; await this.write(data); return true; }); }
  commit(data: Session, previous: Snapshot) { return this.exclusive(async () => {
    const current = await this.read(data.code); if (!current || current.etag !== previous.etag) return false;
    await this.write(data); return true;
  }); }
}
