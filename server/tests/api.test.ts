import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createServer } from 'node:net';
import EmbeddedPostgres from 'embedded-postgres';
import { connect } from '../src/db/connection.js';
import { applyMigrations } from '../src/db/migrate.js';
import { seedIdentity } from '../src/db/seed.js';
import { parseEnv } from '../src/config/env.js';
import { buildApp } from '../src/app.js';
import type { SaveRequest } from '../../contracts/index.js';
import { memberships } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

let postgres: EmbeddedPostgres;
let connection: ReturnType<typeof connect>;
let app: ReturnType<typeof buildApp>;
let other: ReturnType<typeof buildApp>;
let directory: string;
const schoolId = randomUUID(); const userId = randomUUID();
const identity = () => ({ id: randomUUID(), context: { classId: 'prototype:class:1', subjectId: 'prototype:subject:science', classLabel: 'STD 1', subjectLabel: 'Science' } });
function saveBody(sessionId: string): SaveRequest {
  return { mutationId: randomUUID(), baseServerRevision: 0, document: { schemaVersion: 1, id: randomUUID(),
    owner: { sessionId, classId: 'prototype:class:1', subjectId: 'prototype:subject:science', target: { kind: 'whiteboard' } },
    localRevision: 1, bounds: { width: 1200, height: 675 }, objects: [{ id: randomUUID(), kind: 'ink', tool: 'pen', color: '#000000', width: 3, points: [20, 20] }],
  } };
}
async function create() {
  const session = identity();
  expect((await app.inject({ method: 'POST', url: '/api/v1/sessions', payload: session })).statusCode).toBe(200);
  return session;
}
const put = (body: SaveRequest, client = app) => client.inject({ method: 'PUT', url: `/api/v1/sessions/${body.document.owner.sessionId}/documents/${body.document.id}`, payload: body });
beforeAll(async () => {
  const port = await new Promise<number>(resolve => { const server = createServer(); server.listen(0, '127.0.0.1', () => {
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('Port unavailable');
    server.close(() => resolve(address.port));
  }); });
  directory = await mkdtemp(join(tmpdir(), 'meerkats-pg-test-'));
  const password = randomUUID();
  // Unique disposable cluster; never reads DATABASE_URL or touches the development database.
  postgres = new EmbeddedPostgres({ databaseDir: directory, user: 'postgres', password, port, persistent: true,
    authMethod: 'scram-sha-256', postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
  await postgres.initialise(); await postgres.start(); await postgres.createDatabase('meerkats_test');
  const url = `postgresql://postgres:${password}@127.0.0.1:${port}/meerkats_test`;
  await applyMigrations(url); await applyMigrations(url);
  connection = connect(url);
  const config = parseEnv({ NODE_ENV: 'test', DATABASE_URL: url, DEV_IDENTITY_ENABLED: 'true', DEV_USER_ID: userId,
    DEV_SCHOOL_ID: schoolId, ALLOWED_ORIGIN: 'http://127.0.0.1:5173' });
  await seedIdentity(connection.db, config); app = buildApp(connection.db, config);
  const otherConfig = { ...config, DEV_USER_ID: randomUUID(), DEV_SCHOOL_ID: randomUUID() };
  await seedIdentity(connection.db, otherConfig); other = buildApp(connection.db, otherConfig);
});
afterAll(async () => {
  await app?.close(); await other?.close(); await connection?.pool.end(); if (postgres) await postgres.stop();
  // Only the unique temporary cluster created by this test may be removed; retry Windows process-handle release.
  if (directory && resolve(directory).startsWith(resolve(tmpdir()) + sep + 'meerkats-pg-test-'))
    await rm(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 150 });
});

describe('real PostgreSQL API', () => {
  it('applies migrations repeatably and reports readiness', async () => {
    expect((await app.inject('/api/v1/ready')).statusCode).toBe(200);
    const result = await connection.pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    expect(result.rows.map((r: { tablename: string }) => r.tablename)).toEqual(expect.arrayContaining(['schools', 'users', 'school_memberships', 'teaching_sessions', 'documents', 'save_receipts']));
  });
  it('creates, retrieves and safely retries session creation', async () => {
    const session = await create();
    expect((await app.inject(`/api/v1/sessions/${session.id}`)).json()).toEqual({ ...session, documents: [] });
    expect((await app.inject({ method: 'POST', url: '/api/v1/sessions', payload: session })).statusCode).toBe(200);
  });
  it('saves, increments server revisions and retrieves exact committed ink', async () => {
    const session = await create(); const body = saveBody(session.id);
    const first = await put(body); expect(first.statusCode).toBe(200); expect(first.json()).toMatchObject({ serverRevision: 1, durable: true });
    const second = await put({ ...body, mutationId: randomUUID(), baseServerRevision: 1, document: { ...body.document, localRevision: 2, objects: [] } });
    expect(second.json()).toMatchObject({ serverRevision: 2 });
    expect((await app.inject(`/api/v1/sessions/${session.id}`)).json().documents[0]).toMatchObject({ serverRevision: 2, document: { objects: [], localRevision: 2 } });
  });
  it('returns identical acknowledgement on duplicate retry and rejects changed mutation reuse', async () => {
    const body = saveBody((await create()).id); const first = await put(body);
    expect((await put(body)).json()).toEqual(first.json());
    expect((await put({ ...body, document: { ...body.document, objects: [] } })).json()).toEqual({ error: 'mutation_reused' });
  });
  it('rejects stale saves without replacing the newer document', async () => {
    const body = saveBody((await create()).id); await put(body);
    expect((await put({ ...body, mutationId: randomUUID() })).statusCode).toBe(409);
    expect((await app.inject(`/api/v1/sessions/${body.document.owner.sessionId}`)).json().documents[0].serverRevision).toBe(1);
  });
  it('serializes concurrent first saves and acknowledges only one', async () => {
    const body = saveBody((await create()).id);
    const results = await Promise.all([put(body), put({ ...body, mutationId: randomUUID() })]);
    expect(results.map(r => r.statusCode).sort()).toEqual([200, 409]);
  });
  it('denies cross-school reads, session collisions and writes', async () => {
    const session = await create(); const body = saveBody(session.id); await put(body);
    expect((await other.inject(`/api/v1/sessions/${session.id}`)).statusCode).toBe(404);
    expect((await other.inject({ method: 'POST', url: '/api/v1/sessions', payload: session })).statusCode).toBe(404);
    expect((await put(body, other)).statusCode).toBe(404);
  });
  it('rejects malformed ink, unsupported versions, extra school IDs and ownership mismatch', async () => {
    const session = await create(); const body = saveBody(session.id);
    for (const document of [{ ...body.document, schemaVersion: 99 }, { ...body.document, objects: [{ ...body.document.objects[0], points: [1] }] }]) {
      expect((await app.inject({ method: 'PUT', url: `/api/v1/sessions/${session.id}/documents/${body.document.id}`, payload: { ...body, document } })).statusCode).toBe(400);
    }
    expect((await app.inject({ method: 'POST', url: '/api/v1/sessions', payload: { ...session, schoolId } })).statusCode).toBe(400);
    expect((await put({ ...body, document: { ...body.document, owner: { ...body.document.owner, classId: 'wrong' } } })).statusCode).toBe(400);
  });
  it('rejects unapproved origin and oversized payloads', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/v1/sessions', headers: { origin: 'https://untrusted.example' }, payload: identity() })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/v1/sessions', payload: { ...identity(), extra: 'x'.repeat(2200000) } })).statusCode).toBe(413);
  });
  it('checks active membership on every request', async () => {
    await connection.db.update(memberships).set({ active: 0 }).where(eq(memberships.userId, userId));
    expect((await app.inject({ method: 'POST', url: '/api/v1/sessions', payload: identity() })).statusCode).toBe(403);
    await connection.db.update(memberships).set({ active: 1 }).where(eq(memberships.userId, userId));
  });
  it('does not allow an owned session to reuse another session document ID or target slot', async () => {
    const body = saveBody((await create()).id); await put(body);
    const anotherSession = await create();
    expect((await put({ ...body, mutationId: randomUUID(), document: { ...body.document, owner: { ...body.document.owner, sessionId: anotherSession.id } } })).statusCode).toBe(404);
    expect((await put({ ...body, mutationId: randomUUID(), document: { ...body.document, id: randomUUID() } })).json()).toEqual({ error: 'anchor_conflict' });
  });
  it('returns the original retry receipt even after the document advances', async () => {
    const body = saveBody((await create()).id); const original = (await put(body)).json();
    await put({ ...body, mutationId: randomUUID(), baseServerRevision: 1, document: { ...body.document, localRevision: 2, objects: [] } });
    expect((await put(body)).json()).toEqual(original);
    expect((await app.inject(`/api/v1/sessions/${body.document.owner.sessionId}`)).json().documents[0].serverRevision).toBe(2);
  });
  it('never overwrites another school when two new documents concurrently claim the same UUID', async () => {
    const firstSession = await create(); const secondSession = identity();
    expect((await other.inject({ method: 'POST', url: '/api/v1/sessions', payload: secondSession })).statusCode).toBe(200);
    const firstBody = saveBody(firstSession.id);
    const secondBody = { ...saveBody(secondSession.id), document: { ...firstBody.document, owner: { ...firstBody.document.owner, sessionId: secondSession.id } } };
    const results = await Promise.all([put(firstBody), put(secondBody, other)]);
    expect(results.filter(result => result.statusCode === 200)).toHaveLength(1);
    expect(results.filter(result => [404, 409].includes(result.statusCode))).toHaveLength(1);
    const first = (await app.inject(`/api/v1/sessions/${firstSession.id}`)).json();
    const second = (await other.inject(`/api/v1/sessions/${secondSession.id}`)).json();
    for (const session of [first, second])
      for (const document of session.documents) expect(document.document.owner.sessionId).toBe(session.id);
  });
});
