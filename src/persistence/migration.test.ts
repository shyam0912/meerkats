import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { MAX_SNAPSHOT_BYTES, documentV1Schema, migrateWhiteboard, type SerializedV1 } from '../../contracts';
import { SessionRepository, newRecord, type LocalRecord } from './database';
import { PersistenceController } from './controller';
import { SaveError, type SessionApi } from './api';
import { deserializeSession, snapshotSchema } from './serialization';

function legacy() {
  const sessionId = crypto.randomUUID(); const doc: SerializedV1 = { schemaVersion: 1, id: crypto.randomUUID(),
    owner: { sessionId, classId: null, subjectId: null, target: { kind: 'whiteboard' } }, localRevision: 8, bounds: { width: 1200, height: 675 },
    objects: [{ id: crypto.randomUUID(), kind: 'ink', tool: 'pen', color: '#000000', width: 3, points: [20, 20] }] };
  return newRecord(snapshotSchema.parse({ schemaVersion: 1, identity: { id: sessionId, context: { classId: null, subjectId: null, classLabel: '', subjectLabel: '' } },
    whiteboard: doc, annotations: { 'neutral-shapes-v1': { ...doc, id: crypto.randomUUID(), localRevision: 0, objects: [], owner: { ...doc.owner, target: { kind: 'annotation', sceneId: 'neutral-shapes-v1' } } } }, mode: 'whiteboard', selection: null }));
}
async function seedV1(name: string, record: LocalRecord) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('sessions'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  await new Promise<void>((resolve, reject) => { const tx = db.transaction('sessions', 'readwrite'); tx.objectStore('sessions').put(record, record.snapshot.identity.id); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); });
  db.close();
}
async function raw(name: string, store: string, id: string) {
  const db = await new Promise<IDBDatabase>(resolve => { const req = indexedDB.open(name, 3); req.onsuccess = () => resolve(req.result); });
  try { return await new Promise<unknown>(resolve => { const req = db.transaction(store).objectStore(store).get(id); req.onsuccess = () => resolve(req.result); }); } finally { db.close(); }
}
describe('v1 migration and recovery protection', () => {
  it('leaves a maximum-size v1 board intact if the v2 envelope would exceed capacity', async () => {
    const original = legacy(); const doc = documentV1Schema.parse(original.snapshot.whiteboard);
    let low = 1; let high = 100000;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2); doc.objects[0]!.points = Array(mid * 2).fill(100.123456789);
      if (new TextEncoder().encode(JSON.stringify(doc)).byteLength <= MAX_SNAPSHOT_BYTES) low = mid; else high = mid - 1;
    }
    doc.objects[0]!.points = Array(low * 2).fill(100.123456789); original.snapshot.whiteboard = documentV1Schema.parse(doc);
    expect(() => migrateWhiteboard(doc)).toThrow();
    const name = crypto.randomUUID(); await seedV1(name, original); const repo = new SessionRepository(name);
    await expect(repo.load(original.snapshot.identity.id)).rejects.toThrow();
    expect(await raw(name, 'sessions', original.snapshot.identity.id)).toEqual(original);
  });
  it('retains the migrated local board and exact pending payload when the server reports a conflict', async () => {
    const original = legacy(); const doc = original.snapshot.whiteboard;
    const pending = { mutationId: crypto.randomUUID(), baseServerRevision: 3, document: doc };
    original.sync[doc.id] = { serverRevision: 3, acknowledgedLocalRevision: 7, pending };
    const name = crypto.randomUUID(); await seedV1(name, original); const repo = new SessionRepository(name);
    const migrated = (await repo.load(original.snapshot.identity.id))!; const notify = vi.fn();
    const api: SessionApi = { create: vi.fn(async value => value), get: vi.fn(), save: vi.fn(async () => { throw new SaveError(409); }) };
    const controller = new PersistenceController(migrated.snapshot, notify, repo, api, migrated);
    controller.update(migrated.snapshot); await controller.flush(); await controller.sync(); controller.stop();
    expect(notify).toHaveBeenLastCalledWith('Saved on this device · Server needs attention');
    const stored = (await repo.load(original.snapshot.identity.id))!;
    expect(stored.snapshot.whiteboard.schemaVersion).toBe(2); expect(stored.sync[doc.id]!.pending).toEqual(pending);
    expect(await repo.migrationBackup(original.snapshot.identity.id)).toEqual(original);
  });
  it('atomically retains the original record, IDs, ink, annotations and pending payload', async () => {
    const original = legacy(); const doc = original.snapshot.whiteboard;
    original.sync[doc.id] = { serverRevision: 3, acknowledgedLocalRevision: 7, pending: { mutationId: crypto.randomUUID(), baseServerRevision: 3, document: doc } };
    const name = crypto.randomUUID(); await seedV1(name, original); const repo = new SessionRepository(name);
    const migrated = (await repo.load(original.snapshot.identity.id))!;
    expect(await repo.migrationBackup(original.snapshot.identity.id)).toEqual(original);
    expect(migrated.snapshot.whiteboard).toEqual(migrateWhiteboard(doc)); expect(migrated.sync).toEqual(original.sync);
    expect(migrated.snapshot.annotations).toEqual(original.snapshot.annotations); expect(migrated.generation).toBe(original.generation + 1);
    const again = await repo.load(original.snapshot.identity.id); expect(again).toEqual(migrated);
    expect(deserializeSession(migrated.snapshot).whiteboard.document.pages[0]!.objects).toEqual(doc.schemaVersion === 1 ? doc.objects : []);
  });
  it('blocks an older IndexedDB client and stale/current-generation v1 rewrites', async () => {
    const original = legacy(); const name = crypto.randomUUID(); await seedV1(name, original); const repo = new SessionRepository(name);
    const migrated = (await repo.load(original.snapshot.identity.id))!;
    const error = await new Promise<string>(resolve => { const req = indexedDB.open(name, 1); req.onerror = () => resolve(req.error!.name); });
    expect(error).toBe('VersionError'); await expect(repo.save(original)).rejects.toThrow('another tab');
    await expect(repo.save({ ...original, generation: migrated.generation })).rejects.toThrow('another tab');
    expect(await repo.load(original.snapshot.identity.id)).toEqual(migrated);
  });
  it('rolls back migration if its backup cannot be written', async () => {
    const original = legacy(); const name = crypto.randomUUID(); await seedV1(name, original); const repo = new SessionRepository(name);
    const put = IDBObjectStore.prototype.put;
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (this.name === 'migrationBackups') throw new DOMException('Quota exhausted', 'QuotaExceededError'); return put.apply(this, args);
    });
    try { await expect(repo.load(original.snapshot.identity.id)).rejects.toThrow(); } finally { spy.mockRestore(); }
    expect(await raw(name, 'sessions', original.snapshot.identity.id)).toEqual(original);
    expect(await raw(name, 'migrationBackups', original.snapshot.identity.id)).toBeUndefined();
  });
  it('retries the exact v1 mutation first, then queues v2 with a new mutation and current server revision', async () => {
    const original = legacy(); const doc = original.snapshot.whiteboard;
    const pending = { mutationId: crypto.randomUUID(), baseServerRevision: 3, document: doc };
    original.sync[doc.id] = { serverRevision: 3, acknowledgedLocalRevision: 7, pending };
    const name = crypto.randomUUID(); await seedV1(name, original); const repo = new SessionRepository(name);
    const migrated = (await repo.load(original.snapshot.identity.id))!;
    const api: SessionApi = { create: vi.fn(async value => value), get: vi.fn(), save: vi.fn(async (_id, request) => ({ documentId: request.document.id,
      mutationId: request.mutationId, serverRevision: request.baseServerRevision + 1, contentHash: 'a'.repeat(64), durable: true as const })) };
    const controller = new PersistenceController(migrated.snapshot, () => {}, repo, api, migrated);
    controller.update(migrated.snapshot); await controller.flush(); await controller.sync(); controller.stop();
    const saves = vi.mocked(api.save).mock.calls.filter(call => call[1].document.id === doc.id).map(call => call[1]);
    expect(saves).toHaveLength(2); expect(saves[0]).toEqual(pending); expect(saves[1]!.document.schemaVersion).toBe(2);
    expect(saves[1]!.mutationId).not.toBe(pending.mutationId); expect(saves[1]!.baseServerRevision).toBe(4);
    expect(await repo.migrationBackup(original.snapshot.identity.id)).toEqual(original);
  });
});
