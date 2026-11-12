import 'fake-indexeddb/auto';
import { expect, it, vi } from 'vitest';
import { capacityRecord } from '../../tests/helpers/capacity';
import { deserializeSession, serializeSession } from './serialization';
import { SessionRepository } from './database';
import { boardInkReducer } from '../drawing/whiteboard';
import { duplicateObjects } from '../drawing/objectSelection';
import { PersistenceController } from './controller';
import type { SessionApi } from './api';

it('batch duplication preserves v4, exact pending retries, ownership and Unicode through local/server acknowledgement', async () => {
  const repo = new SessionRepository(crypto.randomUUID());
  const original = capacityRecord(4000); const session = deserializeSession(original.snapshot);
  const page = session.whiteboard.document.activePageId;
  session.whiteboard = boardInkReducer(session.whiteboard, page, { type: 'commit-shape', shape: {
    id: crypto.randomUUID(), kind: 'shape', shape: 'rectangle', color: '#214f45', width: 4,
    origin: { x: 200, y: 200 }, size: { width: 100, height: 100 }, rotation: 25,
  } });
  session.whiteboard = boardInkReducer(session.whiteboard, page, { type: 'commit-text', text: {
    id: crypto.randomUUID(), kind: 'text', text: 'Hello മലയാളം\nക്ഷേത്രം', font: 'noto-sans-malayalam', fontSize: 32,
    color: '#214f45', origin: { x: 500, y: 200 }, size: { width: 300, height: 116 },
  } });
  const before = serializeSession(session, original.snapshot.identity, null);
  const pending = { mutationId: crypto.randomUUID(), baseServerRevision: 2, document: before.whiteboard };
  const saved = await repo.save({ ...original, snapshot: before, sync: { [pending.document.id]: { serverRevision: 2, acknowledgedLocalRevision: -1, pending } } });
  const contents = session.whiteboard.document.pages[0]!;
  const objects = [...contents.shapes!, ...contents.texts!];
  session.whiteboard = boardInkReducer(session.whiteboard, page, { type: 'batch', kind: 'duplicate', ids: objects.map(o => o.id), objects: duplicateObjects(objects) });
  const snapshot = serializeSession(session, before.identity, null);
  expect(snapshot.whiteboard.schemaVersion).toBe(4); expect(snapshot.annotations).toEqual(before.annotations);
  const statuses: string[] = [];
  const api: SessionApi = { create: vi.fn(async x => x), get: vi.fn(), save: vi.fn(async (_id, body) => ({ documentId: body.document.id,
    mutationId: body.mutationId, serverRevision: body.baseServerRevision + 1, contentHash: 'a'.repeat(64), durable: true as const })) };
  const controller = new PersistenceController(before, s => statuses.push(s), repo, api, saved);
  controller.update(snapshot); expect(statuses.at(-1)).toBe('Saving on device');
  await controller.flush(); expect(statuses.at(-1)).toBe('Saved on this device');
  const durable = (await repo.load(before.identity.id))!;
  expect(durable.snapshot).toEqual(snapshot); expect(durable.sync[pending.document.id]!.pending).toEqual(pending);
  expect(deserializeSession(durable.snapshot).whiteboard.histories).toEqual({});
  await controller.sync(); controller.stop();
  const requests = vi.mocked(api.save).mock.calls.map(c => c[1]).filter(r => r.document.id === pending.document.id);
  expect(requests).toHaveLength(2); expect(requests[0]).toEqual(pending);
  expect(requests[1]!.mutationId).not.toBe(pending.mutationId); expect(requests[1]!.baseServerRevision).toBe(3);
  expect(requests[1]!.document).toEqual(snapshot.whiteboard);
});
