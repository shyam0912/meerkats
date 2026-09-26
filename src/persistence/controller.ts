import type { SessionSnapshot } from './serialization';
import { newRecord, SessionRepository, type LocalRecord, LocalConflict } from './database';
import { SaveError, type SessionApi } from './api';

/** One controller per session. Device transactions never wait for an HTTP request. */
export class PersistenceController {
  private record: LocalRecord;
  private latest: SessionSnapshot;
  private queue: Promise<void> = Promise.resolve();
  private timer?: ReturnType<typeof setTimeout>;
  private retry?: ReturnType<typeof setTimeout>;
  private running = false;
  private stopped = false;
  private blocked = false;
  private localFailure = false;
  private attempts = 0;
  private hasUpdates = false;
  private invalidDocument = false;
  private notify: (status: string) => void;
  private repository: SessionRepository;
  private remote?: SessionApi;
  private durableSnapshot?: SessionSnapshot;
  private onStorageChecked?: () => void;
  constructor(snapshot: SessionSnapshot, notify: (status: string) => void,
    repository = new SessionRepository(), remote?: SessionApi, restored?: LocalRecord, onStorageChecked?: () => void) {
    this.notify = notify; this.repository = repository; this.remote = remote;
    this.onStorageChecked = onStorageChecked;
    this.latest = snapshot; this.record = restored ?? newRecord(snapshot);
  }
  update(snapshot: SessionSnapshot) {
    this.hasUpdates = true; this.invalidDocument = false;
    this.stopped = false; this.latest = snapshot;
    this.notify('Saving on device');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush().then(() => this.sync()); }, 120);
  }
  invalid() {
    this.invalidDocument = true;
    this.stopped = true; clearTimeout(this.timer); clearTimeout(this.retry);
    this.notify('Needs attention · Document exceeds supported save format');
  }
  private transact(change: (record: LocalRecord) => LocalRecord) {
    const result = this.queue.then(async () => { this.record = await this.repository.save(change(this.record)); });
    this.queue = result.catch(() => {});
    return result;
  }
  async flush() {
    if (!this.hasUpdates || this.invalidDocument) return;
    clearTimeout(this.timer);
    if (this.latest === this.durableSnapshot) return;
    const snapshot = this.latest;
    try {
      await this.transact(record => ({ ...record, snapshot }));
      this.durableSnapshot = snapshot;
      this.localFailure = false;
      if (!this.invalidDocument) this.notify(this.latest !== snapshot ? 'Saving on device' : this.blocked ? 'Saved on this device · Server needs attention' : 'Saved on this device');
    } catch (error) {
      this.localFailure = true;
      this.notify(error instanceof LocalConflict ? 'Needs attention · Session open in another tab' : 'Needs attention · Device save failed');
    } finally {
      this.onStorageChecked?.();
    }
  }
  async sync() {
    if (!this.remote || !this.hasUpdates || !this.durableSnapshot || this.running || this.blocked || this.stopped || this.localFailure) return;
    this.running = true;
    try {
      const savedDocs = [this.record.snapshot.whiteboard, ...Object.values(this.record.snapshot.annotations)];
      if (savedDocs.every(d => !this.record.sync[d.id]?.pending && this.record.sync[d.id]?.acknowledgedLocalRevision === d.localRevision)) {
        this.notify(this.latest === this.durableSnapshot ? 'Ink synced · Context saved on device' : 'Saving on device');
        return;
      }
      this.notify('Saved on this device · Syncing ink');
      await this.remote.create(this.record.snapshot.identity);
      for (;;) {
        if (this.stopped || this.localFailure) break;
        const docs = [this.record.snapshot.whiteboard, ...Object.values(this.record.snapshot.annotations)];
        const doc = docs.find(d => this.record.sync[d.id]?.pending || this.record.sync[d.id]?.acknowledgedLocalRevision !== d.localRevision);
        if (!doc) break;
        let pending = this.record.sync[doc.id]?.pending;
        if (!pending) {
          pending = { mutationId: crypto.randomUUID(), baseServerRevision: this.record.sync[doc.id]?.serverRevision ?? 0, document: doc };
          const exact = pending;
          // Persist the exact retry payload before sending it; newer snapshots must not replace it.
          await this.transact(record => ({ ...record, sync: { ...record.sync, [doc.id]: {
            serverRevision: exact.baseServerRevision, acknowledgedLocalRevision: record.sync[doc.id]?.acknowledgedLocalRevision ?? -1, pending: exact,
          } } }));
        }
        const ack = await this.remote.save(this.record.snapshot.identity.id, pending);
        if (ack.documentId !== pending.document.id || ack.mutationId !== pending.mutationId || ack.serverRevision !== pending.baseServerRevision + 1)
          throw new SaveError(422);
        const acknowledgedLocalRevision = pending.document.localRevision;
        await this.transact(record => ({ ...record, sync: { ...record.sync, [doc.id]: { serverRevision: ack.serverRevision, acknowledgedLocalRevision } } }));
      }
      this.attempts = 0;
      if (!this.localFailure && !this.stopped) this.notify(this.latest === this.durableSnapshot ? 'Ink synced · Context saved on device' : 'Saving on device');
    } catch (error) {
      this.blocked = error instanceof SaveError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429;
      if (error instanceof LocalConflict) { this.localFailure = true; this.notify('Needs attention · Session open in another tab'); }
      else if (!this.localFailure && !this.invalidDocument) this.notify(this.latest !== this.durableSnapshot ? 'Saving on device' : this.blocked ? 'Saved on this device · Server needs attention' : 'Saved on this device · Server unavailable');
      if (!this.blocked && !this.stopped && !this.localFailure) {
        const delay = Math.min(30000, 1000 * 2 ** this.attempts++) + Math.random() * 500;
        clearTimeout(this.retry); this.retry = setTimeout(() => { void this.sync(); }, delay);
      }
    } finally { this.running = false; }
  }
  resume = () => { void this.sync(); };
  stop() {
    this.stopped = true; clearTimeout(this.timer); clearTimeout(this.retry);
    // A mode/session navigation must not discard a coalesced completed gesture.
    if (this.hasUpdates && this.latest !== this.durableSnapshot) void this.flush();
  }
}
