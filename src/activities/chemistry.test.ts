import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { chemistryVersion, chemistryCatalog, CHEMISTRY, pentane, methylbutane } from '../../contracts/chemistry';
import { activitySchema, annotationKey, catalogSchema, initialProgress, initialState, lessonVersionSchema, validProgress } from '../../contracts/lesson';
import { moleculeSchema, moleculeConfigSchema, branchPosition, formula, longestLength, topology, type MoleculeState } from '../../contracts/molecule';
import { activeDocument, createLessonSession, sessionReducer } from '../drawing/session';
import { serializeSession, deserializeSession } from '../persistence/serialization';
import { newRecord, SessionRepository } from '../persistence/database';
import ActivityHost from './ActivityHost';
import type { ActivityProps } from './registry';

describe('bounded carbon structure contracts', () => {
  it('validates both source-grounded structures and their valence-completed formulas', () => {
    for (const m of [pentane, methylbutane]) { expect(moleculeSchema.safeParse(m).success).toBe(true); expect(formula(m)).toBe('C5H12'); }
    expect(topology(pentane)).not.toBe(topology(methylbutane));
  });
  it('rejects duplicate or invalid atom identities', () => {
    expect(moleculeSchema.safeParse({ ...pentane, atoms: [...pentane.atoms.slice(1), pentane.atoms[1]] }).success).toBe(false);
    expect(moleculeSchema.safeParse({ ...pentane, atoms: [{ id: 'Carbon 1', element: 'C' }, ...pentane.atoms.slice(1)] }).success).toBe(false);
  });
  it('rejects missing bond endpoints, duplicate bonds and self bonds', () => {
    for (const change of [{ to: 'absent' }, { to: 'a' }, { id: 'bc' }])
      expect(moleculeSchema.safeParse({ ...pentane, bonds: [{ ...pentane.bonds[0], ...change }, ...pentane.bonds.slice(1)] }).success).toBe(false);
  });
  it('rejects cycles, disconnected structures and incomplete layouts without throwing', () => {
    expect(moleculeSchema.safeParse({ ...pentane, bonds: [...pentane.bonds, { id: 'ea', from: 'e', to: 'a', order: 1 }] }).success).toBe(false);
    expect(moleculeSchema.safeParse({ ...pentane, bonds: pentane.bonds.slice(1) }).success).toBe(false);
    expect(moleculeSchema.safeParse({ ...pentane, layout: {} }).success).toBe(false);
  });
  it('preserves atom and bond identity across independent layout changes', () => {
    const relaid = moleculeSchema.parse({ ...pentane, layout: Object.fromEntries(Object.entries(pentane.layout).map(([id, p]) => [id, { x: p.y, y: p.x }])) });
    expect(relaid.atoms).toEqual(pentane.atoms); expect(relaid.bonds).toEqual(pentane.bonds); expect(topology(relaid)).toBe(topology(pentane));
  });
  it('supports equal longest paths and a shorter continuous candidate', () => {
    expect(longestLength(methylbutane)).toBe(4); expect(methylbutane.candidates.map(c => c.atoms.length)).toEqual([3, 4, 4]);
    expect(moleculeSchema.safeParse({ ...methylbutane, parentChain: ['a', 'b', 'e'] }).success).toBe(false);
    expect(moleculeSchema.safeParse({ ...methylbutane, candidates: [{ id: 'bad', label: 'Bad', atoms: ['a', 'd'] }] }).success).toBe(false);
  });
  it('validates numbering, branch ownership and the single-methyl limit', () => {
    expect(branchPosition(methylbutane, 'forward')).toBe(2); expect(branchPosition(methylbutane, 'reverse')).toBe(3);
    expect(moleculeSchema.safeParse({ ...methylbutane, branchAtomId: 'c' }).success).toBe(false);
    expect(moleculeConfigSchema.safeParse({ stage: 'numbering', structures: [pentane] }).success).toBe(false);
  });
  it('rejects an isomer pair with the same topology or different carbon IDs', () => {
    expect(moleculeConfigSchema.safeParse({ stage: 'isomers', structures: [pentane, { ...pentane, id: 'copy' }] }).success).toBe(false);
    expect(moleculeConfigSchema.safeParse({ stage: 'isomers', structures: [pentane] }).success).toBe(false);
  });
  it('rejects stage configurations with no meaningful comparison', () => {
    expect(moleculeConfigSchema.safeParse({ stage: 'chain', structures: [{ ...methylbutane, candidates: [] }] }).success).toBe(false);
    expect(moleculeConfigSchema.safeParse({ stage: 'discover', structures: [methylbutane] }).success).toBe(false);
  });
  it('renders safe fallback for invalid chemistry data', () => {
    const bad = { ...chemistryVersion.activities[0], config: { stage: 'discover', structures: [] } };
    expect(activitySchema.safeParse(bad).success).toBe(false);
    expect(renderToString(createElement(ActivityHost, { activity: bad, state: { kind: 'explain' }, onChange: () => {} } as unknown as ActivityProps))).toContain('Activity unavailable');
  });
});

describe('curriculum lesson and durable ownership', () => {
  it('validates the catalog, source metadata and seven deliberately ordered steps', () => {
    expect(catalogSchema.parse(chemistryCatalog).lessons[0]?.publishedVersionId).toBe(CHEMISTRY.version);
    expect(lessonVersionSchema.parse(chemistryVersion).provenance).toMatchObject({ edition: 'First Edition, 2025', pages: ['7–10', '25–26'], reviewStatus: 'teacher-review-pending' });
    expect(chemistryVersion.activities.map(a => a.kind === 'molecule-builder' && a.config.stage)).toEqual(['discover', 'chain', 'numbering', 'branch', 'name', 'rearrange', 'isomers']);
    expect(new Set(chemistryVersion.activities.map(a => a.id)).size).toBe(7);
  });
  it('rejects cross-stage state, unknown selections and excess reveal counts', () => {
    const progress = initialProgress(chemistryVersion); const first = chemistryVersion.activities[0]!;
    for (const patch of [{ visibleCount: 6 }, { candidateId: 'absent' }, { direction: 'forward' }, { structureId: 'unknown' }, { visibleCount: -1 }]) {
      expect(validProgress(chemistryVersion, { ...progress, states: { ...progress.states, [first.id]: { ...progress.states[first.id], ...patch } } } as typeof progress)).toBe(false);
    }
  });
  it('keeps version pinned, definition unchanged and every chemistry state durable in IndexedDB', async () => {
    const before = JSON.stringify(chemistryVersion); const id = crypto.randomUUID();
    let session = createLessonSession({ sessionId: id, classId: CHEMISTRY.class, subjectId: CHEMISTRY.subject }, chemistryVersion);
    const patches: Partial<MoleculeState>[] = [{ visibleCount: 5 }, { candidateId: 'turn' }, { direction: 'reverse' }, { revealed: true },
      { nameParts: ['position', 'branch', 'parent', 'suffix'], focusPart: 'suffix' }, { structureId: 'methylbutane', revealed: true }, { revealed: true }];
    for (const [index, activity] of chemistryVersion.activities.entries()) {
      session = sessionReducer(session, { type: 'activity', id: activity.id });
      session = sessionReducer(session, { type: 'activity-state', id: activity.id, state: { ...initialState(activity), ...patches[index] } as MoleculeState });
    }
    const identity = { id, lessonVersionId: CHEMISTRY.version, context: { classId: CHEMISTRY.class, subjectId: CHEMISTRY.subject, classLabel: 'Standard X', subjectLabel: 'Chemistry' } };
    const snapshot = serializeSession(session, identity, null); const repo = new SessionRepository(crypto.randomUUID());
    await repo.save(newRecord(snapshot)); const restored = deserializeSession((await repo.load(id))!.snapshot);
    expect(restored.lesson).toEqual(session.lesson); expect(restored.lesson?.version.id).toBe(CHEMISTRY.version);
    expect(restored.lesson?.progress.currentActivityId).toBe(chemistryVersion.activities[6]!.id); expect(JSON.stringify(chemistryVersion)).toBe(before);
  });
  it('keeps annotations activity/scene-specific and Whiteboard history independent', () => {
    let session = createLessonSession({ sessionId: crypto.randomUUID(), classId: CHEMISTRY.class, subjectId: CHEMISTRY.subject }, chemistryVersion);
    const first = activeDocument(session).document.id;
    session = sessionReducer(session, { type: 'document', documentId: first, action: { type: 'commit', stroke: { id: crypto.randomUUID(), kind: 'ink', tool: 'pen', color: '#000000', width: 4, points: [200, 200] } } });
    session = sessionReducer(session, { type: 'activity', id: chemistryVersion.activities[1]!.id }); expect(activeDocument(session).document.objects).toHaveLength(0);
    session = sessionReducer(session, { type: 'mode', mode: 'whiteboard' });
    session = sessionReducer(session, { type: 'document', documentId: session.whiteboard.document.id, action: { type: 'undo' } });
    session = sessionReducer(session, { type: 'activity', id: chemistryVersion.activities[0]!.id }); expect(activeDocument(session).document.objects).toHaveLength(1);
    expect(Object.keys(session.annotations)).toEqual(chemistryVersion.activities.map(a => annotationKey({ lessonVersionId: CHEMISTRY.version, activityId: a.id, sceneId: a.sceneId })));
  });
});
