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
import { seedCatalog, publishVersion } from '../src/modules/catalog.js';
import { DEMO, demoVersion } from '../../contracts/demo.js';
import { CHEMISTRY, chemistryVersion } from '../../contracts/chemistry.js';
import { catalogSchema, initialProgress, lessonVersionSchema, type ProgressSave } from '../../contracts/lesson.js';

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
  await seedCatalog(connection.db);
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

describe('Phase 5 chemistry publication and progress', () => {
  it('seeds the exact source-mapped version idempotently without changing the neutral demo', async () => {
    await seedCatalog(connection.db);
    const catalog = catalogSchema.parse((await app.inject('/api/v1/catalog')).json());
    expect(catalog.lessons.find(l => l.id === CHEMISTRY.lesson)?.publishedVersionId).toBe(CHEMISTRY.version);
    expect((await app.inject(`/api/v1/lesson-versions/${CHEMISTRY.version}`)).json()).toEqual(chemistryVersion);
    expect((await app.inject(`/api/v1/lesson-versions/${DEMO.version}`)).json()).toEqual(demoVersion);
    await expect(connection.pool.query('UPDATE lesson_versions SET version = 55 WHERE id = $1', [CHEMISTRY.version])).rejects.toThrow('immutable');
  });
  it('persists chemistry runtime through the existing protocol and rejects invalid or foreign state', async () => {
    const session = { id: randomUUID(), lessonVersionId: CHEMISTRY.version,
      context: { classId: CHEMISTRY.class, subjectId: CHEMISTRY.subject, classLabel: 'Standard X', subjectLabel: 'Chemistry' } };
    expect((await app.inject({ method: 'POST', url: '/api/v1/sessions', payload: session })).statusCode).toBe(200);
    const body: ProgressSave = { mutationId: randomUUID(), baseServerRevision: 0, progress: initialProgress(chemistryVersion) };
    const activity = chemistryVersion.activities[4]!;
    body.progress.currentActivityId = activity.id;
    body.progress.states[activity.id] = { kind: 'molecule-builder', structureId: 'methylbutane', visibleCount: 5, candidateId: null,
      direction: null, revealed: false, nameParts: ['branch'], focusPart: 'branch' };
    const url = `/api/v1/sessions/${session.id}/progress`;
    const response = await app.inject({ method: 'PUT', url, payload: body }); expect(response.statusCode).toBe(200);
    expect((await app.inject({ method: 'PUT', url, payload: body })).json()).toEqual(response.json());
    expect((await app.inject(`/api/v1/sessions/${session.id}`)).json().progress).toEqual(body.progress);
    expect((await other.inject({ method: 'PUT', url, payload: body })).statusCode).toBe(404);
    const malformed = { ...body, mutationId: randomUUID(), baseServerRevision: 1, progress: { ...body.progress,
      states: { ...body.progress.states, [activity.id]: { ...body.progress.states[activity.id], structureId: 'invented' } } } };
    expect((await app.inject({ method: 'PUT', url, payload: malformed })).statusCode).toBe(400);
    await expect(publishVersion(connection.db, { ...chemistryVersion, id: randomUUID(), version: 2,
      activities: [{ ...activity, config: { stage: 'name', structures: [] } }] })).rejects.toThrow();
  });
});

describe('Phase 4 catalog, immutable lessons and durable activity progress', () => {
  const lessonIdentity = () => ({ id: randomUUID(), lessonVersionId: DEMO.version,
    context: { classId: DEMO.class, subjectId: DEMO.subject, classLabel: 'Demo class', subjectLabel: 'Visual exploration' } });
  async function lessonSession() {
    const session = lessonIdentity();
    expect((await app.inject({ method: 'POST', url: '/api/v1/sessions', payload: session })).statusCode).toBe(200);
    return session;
  }
  const progressBody = (): ProgressSave => ({ mutationId: randomUUID(), baseServerRevision: 0, progress: initialProgress(demoVersion) });
  const progressPut = (id: string, payload: ProgressSave, client = app) => client.inject({ method: 'PUT', url: `/api/v1/sessions/${id}/progress`, payload });
  it('retrieves the ordered shared neutral catalog and exact published version', async () => {
    const response = await app.inject('/api/v1/catalog'); expect(response.statusCode).toBe(200);
    const catalog = catalogSchema.parse(response.json()); expect(catalog.nodes.map(n => n.kind)).toContain('topic');
    expect(catalog.lessons[0]?.publishedVersionId).toBe(DEMO.version);
    expect(lessonVersionSchema.parse((await app.inject(`/api/v1/lesson-versions/${DEMO.version}`)).json())).toEqual(demoVersion);
    expect((await app.inject(`/api/v1/lesson-versions/${randomUUID()}`)).statusCode).toBe(404);
  });
  it('denies catalog access without active membership', async () => {
    await connection.db.update(memberships).set({ active: 0 }).where(eq(memberships.schoolId, schoolId));
    try {
      expect((await app.inject('/api/v1/catalog')).statusCode).toBe(403);
      expect((await app.inject(`/api/v1/lesson-versions/${DEMO.version}`)).statusCode).toBe(403);
    } finally { await connection.db.update(memberships).set({ active: 1 }).where(eq(memberships.schoolId, schoolId)); }
  });
  it('rejects malformed definitions, unknown kinds and unsupported schemas at publication', async () => {
    await expect(publishVersion(connection.db, { ...demoVersion, schemaVersion: 99 })).rejects.toThrow();
    await expect(publishVersion(connection.db, { ...demoVersion, activities: [{ ...demoVersion.activities[0], kind: 'unknown' }] })).rejects.toThrow();
    await expect(publishVersion(connection.db, { ...demoVersion, activities: [] })).rejects.toThrow();
  });
  it('enforces published immutability in PostgreSQL, including direct update/delete', async () => {
    await expect(connection.pool.query('UPDATE lesson_versions SET version = 55 WHERE id = $1', [DEMO.version])).rejects.toThrow('immutable');
    await expect(connection.pool.query('DELETE FROM lesson_versions WHERE id = $1', [DEMO.version])).rejects.toThrow('immutable');
    await seedCatalog(connection.db);
    expect((await app.inject(`/api/v1/lesson-versions/${DEMO.version}`)).json()).toEqual(demoVersion);
  });
  it('keeps an existing session pinned after publishing a newer definition', async () => {
    const session = await lessonSession(); const next = { ...demoVersion, id: randomUUID(), version: 2, title: 'Updated original demo' };
    await publishVersion(connection.db, next);
    const restored = (await app.inject(`/api/v1/sessions/${session.id}`)).json();
    expect(restored.lessonVersionId).toBe(DEMO.version);
    expect((await app.inject({ method: 'POST', url: '/api/v1/sessions', payload: { ...session, lessonVersionId: next.id } })).statusCode).toBe(409);
    await expect(connection.pool.query('UPDATE teaching_sessions SET lesson_version_id = $1 WHERE id = $2', [next.id, session.id])).rejects.toThrow('immutable');
    expect((await app.inject(`/api/v1/lesson-versions/${DEMO.version}`)).json().title).toBe(demoVersion.title);
  });
  it('rejects inconsistent lesson context and unknown pins', async () => {
    const session = lessonIdentity();
    expect((await app.inject({ method: 'POST', url: '/api/v1/sessions', payload: { ...session, context: { ...session.context, classId: 'other' } } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/v1/sessions', payload: { ...session, lessonVersionId: randomUUID() } })).statusCode).toBe(404);
  });
  it('persists bounded progress with exact idempotent retries and optimistic concurrency', async () => {
    const session = await lessonSession(); const body = progressBody();
    const reveal = demoVersion.activities[2]!;
    body.progress.currentActivityId = reveal.id; body.progress.states[reveal.id] = { kind: 'reveal', revealed: 2 }; body.progress.localRevision = 2;
    const first = await progressPut(session.id, body); expect(first.statusCode).toBe(200);
    expect((await progressPut(session.id, body)).json()).toEqual(first.json());
    expect((await progressPut(session.id, { ...body, mutationId: randomUUID() })).statusCode).toBe(409);
    expect((await progressPut(session.id, { ...body, progress: { ...body.progress, localRevision: 3 } })).statusCode).toBe(409);
    const restored = (await app.inject(`/api/v1/sessions/${session.id}`)).json(); expect(restored.progress).toEqual(body.progress); expect(restored.progressServerRevision).toBe(1);
  });
  it('rejects foreign activity state and bounds violations; never exposes another school session', async () => {
    const session = await lessonSession(); const body = progressBody();
    expect((await progressPut(session.id, body, other)).statusCode).toBe(404);
    expect((await other.inject(`/api/v1/sessions/${session.id}`)).statusCode).toBe(404);
    expect((await progressPut(session.id, { ...body, progress: { ...body.progress, currentActivityId: randomUUID() } })).statusCode).toBe(400);
    const reveal = demoVersion.activities[2]!;
    expect((await progressPut(session.id, { ...body, progress: { ...body.progress, states: { ...body.progress.states, [reveal.id]: { kind: 'reveal', revealed: 5 } } } })).statusCode).toBe(400);
    expect((await progressPut(session.id, { ...body, progress: { ...body.progress, lessonVersionId: randomUUID() } })).statusCode).toBe(400);
  });
  it('validates version/activity/scene annotation ownership on save', async () => {
    const session = await lessonSession(); const activity = demoVersion.activities[0]!;
    const body = saveBody(session.id);
    body.document.owner = { sessionId: session.id, classId: DEMO.class, subjectId: DEMO.subject, target: { kind: 'annotation', lessonVersionId: DEMO.version, activityId: activity.id, sceneId: activity.sceneId } };
    expect((await put(body)).statusCode).toBe(200);
    const wrong = { ...body, mutationId: randomUUID(), document: { ...body.document, id: randomUUID(), owner: { ...body.document.owner, target: { kind: 'annotation' as const, lessonVersionId: DEMO.version, activityId: randomUUID(), sceneId: activity.sceneId } } } };
    expect((await put(wrong)).statusCode).toBe(400);
  });
});
