import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { arrangeCounters, countingStateSchema, initialCountingState, placeCounter, validCountingState } from '../../contracts/counting';
import { COUNTING, countingVersion } from '../../contracts/counting-content';
import { initialProgress, lessonVersionSchema, validProgress } from '../../contracts/lesson';
import { createLessonSession } from '../drawing/session';
import { deserializeSession, serializeSession } from '../persistence/serialization';
import { newRecord, SessionRepository } from '../persistence/database';
import { PersistenceController } from '../persistence/controller';
import type { SessionApi } from '../persistence/api';

const activity = countingVersion.activities[0]!;
if (activity.kind !== 'counting-board') throw new Error('Counting fixture');
const config = activity.config;
describe('counting invariants and bounded contracts', () => {
  it('creates every quantity with stable distinct IDs and bounded geometry', () => {
    for (let quantity = 1; quantity <= 10; quantity++) {
      const state = { ...initialCountingState(config), quantity, counters: arrangeCounters(config, quantity) };
      expect(validCountingState(config, state)).toBe(true);
      expect(state.counters.map(c => c.id)).toEqual(config.counterIds.slice(0, quantity));
    }
  });
  it('rejects missing, duplicate, foreign counters, invalid quantity and nonfinite/outside points', () => {
    const state = initialCountingState(config);
    for (const candidate of [ { ...state, quantity: 0 }, { ...state, quantity: 11 }, { ...state, counters: state.counters.slice(1) },
      { ...state, counters: state.counters.map(() => state.counters[0]) }, { ...state, extra: true },
      ...[NaN, Infinity, -1, 1200].map(x => ({ ...state, counters: state.counters.map(c => ({ ...c, x })) })) ])
      expect(countingStateSchema.safeParse(candidate).success).toBe(false);
    expect(validCountingState(config, { ...state, counters: state.counters.map(c => ({ ...c, id: crypto.randomUUID() })) })).toBe(false);
  });
  it('allows lines, circles and scatter without changing IDs or quantity', () => {
    for (const pattern of ['line', 'circle', 'scatter']) {
      const state = initialCountingState(config);
      const counters = state.counters.map((c, i) => ({ ...c,
        x: pattern === 'circle' ? 600 + Math.cos(i * Math.PI * 2 / 5) * 190 : 160 + i * 210,
        y: pattern === 'circle' ? 360 + Math.sin(i * Math.PI * 2 / 5) * 190 : pattern === 'scatter' ? 200 + (i % 3) * 150 : 350 }));
      expect(validCountingState(config, { ...state, counters })).toBe(true);
    }
  });
  it('moves only one counter, permits slight overlap, clamps boundaries and rejects obstruction', () => {
    const state = initialCountingState(config), first = state.counters[0]!;
    const moved = placeCounter(state, first.id, -100, 900);
    expect(moved.counters[0]).toEqual({ ...first, x: 72, y: 603 });
    expect(moved.counters.slice(1)).toEqual(state.counters.slice(1));
    const second = state.counters[1]!;
    expect(placeCounter(state, first.id, second.x, second.y)).toBe(state);
    expect(placeCounter(state, first.id, second.x - 105, second.y)).not.toBe(state);
    expect(placeCounter(state, first.id, NaN, 300)).toBe(state);
  });
  it('bounds optional teacher-paced counting and validates pinned progress', () => {
    const progress = initialProgress(countingVersion), state = initialCountingState(config);
    expect(validProgress(countingVersion, progress)).toBe(true);
    expect(countingStateSchema.safeParse({ ...state, counted: 1 }).success).toBe(false);
    expect(countingStateSchema.safeParse({ ...state, countingHelp: true, counted: 6 }).success).toBe(false);
    expect(validProgress(countingVersion, { ...progress, states: { [activity.id]: { ...state, countingHelp: true, counted: 5 } } })).toBe(true);
    expect(lessonVersionSchema.safeParse({ ...countingVersion, activities: [{ ...activity, config: { ...config, counterIds: Array(10).fill(config.counterIds[0]) } }] }).success).toBe(false);
  });
});
describe('counting local recovery and exact pending retries', () => {
  it('recovers multilingual activity state without modifying ink documents or pending mutation IDs', async () => {
    const identity = { id: crypto.randomUUID(), lessonVersionId: COUNTING.version,
      context: { classId: COUNTING.class, subjectId: COUNTING.subject, classLabel: 'Standard 1', subjectLabel: 'Mathematics' } };
    const session = createLessonSession({ sessionId: identity.id, classId: COUNTING.class, subjectId: COUNTING.subject }, countingVersion);
    session.lesson!.progress.states[COUNTING.activity] = { ...initialCountingState(config), language: 'ml', countingHelp: true, counted: 3 };
    const snapshot = serializeSession(session, identity, null); const repo = new SessionRepository(crypto.randomUUID());
    const saved = await repo.save(newRecord(snapshot));
    expect(deserializeSession(saved.snapshot).lesson).toEqual(session.lesson);
    const remote: SessionApi = { create: vi.fn(async value => value), get: vi.fn(),
      save: vi.fn(async (_id, input) => ({ documentId: input.document.id, mutationId: input.mutationId, serverRevision: input.baseServerRevision + 1, contentHash: 'a'.repeat(64), durable: true as const })),
      saveProgress: vi.fn(async (_id, input) => ({ mutationId: input.mutationId, serverRevision: input.baseServerRevision + 1, durable: true as const })) };
    vi.mocked(remote.saveProgress!).mockRejectedValueOnce(new Error('Lost acknowledgement'));
    const first = new PersistenceController(snapshot, () => {}, repo, remote, saved);
    first.update(snapshot); await first.flush(); await first.sync(); first.stop();
    const pending = (await repo.load(identity.id))!; const exact = structuredClone(pending.progressSync!.pending!);
    expect(exact.progress.states[COUNTING.activity]).toEqual(session.lesson!.progress.states[COUNTING.activity]);
    const next = new PersistenceController(snapshot, () => {}, repo, remote, pending);
    next.update(snapshot); await next.flush(); await next.sync(); next.stop();
    expect(vi.mocked(remote.saveProgress!).mock.calls[1]![1]).toEqual(exact);
    expect((await repo.load(identity.id))!.snapshot.whiteboard).toEqual(snapshot.whiteboard);
    expect((await repo.load(identity.id))!.snapshot.annotations).toEqual(snapshot.annotations);
  });
});
