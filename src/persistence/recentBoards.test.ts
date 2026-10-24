import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createDrawingSession } from '../drawing/session';
import { serializeSession } from './serialization';
import { newRecord, SessionRepository } from './database';
import { PersistenceController } from './controller';

function snapshot(classId: string | null = null) {
  const id = crypto.randomUUID();
  const identity = { id, context: { classId, subjectId: null, classLabel: classId ? 'Class 1' : '', subjectLabel: '' } };
  return serializeSession(createDrawingSession({ sessionId: id, classId, subjectId: null }, {
    whiteboard: crypto.randomUUID(), annotation: crypto.randomUUID(),
  }), identity, null);
}
describe('recent standalone boards', () => {
  it('lists bounded metadata for quick boards and excludes classroom sessions without rewriting records', async () => {
    const repo = new SessionRepository(crypto.randomUUID()); const a = snapshot(); const b = snapshot();
    const first = await repo.save(newRecord(a)); await repo.save(newRecord(snapshot('class-1'))); await repo.save(newRecord(b));
    const result = await repo.recentBoards();
    expect(result.boards.map(board => board.id).sort()).toEqual([a.identity.id, b.identity.id].sort());
    expect(result.unavailable).toBe(0); expect(await repo.load(a.identity.id)).toEqual(first);
    expect((await repo.recentBoards(1)).boards).toHaveLength(1);
    expect(Object.keys(result.boards[0]!)).toEqual(['id', 'savedAt', 'inkCount']);
  });
  it('leaves malformed records untouched and reports their count', async () => {
    const name = crypto.randomUUID(); const repo = new SessionRepository(name); await repo.save(newRecord(snapshot()));
    const db = await new Promise<IDBDatabase>(resolve => { const req = indexedDB.open(name, 3); req.onsuccess = () => resolve(req.result); });
    await new Promise<void>(resolve => { const tx = db.transaction('sessions', 'readwrite'); tx.objectStore('sessions').put({ schemaVersion: 99 }, 'unsupported'); tx.oncomplete = () => resolve(); });
    expect(await repo.recentBoards()).toMatchObject({ unavailable: 1 });
    const count = await new Promise<number>(resolve => { const req = db.transaction('sessions').objectStore('sessions').count(); req.onsuccess = () => resolve(req.result); });
    expect(count).toBe(2); db.close();
  });
  it('does not allow navigation until local writes complete; API availability is irrelevant', async () => {
    const repo = new SessionRepository(crypto.randomUUID()); const state = snapshot();
    const controller = new PersistenceController(state, () => {}, repo);
    expect(controller.canLeave).toBe(false); controller.update(state); await controller.flush(); expect(controller.canLeave).toBe(true);
    controller.invalid(); expect(controller.canLeave).toBe(false); controller.stop();
  });
  it('keeps navigation guarded when local storage fails', async () => {
    class Failed extends SessionRepository { override async save(): Promise<never> { throw new Error('Quota'); } }
    const state = snapshot(); const controller = new PersistenceController(state, () => {}, new Failed());
    controller.update(state); await controller.flush(); expect(controller.canLeave).toBe(false); controller.stop();
  });
});
