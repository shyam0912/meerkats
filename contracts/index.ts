import { z } from 'zod';
import { progressSchema } from './lesson.js';

export const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
export const uuid = z.uuid();
const reference = z.string().min(1).max(100);
export const contextSchema = z.strictObject({
  classId: reference.nullable(), subjectId: reference.nullable(),
  classLabel: z.string().max(100), subjectLabel: z.string().max(100),
});
export const targetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('whiteboard') }),
  z.strictObject({ kind: z.literal('annotation'), sceneId: reference, lessonVersionId: uuid.optional(), activityId: uuid.optional() })
    .refine(t => Boolean(t.lessonVersionId) === Boolean(t.activityId), 'Complete lesson anchor required'),
]);
export const inkSchema = z.strictObject({
  id: uuid, kind: z.literal('ink'), tool: z.enum(['pen', 'eraser']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/), width: z.number().positive().max(512),
  points: z.array(z.number().finite().min(0).max(1200)).min(2).max(200000)
    .refine(points => points.length % 2 === 0, 'Coordinate pairs required'),
});
export const documentV1Schema = z.strictObject({
  schemaVersion: z.literal(1), id: uuid,
  owner: z.strictObject({ sessionId: uuid, classId: reference.nullable(), subjectId: reference.nullable(), target: targetSchema }),
  localRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  bounds: z.strictObject({ width: z.literal(1200), height: z.literal(675) }),
  objects: z.array(inkSchema).max(10000),
}).superRefine((doc, ctx) => {
  if (new Set(doc.objects.map(o => o.id)).size !== doc.objects.length)
    ctx.addIssue({ code: 'custom', message: 'Duplicate ink ID' });
  if (doc.objects.some(o => o.points.some((n, i) => n > (i % 2 ? doc.bounds.height : doc.bounds.width))))
    ctx.addIssue({ code: 'custom', message: 'Point outside scene' });
  if (new TextEncoder().encode(JSON.stringify(doc)).byteLength > MAX_SNAPSHOT_BYTES)
    ctx.addIssue({ code: 'custom', message: 'Snapshot exceeds 2 MiB limit' });
});
export const MAX_WHITEBOARD_PAGES = 20;
export const backgroundSchema = z.enum(['white', 'lined', 'dotted', 'grid']);
export type PageBackground = z.infer<typeof backgroundSchema>;
const pageSchema = z.strictObject({ id: uuid, background: backgroundSchema, objects: z.array(inkSchema).max(10000) });
export const whiteboardV2Schema = z.strictObject({
  schemaVersion: z.literal(2), id: uuid,
  owner: z.strictObject({ sessionId: uuid, classId: reference.nullable(), subjectId: reference.nullable(),
    target: z.strictObject({ kind: z.literal('whiteboard') }) }),
  localRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  bounds: z.strictObject({ width: z.literal(1200), height: z.literal(675) }),
  activePageId: uuid, pages: z.array(pageSchema).min(1).max(MAX_WHITEBOARD_PAGES),
  deletedPages: z.array(pageSchema).max(MAX_WHITEBOARD_PAGES),
}).superRefine((doc, ctx) => {
  const pages = [...doc.pages, ...doc.deletedPages];
  if (pages.length > MAX_WHITEBOARD_PAGES || new Set(pages.map(p => p.id)).size !== pages.length || !doc.pages.some(p => p.id === doc.activePageId))
    ctx.addIssue({ code: 'custom', message: 'Invalid page IDs, selection or page limit' });
  if (pages.some(p => new Set(p.objects.map(o => o.id)).size !== p.objects.length ||
      p.objects.some(o => o.points.some((n, i) => n > (i % 2 ? doc.bounds.height : doc.bounds.width)))))
    ctx.addIssue({ code: 'custom', message: 'Invalid page ink' });
  if (new TextEncoder().encode(JSON.stringify(doc)).byteLength > MAX_SNAPSHOT_BYTES)
    ctx.addIssue({ code: 'custom', message: 'Snapshot exceeds 2 MiB limit' });
});
export const documentSchema = z.union([documentV1Schema, whiteboardV2Schema]);
export type SerializedV1 = z.infer<typeof documentV1Schema>;
export type SerializedWhiteboard = z.infer<typeof whiteboardV2Schema>;
/** Deterministic page identity; never mutate the original or an outbox payload. */
export function migrateWhiteboard(doc: SerializedV1 | SerializedWhiteboard): SerializedWhiteboard {
  if (doc.schemaVersion === 2) return doc;
  if (doc.owner.target.kind !== 'whiteboard') throw new Error('Only whiteboards migrate');
  return whiteboardV2Schema.parse({ schemaVersion: 2, id: doc.id, owner: doc.owner, bounds: doc.bounds,
    localRevision: doc.localRevision + 1, activePageId: doc.id,
    pages: [{ id: doc.id, background: 'white', objects: doc.objects }], deletedPages: [] });
}
export const sessionSchema = z.strictObject({ id: uuid, context: contextSchema, lessonVersionId: uuid.optional() });
export const saveRequestSchema = z.strictObject({
  mutationId: uuid, baseServerRevision: z.number().int().nonnegative().max(2147483646), document: documentSchema,
});
export const acknowledgementSchema = z.strictObject({
  documentId: uuid, mutationId: uuid, serverRevision: z.number().int().positive(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/), durable: z.literal(true),
});
export const remoteDocumentSchema = z.strictObject({ document: documentSchema, serverRevision: z.number().int().positive() });
export const sessionResponseSchema = sessionSchema.extend({ documents: z.array(remoteDocumentSchema).max(100),
  progress: progressSchema.optional(), progressServerRevision: z.number().int().nonnegative().optional() });
export type SerializedDocument = z.infer<typeof documentSchema>;
export type SessionIdentity = z.infer<typeof sessionSchema>;
export type SaveRequest = z.infer<typeof saveRequestSchema>;
export type SaveAcknowledgement = z.infer<typeof acknowledgementSchema>;
