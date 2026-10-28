import 'fake-indexeddb/auto';
import { expect, it, vi } from 'vitest';
import { capacityRecord } from '../../tests/helpers/capacity';
import { deserializeSession, serializeSession } from './serialization';
import { SessionRepository } from './database';
import { boardInkReducer } from '../drawing/whiteboard';
import { createShape } from '../drawing/teachingShapes';
import { PersistenceController } from './controller';
import type { SessionApi } from './api';
import { rotateShape, translateShape } from '../drawing/shapeEditing';

it('roundtrips v3 shapes, preserves exact pending v2 requests, and protects against old clients', async () => {
  const original = capacityRecord(4000); const repo = new SessionRepository(crypto.randomUUID());
  const pending = { mutationId: crypto.randomUUID(), baseServerRevision: 2, document: original.snapshot.whiteboard };
  original.sync[pending.document.id] = { serverRevision: 2, acknowledgedLocalRevision: -1, pending };
  const saved = await repo.save(original); const session = deserializeSession(saved.snapshot);
  const shape = createShape(crypto.randomUUID(), { shape: 'circle', color: '#000000', width: 4 }, { x: 100, y: 100 }, { x: 300, y: 300 })!;
  session.whiteboard = boardInkReducer(session.whiteboard, session.whiteboard.document.activePageId, { type: 'commit-shape', shape });
  const upgraded = await repo.save({ ...saved, snapshot: serializeSession(session, saved.snapshot.identity, saved.snapshot.selection) });
  expect(upgraded.sync[pending.document.id]!.pending).toEqual(pending);
  expect(upgraded.snapshot.annotations).toEqual(original.snapshot.annotations);
  const recovered = (await repo.load(original.snapshot.identity.id))!;
  expect(deserializeSession(recovered.snapshot).whiteboard.document.pages[0]!.shapes).toEqual([shape]);
  await expect(repo.save({ ...saved, generation: upgraded.generation })).rejects.toThrow('another tab');
  const api: SessionApi = { create: vi.fn(async x => x), get: vi.fn(), save: vi.fn(async (_id, body) => ({ documentId: body.document.id,
    mutationId: body.mutationId, serverRevision: body.baseServerRevision + 1, contentHash: 'a'.repeat(64), durable: true as const })) };
  const controller = new PersistenceController(upgraded.snapshot, () => {}, repo, api, recovered);
  controller.update(upgraded.snapshot); await controller.flush(); await controller.sync(); controller.stop();
  const saves = vi.mocked(api.save).mock.calls.map(c => c[1]).filter(s => s.document.id === pending.document.id);
  expect(saves).toHaveLength(2); expect(saves[0]).toEqual(pending);
  expect(saves[1]!.document.schemaVersion).toBe(3); expect(saves[1]!.mutationId).not.toBe(pending.mutationId); expect(saves[1]!.baseServerRevision).toBe(3);
});

it('blocks old IndexedDB v2 clients and leaves unsupported snapshots untouched', async () => {
  const name = crypto.randomUUID(); const repo = new SessionRepository(name); const record = await repo.save(capacityRecord(4000));
  const error = await new Promise<string>(resolve => { const request = indexedDB.open(name, 2); request.onerror = () => resolve(request.error!.name); });
  expect(error).toBe('VersionError');
  await expect(repo.save({ ...record, snapshot: { ...record.snapshot, whiteboard: { ...record.snapshot.whiteboard, schemaVersion: 99 } } } as never)).rejects.toThrow();
  expect(await repo.load(record.snapshot.identity.id)).toEqual(record);
});

it('recovers transformed v3 geometry and preserves the exact pending pre-edit request', async () => {
  const original = capacityRecord(4000); const repo = new SessionRepository(crypto.randomUUID());
  const session = deserializeSession(original.snapshot); const page = session.whiteboard.document.activePageId;
  const shape = createShape(crypto.randomUUID(), { shape: 'rectangle', color: '#225eaf', width: 8 }, { x: 200, y: 200 }, { x: 400, y: 400 })!;
  session.whiteboard = boardInkReducer(session.whiteboard, page, { type: 'commit-shape', shape });
  const before = serializeSession(session, original.snapshot.identity, null);
  const pending = { mutationId: crypto.randomUUID(), baseServerRevision: 2, document: before.whiteboard };
  const saved = await repo.save({ ...original, snapshot: before, sync: { [before.whiteboard.id]: { serverRevision: 2, acknowledgedLocalRevision: -1, pending } } });
  const transformed = rotateShape(translateShape(shape, { x: 150, y: 0 })!, .4)!;
  session.whiteboard = boardInkReducer(session.whiteboard, page, { type: 'edit-shape', shape: transformed });
  const snapshot = serializeSession(session, before.identity, null);
  await repo.save({ ...saved, snapshot }); const recovered = (await repo.load(before.identity.id))!;
  expect(deserializeSession(recovered.snapshot).whiteboard.document.pages[0]!.shapes).toEqual([transformed]);
  expect(recovered.snapshot.annotations).toEqual(before.annotations);
  expect(recovered.sync[before.whiteboard.id]!.pending).toEqual(pending);
  const api: SessionApi = { create: vi.fn(async x => x), get: vi.fn(), save: vi.fn(async (_id, body) => ({ documentId: body.document.id,
    mutationId: body.mutationId, serverRevision: body.baseServerRevision + 1, contentHash: 'a'.repeat(64), durable: true as const })) };
  const controller = new PersistenceController(snapshot, () => {}, repo, api, recovered);
  controller.update(snapshot); await controller.flush(); await controller.sync(); controller.stop();
  const saves = vi.mocked(api.save).mock.calls.map(c => c[1]).filter(s => s.document.id === before.whiteboard.id);
  expect(saves).toHaveLength(2); expect(saves[0]).toEqual(pending); expect(saves[1]!.document).toEqual(snapshot.whiteboard);
  expect(saves[1]!.mutationId).not.toBe(pending.mutationId); expect(saves[1]!.baseServerRevision).toBe(3);
});

it('persists a complete Clear without rewriting a pending pre-clear mutation', async () => {
  const original = capacityRecord(4000); const repo = new SessionRepository(crypto.randomUUID());
  const session = deserializeSession(original.snapshot);
  const page = session.whiteboard.document.activePageId;
  const shape = createShape(crypto.randomUUID(), { shape: 'triangle', color: '#b63737', width: 8 }, { x: 100, y: 100 }, { x: 300, y: 300 })!;
  session.whiteboard = boardInkReducer(session.whiteboard, page, { type: 'commit-shape', shape });
  const before = serializeSession(session, original.snapshot.identity, original.snapshot.selection);
  const pending = { mutationId: crypto.randomUUID(), baseServerRevision: 2, document: before.whiteboard };
  const saved = await repo.save({ ...original, snapshot: before, sync: { [pending.document.id]: { serverRevision: 2, acknowledgedLocalRevision: -1, pending } } });
  session.whiteboard = boardInkReducer(session.whiteboard, page, { type: 'clear' });
  const cleared = serializeSession(session, before.identity, before.selection);
  await repo.save({ ...saved, snapshot: cleared });
  const recovered = (await repo.load(before.identity.id))!;
  expect(recovered.snapshot).toEqual(cleared);
  expect(recovered.sync[pending.document.id]!.pending).toEqual(pending);
  expect(deserializeSession(recovered.snapshot).whiteboard.document.pages[0]).toMatchObject({ id: page, objects: [], shapes: [] });
  const api: SessionApi = { create: vi.fn(async x => x), get: vi.fn(), save: vi.fn(async (_id, body) => ({ documentId: body.document.id,
    mutationId: body.mutationId, serverRevision: body.baseServerRevision + 1, contentHash: 'a'.repeat(64), durable: true as const })) };
  const controller = new PersistenceController(cleared, () => {}, repo, api, recovered);
  controller.update(cleared); await controller.flush(); await controller.sync(); controller.stop();
  const saves = vi.mocked(api.save).mock.calls.map(c => c[1]).filter(s => s.document.id === pending.document.id);
  expect(saves).toHaveLength(2); expect(saves[0]).toEqual(pending);
  expect(saves[1]!.document).toEqual(cleared.whiteboard);
  expect(saves[1]!.mutationId).not.toBe(pending.mutationId);
  expect(saves[1]!.baseServerRevision).toBe(3);
});
