import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { createDrawingSession, sessionReducer } from '../drawing/session';
import { ToolManager } from '../drawing/ToolManager';
import { deserializeDocument, deserializeSession, serializeSession, snapshotSchema } from './serialization';
import { newRecord, SessionRepository } from './database';
import { PersistenceController } from './controller';
import { SaveError, type SessionApi } from './api';

function fixture() {
  const identity = { id: crypto.randomUUID(), context: { classId: 'prototype:class:1', subjectId: 'prototype:subject:science', classLabel: 'STD 1', subjectLabel: 'Science' } };
  const session = createDrawingSession({ sessionId: identity.id, classId: identity.context.classId, subjectId: identity.context.subjectId }, {
    whiteboard: crypto.randomUUID(), annotation: crypto.randomUUID(),
  });
  const stroke = { id: crypto.randomUUID(), kind: 'ink' as const, tool: 'pen' as const, color: '#aa0000', width: 9, points: [5, 10, 20, 30] };
  const drawn = sessionReducer(session, { type: 'document', documentId: session.whiteboard.document.id, action: { type: 'commit', stroke } });
  return { identity, session: drawn, snapshot: serializeSession(drawn, identity, 'circle'), stroke };
}
const repository = () => new SessionRepository(`test-${crypto.randomUUID()}`);
describe('versioned serialization and device durability', () => {
  it('round trips committed ink, UUIDs, bounds, anchors and mode independently of runtime state', () => {
    const { snapshot, session, stroke } = fixture();
    const restored = deserializeSession(JSON.parse(JSON.stringify(snapshot)));
    expect(restored.whiteboard.document).toEqual(session.whiteboard.document);
    expect(restored.whiteboard.document.objects).toEqual([stroke]);
    expect(restored.whiteboard.past).toEqual([]);
    expect(Object.keys(snapshot.whiteboard)).not.toContain('revision');
    expect(snapshot.whiteboard.localRevision).toBe(1);
  });
  it('rejects unsupported versions, malformed coordinates and wrong ownership without partial hydration', () => {
    const { snapshot } = fixture();
    expect(() => deserializeDocument({ ...snapshot.whiteboard, schemaVersion: 2 })).toThrow();
    expect(() => deserializeDocument({ ...snapshot.whiteboard, objects: [{ ...snapshot.whiteboard.objects[0], points: [1] }] })).toThrow();
    expect(() => snapshotSchema.parse({ ...snapshot, identity: { ...snapshot.identity, id: crypto.randomUUID() } })).toThrow();
    expect(() => deserializeDocument({ ...snapshot.whiteboard, pointerId: 1 })).toThrow();
  });
  it('stores and restores separate whiteboard and annotation snapshots with current context', async () => {
    const { snapshot } = fixture(); const repo = repository();
    await repo.save(newRecord(snapshot));
    const restored = await repo.load(snapshot.identity.id);
    expect(restored?.snapshot).toEqual(snapshot);
    expect(restored?.savedAt).not.toBe('');
    expect(restored?.snapshot.annotations['neutral-shapes-v1']?.objects).toEqual([]);
  });
  it('isolates sessions and refuses stale local overwrites from another tab', async () => {
    const a = fixture().snapshot; const b = fixture().snapshot; const repo = repository();
    await repo.save(newRecord(a)); await repo.save(newRecord(b));
    expect((await repo.load(a.identity.id))?.snapshot.identity.id).toBe(a.identity.id);
    await expect(repo.save(newRecord(a))).rejects.toThrow('another tab');
    expect((await repo.load(b.identity.id))?.snapshot).toEqual(b);
  });
  it('does not persist active or cancelled gestures', async () => {
    const { session, identity } = fixture(); const manager = new ToolManager();
    manager.begin(1, { tool: 'pen', color: '#000000', width: 3 }, { x: 10, y: 10 }, crypto.randomUUID());
    manager.move(1, { x: 100, y: 100 });
    const during = serializeSession(session, identity, null);
    manager.cancel();
    expect(serializeSession(session, identity, null)).toEqual(during);
    const repo = repository(); await repo.save(newRecord(during));
    expect((await repo.load(identity.id))?.snapshot.whiteboard.objects).toHaveLength(1);
  });
  it('coalesces settled actions before saving', async () => {
    const { snapshot } = fixture(); const repo = repository(); const spy = vi.spyOn(repo, 'save');
    const controller = new PersistenceController(snapshot, () => {}, repo);
    for (let i = 0; i < 15; i++) controller.update({ ...snapshot, mode: i % 2 ? 'annotate' : 'whiteboard' });
    await controller.flush(); controller.stop();
    expect(spy).toHaveBeenCalledTimes(1);
    expect((await repo.load(snapshot.identity.id))?.snapshot.mode).toBe('whiteboard');
  });
  it('never claims local durability when IndexedDB fails', async () => {
    const { snapshot } = fixture(); const repo = repository();
    vi.spyOn(repo, 'save').mockRejectedValue(new Error('QuotaExceededError'));
    const notify = vi.fn(); const controller = new PersistenceController(snapshot, notify, repo);
    controller.update(snapshot); await controller.flush(); controller.stop();
    expect(notify).toHaveBeenLastCalledWith('Needs attention · Device save failed');
    expect(notify.mock.calls.flat()).not.toContain('Saved on this device');
  });
  it('does not create unused navigation sessions or overwrite an unsupported document with an older snapshot', async () => {
    const { snapshot } = fixture(); const repo = repository(); const notify = vi.fn();
    const controller = new PersistenceController(snapshot, notify, repo);
    controller.stop(); await controller.flush();
    expect(await repo.load(snapshot.identity.id)).toBeUndefined();
    controller.update(snapshot); await controller.flush();
    controller.invalid(); await controller.flush(); controller.stop();
    expect(notify).toHaveBeenLastCalledWith('Needs attention · Document exceeds supported save format');
    expect((await repo.load(snapshot.identity.id))?.generation).toBe(1);
  });
});
function remote(): SessionApi {
  return { create: vi.fn(async identity => identity), get: vi.fn(), save: vi.fn(async (_id, input) => ({
    documentId: input.document.id, mutationId: input.mutationId, serverRevision: input.baseServerRevision + 1, contentHash: 'a'.repeat(64), durable: true as const,
  })) };
}
describe('durable outbox and truthful save acknowledgement', () => {
  it('saves exact retry payload before sending and acknowledges both documents separately', async () => {
    const { snapshot } = fixture(); const repo = repository(); const api = remote(); const notify = vi.fn();
    const originalSave = api.save;
    api.save = vi.fn(async (id, input) => {
      expect((await repo.load(id))?.sync[input.document.id]?.pending).toEqual(input);
      return originalSave(id, input);
    });
    const controller = new PersistenceController(snapshot, notify, repo, api);
    controller.update(snapshot); await controller.flush(); await controller.sync(); controller.stop();
    expect(api.save).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenLastCalledWith('Ink synced · Context saved on device');
    expect((await repo.load(snapshot.identity.id))?.sync[snapshot.whiteboard.id]).toEqual({ serverRevision: 1, acknowledgedLocalRevision: 1 });
  });
  it('retains an identical pending mutation after a lost acknowledgement and reload', async () => {
    const { snapshot } = fixture(); const repo = repository(); const api = remote();
    vi.mocked(api.save).mockRejectedValueOnce(new TypeError('Network lost'));
    const controller = new PersistenceController(snapshot, () => {}, repo, api);
    controller.update(snapshot); await controller.flush(); await controller.sync(); controller.stop();
    const stored = await repo.load(snapshot.identity.id); const request = stored?.sync[snapshot.whiteboard.id]?.pending;
    expect(request).toBeDefined();
    const restored = new PersistenceController(snapshot, () => {}, repo, api, stored);
    restored.update(snapshot); await restored.flush(); await restored.sync(); restored.stop();
    expect(vi.mocked(api.save).mock.calls[1]?.[1]).toEqual(request);
  });
  it('keeps local ink when API is unavailable and never says synced', async () => {
    const { snapshot } = fixture(); const repo = repository(); const api = remote(); const notify = vi.fn();
    vi.mocked(api.create).mockRejectedValue(new TypeError('Offline'));
    const controller = new PersistenceController(snapshot, notify, repo, api);
    controller.update(snapshot); await controller.flush(); await controller.sync(); controller.stop();
    expect((await repo.load(snapshot.identity.id))?.snapshot).toEqual(snapshot);
    expect(notify).toHaveBeenLastCalledWith('Saved on this device · Server unavailable');
    expect(notify.mock.calls.flat().some(status => String(status).startsWith('Ink synced'))).toBe(false);
  });
  it('pauses on a stale revision conflict without overwriting or discarding local work', async () => {
    const { snapshot } = fixture(); const repo = repository(); const api = remote(); const notify = vi.fn();
    vi.mocked(api.save).mockRejectedValue(new SaveError(409));
    const controller = new PersistenceController(snapshot, notify, repo, api);
    controller.update(snapshot); await controller.flush(); await controller.sync(); await controller.sync(); controller.stop();
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenLastCalledWith('Saved on this device · Server needs attention');
    expect((await repo.load(snapshot.identity.id))?.snapshot.whiteboard.objects).toHaveLength(1);
  });
  it('persists a newer completed action while an earlier network acknowledgement is delayed', async () => {
    const { snapshot } = fixture(); const repo = repository(); const api = remote();
    let release: (() => void) | undefined;
    let started: (() => void) | undefined;
    const start = new Promise<void>(resolve => { started = resolve; });
    const response = new Promise<void>(resolve => { release = resolve; });
    const normalSave = api.save;
    api.save = vi.fn(async (id, input) => {
      if (input.document.id === snapshot.whiteboard.id && input.baseServerRevision === 0) { started?.(); await response; }
      return normalSave(id, input);
    });
    const controller = new PersistenceController(snapshot, () => {}, repo, api);
    controller.update(snapshot); await controller.flush(); const syncing = controller.sync(); await start;
    const newer = { ...snapshot, whiteboard: { ...snapshot.whiteboard, localRevision: 2, objects: [] } };
    controller.update(newer); await controller.flush();
    expect((await repo.load(snapshot.identity.id))?.snapshot.whiteboard.localRevision).toBe(2);
    expect((await repo.load(snapshot.identity.id))?.sync[snapshot.whiteboard.id]?.pending?.document.localRevision).toBe(1);
    release?.(); await syncing; controller.stop();
    expect((await repo.load(snapshot.identity.id))?.sync[snapshot.whiteboard.id]).toEqual({ serverRevision: 2, acknowledgedLocalRevision: 2 });
  });
});
