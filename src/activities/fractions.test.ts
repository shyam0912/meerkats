import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { FRACTIONS, fractionsCatalog, fractionsVersion } from '../../contracts/fractions-content';
import { FRACTION_PIECE_UNITS, canPlaceFraction, fractionConfigSchema, fractionLaneUnits, fractionLanes,
  fractionOccupancy, fractionStateSchema, initialFractionState, placeFractionPiece, validFractionState,
  type FractionPlacement, type FractionState } from '../../contracts/fractions';
import { catalogSchema, initialProgress, lessonVersionSchema, validProgress, type LessonProgress } from '../../contracts/lesson';
import { whiteboardV4Schema } from '../../contracts';
import { bundledCatalog, bundledVersions } from '../../contracts/catalog-content';
import { bundledCatalog as publicCatalog } from './public-catalog';
import { createLessonSession, sessionReducer } from '../drawing/session';
import { deserializeSession, serializeSession } from '../persistence/serialization';
import { newRecord, SessionRepository } from '../persistence/database';

const activity = fractionsVersion.activities[0]!;
if (activity.kind !== 'fraction-board') throw new Error('Fraction fixture');
const config = activity.config;
const initial = () => initialFractionState(config);
const identity = () => ({ id: crypto.randomUUID(), lessonVersionId: FRACTIONS.version,
  context: { classId: FRACTIONS.class, subjectId: FRACTIONS.subject, classLabel: 'Standard 3', subjectLabel: 'ഗണിതം' } });
const positions: FractionPlacement[] = fractionLanes.flatMap(lane => [0, 1, 2, 3].map(start => ({ lane, start })));

describe('fraction contracts and exact mathematical invariants', () => {
  it('starts six canonical stable pieces in the tray, with exactly eight quarter-units', () => {
    const state = initial();
    expect(validFractionState(config, state)).toBe(true);
    expect(state.pieces.map(p => p.id)).toEqual(config.pieceIds);
    expect(state.pieces.every(p => p.placement === null)).toBe(true);
    expect(FRACTION_PIECE_UNITS).toEqual([2, 2, 1, 1, 1, 1]);
    expect(FRACTION_PIECE_UNITS.reduce<number>((sum, n) => sum + n, 0)).toBe(8);
    expect(initial()).toEqual(state); expect(initial().pieces).not.toBe(state.pieces);
  });
  it('rejects unsupported models, missing/extra/duplicate/invalid configuration IDs', () => {
    for (const candidate of [{ ...config, model: 'arbitrary' }, { ...config, pieceIds: config.pieceIds.slice(1) },
      { ...config, pieceIds: [...config.pieceIds, crypto.randomUUID()] }, { ...config, pieceIds: Array(6).fill(config.pieceIds[0]) },
      { ...config, pieceIds: Array(6).fill('invalid') }, { ...config, denominator: 3 }]) {
      expect(fractionConfigSchema.safeParse(candidate).success).toBe(false);
      expect(validFractionState(candidate as typeof config, initial())).toBe(false);
    }
  });
  it('rejects missing, duplicate, foreign, reordered and malformed piece records', () => {
    const state = initial();
    for (const pieces of [state.pieces.slice(1), [...state.pieces, state.pieces[0]], Array(6).fill(state.pieces[0]),
      state.pieces.map(p => ({ ...p, id: crypto.randomUUID() })), [...state.pieces].reverse(),
      state.pieces.map(p => ({ ...p, units: 1 })), state.pieces.map(p => ({ ...p, placement: { lane: 'third', start: 0 } }))])
      expect(validFractionState(config, { ...state, pieces })).toBe(false);
    for (const extra of [{ language: 'xx' }, { showLabels: 1 }, { selectedId: state.pieces[0]!.id }])
      expect(fractionStateSchema.safeParse({ ...state, ...extra }).success).toBe(false);
  });
  it('checks every piece/lane/start boundary without rounding fractions or accepting non-finite coordinates', () => {
    const state = initial();
    config.pieceIds.forEach((id, index) => {
      for (const lane of fractionLanes) for (const start of [-1, 0, 1, 2, 3, 4, .5, NaN, Infinity]) {
        const valid = Number.isInteger(start) && start >= 0 && start + FRACTION_PIECE_UNITS[index]! <= 4;
        expect(canPlaceFraction(config, state, id, { lane, start })).toBe(valid);
        const next = placeFractionPiece(config, state, id, { lane, start });
        expect(next === state).toBe(!valid);
        expect(validFractionState(config, next)).toBe(true);
      }
    });
  });
  it('exhaustively rejects interval overlap and never displaces another piece', () => {
    config.pieceIds.forEach((first, i) => positions.forEach(a => {
      const state = placeFractionPiece(config, initial(), first, a);
      if (!state.pieces[i]!.placement) return;
      config.pieceIds.forEach((second, j) => {
        if (i === j) return;
        for (const b of positions) {
          const overlap = a.lane === b.lane && a.start < b.start + FRACTION_PIECE_UNITS[j]! && b.start < a.start + FRACTION_PIECE_UNITS[i]!;
          const legal = b.start + FRACTION_PIECE_UNITS[j]! <= 4 && !overlap;
          const next = placeFractionPiece(config, state, second, b);
          expect(canPlaceFraction(config, state, second, b)).toBe(legal);
          expect(next === state).toBe(!legal);
          expect(next.pieces[i]).toBe(state.pieces[i]);
          expect(validFractionState(config, next)).toBe(true);
          const raw = { ...state, pieces: state.pieces.map(p => p.id === second ? { ...p, placement: b } : p) };
          expect(fractionStateSchema.safeParse(raw).success).toBe(legal);
        }
      });
    }));
  });
  it('counts covered units rather than the span across a gap; two quarters equal a half', () => {
    let state = placeFractionPiece(config, initial(), config.pieceIds[0]!, { lane: 'top', start: 0 });
    state = placeFractionPiece(config, state, config.pieceIds[2]!, { lane: 'bottom', start: 0 });
    state = placeFractionPiece(config, state, config.pieceIds[3]!, { lane: 'bottom', start: 3 });
    expect(fractionOccupancy(state, 'bottom')).toEqual([true, false, false, true]);
    expect(fractionLaneUnits(state, 'top')).toBe(2); expect(fractionLaneUnits(state, 'bottom')).toBe(2);
  });
  it('fills both wholes and preserves total inventory while moving and returning pieces', () => {
    let state = initial();
    config.pieceIds.forEach((id, index) => {
      state = placeFractionPiece(config, state, id, { lane: index < 2 ? 'top' : 'bottom', start: index < 2 ? index * 2 : index - 2 });
    });
    expect(fractionLaneUnits(state, 'top')).toBe(4); expect(fractionLaneUnits(state, 'bottom')).toBe(4);
    for (const id of config.pieceIds) {
      const previous = state;
      state = placeFractionPiece(config, state, id, null);
      expect(previous.pieces.find(p => p.id === id)!.placement).not.toBeNull();
      expect(state.pieces.map(p => p.id)).toEqual(config.pieceIds);
      expect(validFractionState(config, state)).toBe(true);
    }
    expect(state).toEqual(initial());
  });
  it('accepts self-overlapping moves, rejects unknown pieces and preserves exact no-op state', () => {
    const id = config.pieceIds[0]!;
    const state = placeFractionPiece(config, initial(), id, { lane: 'top', start: 0 });
    const moved = placeFractionPiece(config, state, id, { lane: 'top', start: 1 });
    expect(moved.pieces[0]!.placement).toEqual({ lane: 'top', start: 1 });
    expect(placeFractionPiece(config, moved, id, { lane: 'top', start: 1 })).toBe(moved);
    expect(placeFractionPiece(config, moved, crypto.randomUUID(), null)).toBe(moved);
    expect(placeFractionPiece(config, initial(), id, null).pieces).toEqual(initial().pieces);
    const malformed = { ...state, pieces: state.pieces.slice(1) };
    expect(placeFractionPiece(config, malformed, id, null)).toBe(malformed);
  });
  it('copies incoming placements and does not mutate frozen committed state', () => {
    const state = initial(); state.pieces.forEach(Object.freeze); Object.freeze(state.pieces); Object.freeze(state);
    const target: FractionPlacement = { lane: 'top', start: 0 };
    const next = placeFractionPiece(config, state, config.pieceIds[0]!, target); target.start = 2;
    expect(next.pieces[0]!.placement?.start).toBe(0); expect(state.pieces[0]!.placement).toBeNull();
  });
});

describe('fraction lesson and persistence compatibility', () => {
  it('validates metadata with existing catalog ancestry but does not expose an unfinished activity', () => {
    expect(catalogSchema.safeParse({ nodes: [...bundledCatalog.nodes, ...fractionsCatalog.nodes], lessons: [...bundledCatalog.lessons, ...fractionsCatalog.lessons] }).success).toBe(true);
    expect(fractionsVersion.provenance.reviewStatus).toBe('teacher-review-pending');
    expect(fractionsVersion.provenance.note).toContain('Original Demo Concept — Preview / Teacher Review Pending');
    for (const catalog of [bundledCatalog, publicCatalog]) expect(catalog.lessons.some(l => l.id === FRACTIONS.lesson)).toBe(false);
  });
  it('initializes and validates pinned progress, rejecting mismatched identities and activity state', () => {
    const progress = initialProgress(fractionsVersion);
    expect(validProgress(fractionsVersion, progress)).toBe(true);
    const invalid: LessonProgress[] = [{ ...progress, lessonVersionId: crypto.randomUUID() }, { ...progress, currentActivityId: crypto.randomUUID() },
      { ...progress, states: {} }, { ...progress, states: { [FRACTIONS.activity]: { kind: 'explain' as const } } },
      { ...progress, states: { [FRACTIONS.activity]: { ...initial(), pieces: [] } } }];
    for (const candidate of invalid)
      expect(validProgress(fractionsVersion, candidate)).toBe(false);
    const foreign = initial(); foreign.pieces[0]!.id = crypto.randomUUID();
    expect(validProgress(fractionsVersion, { ...progress, states: { [FRACTIONS.activity]: foreign } })).toBe(false);
  });
  it('keeps every existing lesson readable and session envelopes round-trippable', () => {
    for (const version of bundledVersions) {
      expect(lessonVersionSchema.parse(version)).toEqual(version);
      const definition = bundledCatalog.lessons.find(l => l.id === version.lessonId)!;
      const id = { id: crypto.randomUUID(), lessonVersionId: version.id,
        context: { classId: definition.classLevelId, subjectId: definition.subjectId, classLabel: 'Existing', subjectLabel: 'Existing' } };
      const session = createLessonSession({ sessionId: id.id, classId: id.context.classId, subjectId: id.context.subjectId }, version);
      expect(validProgress(version, session.lesson!.progress)).toBe(true);
      const snapshot = serializeSession(session, id, null);
      expect(serializeSession(deserializeSession(snapshot), id, null)).toEqual(snapshot);
    }
  });
  it('rejects invalid reducer updates without a revision and commits valid progress without modifying ink', () => {
    const id = identity(), session = createLessonSession({ sessionId: id.id, classId: FRACTIONS.class, subjectId: FRACTIONS.subject }, fractionsVersion);
    expect(sessionReducer(session, { type: 'activity-state', id: FRACTIONS.activity, state: { ...initial(), pieces: [] } })).toBe(session);
    const next = sessionReducer(session, { type: 'activity-state', id: FRACTIONS.activity,
      state: placeFractionPiece(config, initial(), config.pieceIds[0]!, { lane: 'bottom', start: 2 }) });
    expect(next.lesson!.progress.localRevision).toBe(1);
    expect(next.whiteboard).toBe(session.whiteboard); expect(next.annotations).toBe(session.annotations);
  });
  it('recovers multilingual placements and preserves an older pending payload through a newer local save', async () => {
    const id = identity(), session = createLessonSession({ sessionId: id.id, classId: FRACTIONS.class, subjectId: FRACTIONS.subject }, fractionsVersion);
    const snapshot = serializeSession(session, id, null);
    // New empty boards remain v2 until richer content is added. Exercise v4 explicitly.
    if (snapshot.whiteboard.schemaVersion === 1) throw new Error('Expected paged board');
    snapshot.whiteboard = whiteboardV4Schema.parse({ ...snapshot.whiteboard, schemaVersion: 4,
      pages: snapshot.whiteboard.pages.map(page => ({ ...page, shapes: [], texts: [] })), deletedPages: [] });
    const record = newRecord(snapshot);
    record.progressSync = { serverRevision: 2, acknowledgedLocalRevision: -1,
      pending: { mutationId: crypto.randomUUID(), baseServerRevision: 2, progress: structuredClone(snapshot.lesson!.progress) } };
    record.sync[snapshot.whiteboard.id] = { serverRevision: 0, acknowledgedLocalRevision: -1,
      pending: { mutationId: crypto.randomUUID(), baseServerRevision: 0, document: structuredClone(snapshot.whiteboard) } };
    const repo = new SessionRepository(crypto.randomUUID()), saved = await repo.save(record);
    const nextState: FractionState = { ...placeFractionPiece(config, initial(), config.pieceIds[0]!, { lane: 'bottom', start: 2 }), language: 'ml' };
    const next = sessionReducer(deserializeSession(snapshot), { type: 'activity-state', id: FRACTIONS.activity, state: nextState });
    await repo.save({ ...saved, snapshot: serializeSession(next, id, null) });
    const recovered = (await repo.load(id.id))!;
    expect(recovered.snapshot.lesson!.progress.states[FRACTIONS.activity]).toEqual(nextState);
    expect(recovered.progressSync).toEqual(record.progressSync); expect(recovered.sync).toEqual(record.sync);
    expect(recovered.snapshot.whiteboard).toEqual(snapshot.whiteboard); expect(recovered.snapshot.whiteboard.schemaVersion).toBe(4);
    expect(recovered.snapshot.annotations).toEqual(snapshot.annotations); expect(recovered.snapshot.schemaVersion).toBe(1);
    expect(new TextEncoder().encode(JSON.stringify(nextState)).byteLength).toBeLessThan(2048);
  });
});
