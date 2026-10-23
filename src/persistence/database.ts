import { z } from 'zod';
import { migrateWhiteboard, saveRequestSchema } from '../../contracts';
import { snapshotSchema, type SessionSnapshot } from './serialization';
import { progressSaveSchema } from '../../contracts/lesson';

export const localRecordSchema = z.strictObject({
  snapshot: snapshotSchema, generation: z.number().int().nonnegative(), savedAt: z.string(),
  sync: z.record(z.string(), z.strictObject({ serverRevision: z.number().int().nonnegative(),
    acknowledgedLocalRevision: z.number().int().min(-1), pending: saveRequestSchema.optional() })),
  progressSync: z.strictObject({ serverRevision: z.number().int().nonnegative(), acknowledgedLocalRevision: z.number().int().min(-1),
    pending: progressSaveSchema.optional() }).optional(),
}).superRefine((record, ctx) => {
  const progress = record.snapshot.lesson?.progress;
  const sync = record.progressSync;
  if (sync && (!progress || sync.acknowledgedLocalRevision > progress.localRevision || (sync.pending && (
    sync.pending.progress.lessonVersionId !== progress.lessonVersionId || sync.pending.progress.localRevision > progress.localRevision || sync.pending.baseServerRevision !== sync.serverRevision))))
    ctx.addIssue({ code: 'custom', message: 'Invalid progress retry metadata' });
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
export interface RecentBoard { id: string; savedAt: string; inkCount: number }
export class SessionRepository {
  private name: string;
  constructor(name = 'meerkats-teaching-v1') { this.name = name; }
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      // Old clients explicitly open v1 and now fail with VersionError rather than
      // flattening a v2 board. Existing connections close on versionchange.
      const request = indexedDB.open(this.name, 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('sessions')) request.result.createObjectStore('sessions');
        if (!request.result.objectStoreNames.contains('migrationBackups')) request.result.createObjectStore('migrationBackups');
      };
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
      if (record.snapshot.whiteboard.schemaVersion === 1) {
        const migrated = { ...record, snapshot: { ...record.snapshot, whiteboard: migrateWhiteboard(record.snapshot.whiteboard) } };
        // save() atomically stores the untouched original alongside the migrated
        // snapshot. The original pending payloads and mutation IDs are retained.
        return await this.save(migrated);
      }
      return record;
    } finally { db.close(); }
  }
  /** Read-only discovery. Invalid records are left untouched; retain only bounded summaries. */
  async recentBoards(limit = 20): Promise<{ boards: RecentBoard[]; unavailable: number }> {
    const db = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const boards: RecentBoard[] = []; let unavailable = 0;
        const tx = db.transaction('sessions', 'readonly');
        const request = tx.objectStore('sessions').openCursor();
        request.onsuccess = () => {
          const cursor = request.result; if (!cursor) return;
          const parsed = localRecordSchema.safeParse(cursor.value);
          if (!parsed.success || parsed.data.snapshot.identity.id !== cursor.key || !Number.isFinite(Date.parse(parsed.data.savedAt))) unavailable++;
          else {
            const { snapshot, savedAt } = parsed.data;
            if (!snapshot.lesson && snapshot.identity.context.classId === null && snapshot.identity.context.subjectId === null &&
                !snapshot.identity.context.classLabel && !snapshot.identity.context.subjectLabel) {
              const board = snapshot.whiteboard;
              boards.push({ id: snapshot.identity.id, savedAt, inkCount: board.schemaVersion === 1 ? board.objects.length : board.pages.reduce((n, p) => n + p.objects.length, 0) });
              boards.sort((a, b) => b.savedAt.localeCompare(a.savedAt) || a.id.localeCompare(b.id));
              boards.splice(Math.max(0, limit));
            }
          }
          cursor.continue();
        };
        tx.oncomplete = () => resolve({ boards, unavailable });
        tx.onabort = () => reject(tx.error ?? new Error('Recent boards unavailable'));
      });
    } finally { db.close(); }
  }
  async save(record: LocalRecord): Promise<LocalRecord> {
    const parsed = localRecordSchema.parse(record);
    const next = { ...parsed, generation: parsed.generation + 1, savedAt: new Date().toISOString() };
    const db = await this.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['sessions', 'migrationBackups'], 'readwrite'); const store = tx.objectStore('sessions');
        let conflict = false;
        const read = store.get(parsed.snapshot.identity.id);
        read.onsuccess = () => {
          const prior = read.result as LocalRecord | undefined;
          if (prior && !localRecordSchema.safeParse(prior).success) { conflict = true; tx.abort(); return; }
          if ((prior?.generation ?? 0) !== parsed.generation) { conflict = true; tx.abort(); return; }
          if (prior && prior.snapshot.whiteboard.schemaVersion > next.snapshot.whiteboard.schemaVersion) { conflict = true; tx.abort(); return; }
          if (prior?.snapshot.whiteboard.schemaVersion === 1 && next.snapshot.whiteboard.schemaVersion === 2) {
            const backups = tx.objectStore('migrationBackups'); const backup = backups.get(parsed.snapshot.identity.id);
            backup.onsuccess = () => { try { if (backup.result === undefined) backups.put(prior, parsed.snapshot.identity.id); } catch { tx.abort(); } };
          }
          try { store.put(next, parsed.snapshot.identity.id); } catch { tx.abort(); }
        };
        tx.oncomplete = () => resolve(); tx.onabort = () => reject(conflict ? new LocalConflict() : tx.error ?? new Error('Device save failed'));
      });
      return next;
    } finally { db.close(); }
  }
  async migrationBackup(id: string): Promise<LocalRecord | undefined> {
    const db = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('migrationBackups', 'readonly'); const request = tx.objectStore('migrationBackups').get(id);
        tx.oncomplete = () => {
          try { resolve(request.result === undefined ? undefined : localRecordSchema.parse(request.result)); }
          catch (error) { reject(error); }
        };
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }
}
