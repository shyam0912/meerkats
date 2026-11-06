import 'fake-indexeddb/auto';
import { expect, it, vi } from 'vitest';
import { capacityRecord } from '../../tests/helpers/capacity';
import { deserializeSession, serializeSession } from './serialization';
import { LocalConflict, SessionRepository } from './database';
import { boardInkReducer, boardSurface } from '../drawing/whiteboard';
import { PersistenceController } from './controller';
import type { SessionApi } from './api';
import type { TeachingText } from '../../contracts';
const text = (): TeachingText => ({ id: crypto.randomUUID(), kind: 'text', text: 'ക്ഷേത്രം\nEnglish മലയാളം', font: 'noto-sans-malayalam', fontSize: 32,
  color: '#214f45', origin: { x: 50, y: 50 }, size: { width: 400, height: 116 } });

it('upgrades only the snapshot to v4, retains exact older pending retries, recovers editable Unicode and rejects downgrade', async () => {
  const original = capacityRecord(4000); const repo = new SessionRepository(crypto.randomUUID());
  const pending = { mutationId: crypto.randomUUID(), baseServerRevision: 2, document: original.snapshot.whiteboard };
  const saved = await repo.save({ ...original, sync: { [pending.document.id]: { serverRevision: 2, acknowledgedLocalRevision: -1, pending } } });
  const session = deserializeSession(saved.snapshot); const page = session.whiteboard.document.activePageId; const value = text();
  session.whiteboard = boardInkReducer(session.whiteboard, page, { type: 'commit-text', text: value });
  const snapshot = serializeSession(session, saved.snapshot.identity, null);
  const upgraded = await repo.save({ ...saved, snapshot }); const recovered = (await repo.load(snapshot.identity.id))!;
  expect(recovered.sync[pending.document.id]!.pending).toEqual(pending); expect(recovered.snapshot.annotations).toEqual(saved.snapshot.annotations);
  expect(deserializeSession(recovered.snapshot).whiteboard.document.pages[0]!.texts).toEqual([value]);
  await expect(repo.save({ ...upgraded, snapshot: saved.snapshot })).rejects.toBeInstanceOf(LocalConflict);
  const api: SessionApi = { create: vi.fn(async x => x), get: vi.fn(), save: vi.fn(async (_id, body) => ({ documentId: body.document.id,
    mutationId: body.mutationId, serverRevision: body.baseServerRevision + 1, contentHash: 'a'.repeat(64), durable: true as const })) };
  const controller = new PersistenceController(snapshot, () => {}, repo, api, recovered);
  controller.update(snapshot); await controller.flush(); await controller.sync(); controller.stop();
  const requests = vi.mocked(api.save).mock.calls.map(c => c[1]).filter(r => r.document.id === pending.document.id);
  expect(requests).toHaveLength(2); expect(requests[0]).toEqual(pending); expect(requests[1]!.document).toEqual(snapshot.whiteboard);
  expect(requests[1]!.mutationId).not.toBe(pending.mutationId);
});

it('counts text toward 2 MiB capacity and preserves the last valid board and history', () => {
  const session = deserializeSession(capacityRecord(2097100).snapshot); const before = session.whiteboard;
  const next = boardInkReducer(before, before.document.activePageId, { type: 'commit-text', text: text() });
  expect(next.error).toContain('2 MiB'); expect(next.document).toBe(before.document); expect(boardSurface(next).past).toEqual([]);
});
