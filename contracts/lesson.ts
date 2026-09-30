import { z } from 'zod';

const id = z.uuid();
const title = z.string().min(1).max(120);
export const catalogNodeSchema = z.strictObject({ id, parentId: id.nullable(),
  kind: z.enum(['curriculum', 'class', 'subject', 'chapter', 'topic']), title,
  order: z.number().int().min(0).max(1000) });
export const lessonDefinitionSchema = z.strictObject({ id, curriculumId: id, classLevelId: id,
  subjectId: id, chapterId: id, topicId: id, title, order: z.number().int().nonnegative(), publishedVersionId: id });
export const catalogSchema = z.strictObject({ nodes: z.array(catalogNodeSchema).max(100), lessons: z.array(lessonDefinitionSchema).max(100) })
  .superRefine((catalog, ctx) => {
    const ranks = ['curriculum', 'class', 'subject', 'chapter', 'topic'];
    const nodes = new Map(catalog.nodes.map(n => [n.id, n]));
    if (nodes.size !== catalog.nodes.length || new Set(catalog.lessons.map(l => l.id)).size !== catalog.lessons.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate catalog identity' });
    for (const node of catalog.nodes) {
      const rank = ranks.indexOf(node.kind);
      if (rank === 0 ? node.parentId !== null : nodes.get(node.parentId ?? '')?.kind !== ranks[rank - 1])
        ctx.addIssue({ code: 'custom', message: 'Invalid catalog parent' });
    }
    for (const lesson of catalog.lessons) {
      const chain = [lesson.curriculumId, lesson.classLevelId, lesson.subjectId, lesson.chapterId, lesson.topicId];
      if (chain.some((key, i) => nodes.get(key)?.kind !== ranks[i] || (i > 0 && nodes.get(key)?.parentId !== chain[i - 1])))
        ctx.addIssue({ code: 'custom', message: 'Invalid lesson catalog path' });
    }
  });
const common = { id, title, sceneId: id, annotationPolicy: z.enum(['ink', 'none']), guidance: z.string().max(500) };
export const visualItemSchema = z.strictObject({ id, label: title, shape: z.enum(['circle', 'triangle', 'square']),
  description: z.string().max(200), color: z.string().regex(/^#[a-fA-F0-9]{6}$/) });
export const activitySchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...common, kind: z.literal('explain'), config: z.strictObject({ items: z.array(visualItemSchema).min(1).max(3) }) }),
  z.strictObject({ ...common, kind: z.literal('explore'), config: z.strictObject({ items: z.array(visualItemSchema).min(1).max(3) }),
    initialState: z.strictObject({ selectedId: id.nullable() }) }),
  z.strictObject({ ...common, kind: z.literal('reveal'), config: z.strictObject({ items: z.array(z.strictObject({ id, text: z.string().min(1).max(180) })).min(1).max(6) }),
    initialState: z.strictObject({ revealed: z.number().int().min(0).max(6) }) }),
]);
export const lessonVersionSchema = z.strictObject({ id, lessonId: id, schemaVersion: z.literal(1),
  version: z.number().int().positive(), title, status: z.literal('published'),
  objectives: z.array(z.string().min(1).max(250)).min(1).max(8),
  provenance: z.strictObject({ sourceType: z.enum(['original-demo', 'licensed', 'original']), sourceTitle: title,
    edition: z.string().max(60).nullable(), pages: z.array(z.string().max(30)).max(30),
    reviewStatus: z.enum(['engineering-demo', 'reviewed']), note: z.string().max(500) }),
  assetIds: z.array(id).max(30), activities: z.array(activitySchema).min(1).max(12),
}).superRefine((version, ctx) => {
  if (new Set(version.activities.map(a => a.id)).size !== version.activities.length)
    ctx.addIssue({ code: 'custom', message: 'Duplicate activity identity' });
  for (const activity of version.activities) {
    if (new Set(activity.config.items.map(i => i.id)).size !== activity.config.items.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate item identity' });
    if (activity.kind === 'explore' && activity.initialState.selectedId !== null && !activity.config.items.some(i => i.id === activity.initialState.selectedId))
      ctx.addIssue({ code: 'custom', message: 'Unknown initial selection' });
    if (activity.kind === 'reveal' && activity.initialState.revealed > activity.config.items.length)
      ctx.addIssue({ code: 'custom', message: 'Initial reveal outside bounds' });
  }
});
export const activityStateSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('explain') }),
  z.strictObject({ kind: z.literal('explore'), selectedId: id.nullable() }),
  z.strictObject({ kind: z.literal('reveal'), revealed: z.number().int().min(0).max(6) }),
]);
export const progressSchema = z.strictObject({ lessonVersionId: id, currentActivityId: id,
  localRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  states: z.record(id, activityStateSchema).refine(v => Object.keys(v).length <= 12) });
export const progressSaveSchema = z.strictObject({ mutationId: id,
  baseServerRevision: z.number().int().min(0).max(2147483646), progress: progressSchema });
export const progressAckSchema = z.strictObject({ mutationId: id, serverRevision: z.number().int().positive(), durable: z.literal(true) });
export const lessonSessionSchema = z.strictObject({ version: lessonVersionSchema, progress: progressSchema })
  .refine(({ version, progress }) => validProgress(version, progress), 'Progress does not belong to pinned lesson');
export type Catalog = z.infer<typeof catalogSchema>;
export type LessonDefinition = z.infer<typeof lessonDefinitionSchema>;
export type LessonVersion = z.infer<typeof lessonVersionSchema>;
export type ActivityDefinition = z.infer<typeof activitySchema>;
export type ActivityState = z.infer<typeof activityStateSchema>;
export type LessonProgress = z.infer<typeof progressSchema>;
export type LessonSession = z.infer<typeof lessonSessionSchema>;
export type ProgressSave = z.infer<typeof progressSaveSchema>;
export function initialState(activity: ActivityDefinition): ActivityState {
  return activity.kind === 'explain' ? { kind: 'explain' } : { kind: activity.kind, ...activity.initialState } as ActivityState;
}
export function initialProgress(version: LessonVersion): LessonProgress {
  return { lessonVersionId: version.id, currentActivityId: version.activities[0]!.id, localRevision: 0,
    states: Object.fromEntries(version.activities.map(a => [a.id, initialState(a)])) };
}
export function validProgress(version: LessonVersion, progress: LessonProgress): boolean {
  return version.id === progress.lessonVersionId && version.activities.some(a => a.id === progress.currentActivityId) &&
    Object.keys(progress.states).length === version.activities.length && version.activities.every(a => {
      const state = progress.states[a.id];
      return state?.kind === a.kind && (state.kind !== 'explore' || state.selectedId === null || a.config.items.some(i => i.id === state.selectedId)) &&
        (state.kind !== 'reveal' || state.revealed <= a.config.items.length);
    });
}
export function annotationKey(target: { sceneId: string; lessonVersionId?: string; activityId?: string }) {
  return target.lessonVersionId ? `${target.lessonVersionId}/${target.activityId}/${target.sceneId}` : target.sceneId;
}
