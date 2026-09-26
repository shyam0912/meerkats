import { z } from 'zod';
import { saveRequestSchema } from '../../contracts';
import { snapshotSchema, type SessionSnapshot } from './serialization';

export const localRecordSchema = z.strictObject({
  snapshot: snapshotSchema, generation: z.number().int().nonnegative(), savedAt: z.string(),
  sync: z.record(z.string(), z.strictObject({ serverRevision: z.number().int().nonnegative(),
    acknowledgedLocalRevision: z.number().int().min(-1), pending: saveRequestSchema.optional() })),
}).superRefine((record, ctx) => {
  const documents = [record.snapshot.whiteboard, ...Object.values(record.snapshot.annotations)];
  for (const [id, entry] of Object.entries(record.sync)) {
    const document = documents.find(d => d.id === id);
    if (!document || entry.acknowledgedLocalRevision > document.localRevision || (entry.pending && (
      entry.pending.document.id !== id || entry.pending.baseServerRevision !== entry.serverRevision ||
      entry.pending.document.owner.sessionId !== record.snapshot.identity.id ||
      entry.pending.document.localRevision > document.localRevision)))
      ctx.addIssue({ code: 'custom', message: 'Invalid saved retry metadata' });
  }
});
export type LocalRecord = z.infer<typeof localRecordSchema>;
export const newRecord = (snapshot: SessionSnapshot): LocalRecord => ({ snapshot, generation: 0, savedAt: '', sync: {} });
export class LocalConflict extends Error { constructor() { super('This session changed in another tab. Reload before continuing.'); } }
export class SessionRepository {
  private name: string;
  constructor(name = 'meerkats-teaching-v1') { this.name = name; }
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('sessions'); };
      request.onsuccess = () => { const db = request.result; db.onversionchange = () => db.close(); resolve(db); };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Device storage upgrade blocked by another tab'));
    });
  }
  async load(id: string): Promise<LocalRecord | undefined> {
    const db = await this.open();
    try {
      const value = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction('sessions', 'readonly'); const request = tx.objectStore('sessions').get(id);
        tx.oncomplete = () => resolve(request.result); tx.onabort = () => reject(tx.error);
      });
      if (value === undefined) return undefined;
      const record = localRecordSchema.parse(value);
      if (record.snapshot.identity.id !== id) throw new Error('Stored session identity mismatch');
      return record;
    } finally { db.close(); }
  }
  async save(record: LocalRecord): Promise<LocalRecord> {
    const parsed = localRecordSchema.parse(record);
    const next = { ...parsed, generation: parsed.generation + 1, savedAt: new Date().toISOString() };
    const db = await this.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('sessions', 'readwrite'); const store = tx.objectStore('sessions');
        let conflict = false;
        const read = store.get(parsed.snapshot.identity.id);
        read.onsuccess = () => {
          const prior = read.result as LocalRecord | undefined;
          if ((prior?.generation ?? 0) !== parsed.generation) { conflict = true; tx.abort(); return; }
          store.put(next, parsed.snapshot.identity.id);
        };
        tx.oncomplete = () => resolve(); tx.onabort = () => reject(conflict ? new LocalConflict() : tx.error ?? new Error('Device save failed'));
      });
      return next;
    } finally { db.close(); }
  }
}
