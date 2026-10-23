import 'fake-indexeddb/auto';
import { expect, it, vi } from 'vitest';
import { capacityRecord } from '../../tests/helpers/capacity';
import { MAX_SNAPSHOT_BYTES } from '../../contracts';
import { deserializeSession, serializeSession } from './serialization';
import { SessionRepository } from './database';
import { boardInkReducer, boardPayload } from '../drawing/whiteboard';
import { PersistenceController } from './controller';
import type { SessionApi } from './api';

it('does not label newer pending work durable when syncing an older snapshot', async () => {
  const { snapshot } = capacityRecord(4000);
  const repo = new SessionRepository(crypto.randomUUID());
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const api: SessionApi = { get: vi.fn(), create: vi.fn(async identity => { await waiting; return identity; }),
    save: vi.fn(async (_id, request) => ({ documentId: request.document.id, mutationId: request.mutationId,
      serverRevision: request.baseServerRevision + 1, contentHash: 'a'.repeat(64), durable: true as const })) };
  const notify = vi.fn(); const controller = new PersistenceController(snapshot, notify, repo, api);
  controller.update(snapshot); await controller.flush();
  controller.update({ ...snapshot, selection: 'square' });
  const syncing = controller.sync();
  expect(notify).toHaveBeenLastCalledWith('Saving on device');
  expect(controller.hasUnsavedChanges).toBe(true);
  release(); await syncing; await controller.flush(); controller.stop();
});

it('accepts exactly 2 MiB, rejects overflow without changing history or the durable outbox', async () => {
  const record = capacityRecord();
  const repo = new SessionRepository(crypto.randomUUID());
  const pending = { mutationId: crypto.randomUUID(), baseServerRevision: 0, document: record.snapshot.whiteboard };
  record.sync[pending.document.id] = { serverRevision: 0, acknowledgedLocalRevision: -1, pending };
  const saved = await repo.save(record);
  const board = deserializeSession(saved.snapshot).whiteboard;
  expect(new TextEncoder().encode(JSON.stringify(boardPayload(board.document))).length).toBe(MAX_SNAPSHOT_BYTES);
  const rejected = boardInkReducer(board, board.document.activePageId, { type: 'commit', stroke: {
    id: crypto.randomUUID(), kind: 'ink', tool: 'pen', color: '#000000', width: 3, points: [100, 100],
  } });
  expect(rejected.error).toContain('last action was not applied');
  expect(rejected.document).toBe(board.document);
  expect(rejected.histories).toBe(board.histories);
  expect(await repo.load(record.snapshot.identity.id)).toEqual(saved);
  const invalid = { ...saved, snapshot: { ...saved.snapshot, whiteboard: { ...saved.snapshot.whiteboard, localRevision: 1000000 } } };
  await expect(repo.save(invalid)).rejects.toThrow();
  expect(await repo.load(record.snapshot.identity.id)).toEqual(saved);
}, 30000);

it.each([1, 2])('keeps navigation unsafe until the queued v%s snapshot transaction completes', async version => {
  const record = capacityRecord(4000);
  const session = deserializeSession(record.snapshot);
  const snapshot = serializeSession(session, record.snapshot.identity, null);
  if (version === 1) snapshot.whiteboard = { schemaVersion: 1, id: snapshot.whiteboard.id, owner: snapshot.whiteboard.owner,
    localRevision: 0, bounds: snapshot.whiteboard.bounds, objects: [] };
  const repo = new SessionRepository(crypto.randomUUID());
  const notify = vi.fn(); const controller = new PersistenceController(snapshot, notify, repo);
  controller.update(snapshot);
  expect(controller.canLeave).toBe(false);
  expect(notify).toHaveBeenLastCalledWith('Saving on device');
  await controller.flush();
  expect(controller.canLeave).toBe(true);
  controller.update({ ...snapshot, selection: 'circle' });
  expect(controller.canLeave).toBe(false);
  await controller.flush();
  expect(controller.canLeave).toBe(true);
  controller.stop();
});
