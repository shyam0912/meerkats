import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { plantVersion, PLANT } from '../../contracts/plant-content';
import { initialPlantState, plantStateSchema, placePlantPart, plantDropTarget, validPlantState, wholePlant, type PlantSlot } from '../../contracts/plant';
import { initialProgress, validProgress } from '../../contracts/lesson';
import { createLessonSession } from '../drawing/session';
import { serializeSession } from '../persistence/serialization';
import { newRecord, SessionRepository } from '../persistence/database';
const activity = plantVersion.activities[0]!;
if (activity.kind !== 'plant-builder') throw new Error('Plant fixture');
const config = activity.config;
it('bounds the five stable parts and rejects invalid or foreign identities and slots', () => {
  const initial = initialPlantState(config);
  expect(validPlantState(config, initial)).toBe(true);
  for (const candidate of [{ ...initial, parts: initial.parts.slice(1) }, { ...initial, parts: Array(5).fill(initial.parts[0]) },
    { ...initial, selectedPartId: crypto.randomUUID() }, { ...initial, extra: true }, { ...initial, water: 'flood' },
    { ...initial, parts: initial.parts.map(p => ({ ...p, slot: 'flower' })) }]) expect(plantStateSchema.safeParse(candidate).success).toBe(false);
  expect(validPlantState(config, { ...initial, parts: initial.parts.map(p => ({ ...p, id: crypto.randomUUID() })) })).toBe(false);
  expect(JSON.stringify(wholePlant(initial)).length).toBeLessThan(2048);
});
it('places parts in any order without changing identity or displacing other parts', () => {
  let state = initialPlantState(config);
  for (const i of [4, 2, 0, 3, 1]) state = placePlantPart(state, config.partIds[i]!, ['root','stem','leaf-right','leaf-left','flower'][i] as PlantSlot);
  expect(state.parts.map(p => p.id)).toEqual(config.partIds);
  expect(validPlantState(config, state)).toBe(true);
  expect(state.parts.every(p => p.slot !== null)).toBe(true);
  expect(placePlantPart(state, config.partIds[0]!, 'flower')).toBe(state);
  expect(placePlantPart(state, config.partIds[2]!, 'leaf-left')).toBe(state);
  expect(placePlantPart(state, config.partIds[2]!, null).parts[2]!.slot).toBeNull();
});
it('snaps only compatible vacant targets within range, including interchangeable leaves', () => {
  const state = initialPlantState(config);
  expect(plantDropTarget(state, config.partIds[0]!, 760, 510)).toBe('root');
  expect(plantDropTarget(state, config.partIds[0]!, 760, 178)).toBeNull();
  expect(plantDropTarget(state, config.partIds[2]!, 870, 365)).toBe('leaf-right');
  expect(plantDropTarget(state, config.partIds[0]!, NaN, 510)).toBeNull();
  expect(plantDropTarget(state, 'unknown', 760, 510)).toBeNull();
});
it('validates pinned progress and leaves existing envelope and drawing formats intact', () => {
  const progress = initialProgress(plantVersion);
  expect(validProgress(plantVersion, progress)).toBe(true);
  expect(validProgress(plantVersion, { ...progress, states: {} })).toBe(false);
  expect(validProgress(plantVersion, { ...progress, states: { [PLANT.activity]: { ...initialPlantState(config), parts: [] } } })).toBe(false);
});
it('round-trips complete multilingual state and an exact pending retry without changing drawing documents', async () => {
  const identity = { id: crypto.randomUUID(), lessonVersionId: PLANT.version,
    context: { classId: PLANT.class, subjectId: PLANT.subject, classLabel: 'Standard 2', subjectLabel: 'Environmental Studies' } };
  const session = createLessonSession({ sessionId: identity.id, classId: PLANT.class, subjectId: PLANT.subject }, plantVersion);
  session.lesson!.progress.states[PLANT.activity] = { ...wholePlant(initialPlantState(config)), language: 'ml', light: 'no-light' };
  const snapshot = serializeSession(session, identity, null), record = newRecord(snapshot);
  record.progressSync = { serverRevision: 2, acknowledgedLocalRevision: -1,
    pending: { mutationId: crypto.randomUUID(), baseServerRevision: 2, progress: structuredClone(snapshot.lesson!.progress) } };
  const repo = new SessionRepository(crypto.randomUUID()); await repo.save(record);
  const recovered = (await repo.load(identity.id))!;
  expect(recovered.snapshot).toEqual(snapshot); expect(recovered.progressSync).toEqual(record.progressSync);
});
