import { z } from 'zod';
import { progressSchema } from './lesson.js';
import { boxCorners } from './shape-geometry.js';

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
const position = z.strictObject({ x: z.number().finite().min(0).max(1200), y: z.number().finite().min(0).max(675) });
const shapeStyle = { id: uuid, kind: z.literal('shape'), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), width: z.number().positive().max(20) };
const rotation = z.number().finite().min(-180).max(180).optional();
/** Optional box rotation preserves existing v3 payloads verbatim; absence means zero. */
export const teachingShapeSchema = z.discriminatedUnion('shape', [
  z.strictObject({ ...shapeStyle, shape: z.literal('line'), start: position, end: position }),
  z.strictObject({ ...shapeStyle, shape: z.literal('arrow'), start: position, end: position }),
  z.strictObject({ ...shapeStyle, shape: z.literal('rectangle'), origin: position, size: z.strictObject({ width: z.number().positive().max(1200), height: z.number().positive().max(675) }), rotation }),
  z.strictObject({ ...shapeStyle, shape: z.literal('triangle'), origin: position, size: z.strictObject({ width: z.number().positive().max(1200), height: z.number().positive().max(675) }), rotation }),
  z.strictObject({ ...shapeStyle, shape: z.literal('circle'), center: position, radius: z.number().positive().max(337.5) }),
]).superRefine((s, ctx) => {
  const invalid = s.shape === 'line' || s.shape === 'arrow' ? Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y) < 1
    : s.shape === 'circle' ? s.center.x - s.radius < 0 || s.center.y - s.radius < 0 || s.center.x + s.radius > 1200 || s.center.y + s.radius > 675
    : boxCorners(s).some(p => p.x < -1e-8 || p.y < -1e-8 || p.x > 1200 + 1e-8 || p.y > 675 + 1e-8);
  if (invalid) ctx.addIssue({ code: 'custom', message: 'Invalid shape geometry or scene bounds' });
});
export type TeachingShape = z.infer<typeof teachingShapeSchema>;
export type TeachingShapeType = TeachingShape['shape'];
export const whiteboardV3Schema = z.strictObject({
  ...whiteboardV2Schema.shape, schemaVersion: z.literal(3),
  pages: z.array(pageSchema.extend({ shapes: z.array(teachingShapeSchema).max(10000) })).min(1).max(MAX_WHITEBOARD_PAGES),
  deletedPages: z.array(pageSchema.extend({ shapes: z.array(teachingShapeSchema).max(10000) })).max(MAX_WHITEBOARD_PAGES),
}).superRefine((doc, ctx) => {
  // Reuse all existing page/ink checks without changing the v2 wire format.
  const withoutShapes = (p: typeof doc.pages[number]) => ({ id: p.id, background: p.background, objects: p.objects });
  if (!whiteboardV2Schema.safeParse({ ...doc, schemaVersion: 2, pages: doc.pages.map(withoutShapes), deletedPages: doc.deletedPages.map(withoutShapes) }).success)
    ctx.addIssue({ code: 'custom', message: 'Invalid whiteboard pages or ink' });
  if ([...doc.pages, ...doc.deletedPages].some(p => p.objects.length + p.shapes.length > 10000 || new Set([...p.objects, ...p.shapes].map(o => o.id)).size !== p.objects.length + p.shapes.length))
    ctx.addIssue({ code: 'custom', message: 'Duplicate object ID or page object limit exceeded' });
  if (new TextEncoder().encode(JSON.stringify(doc)).byteLength > MAX_SNAPSHOT_BYTES)
    ctx.addIssue({ code: 'custom', message: 'Snapshot exceeds 2 MiB limit' });
});
export const documentSchema = z.union([documentV1Schema, whiteboardV2Schema, whiteboardV3Schema]);
export type SerializedV1 = z.infer<typeof documentV1Schema>;
export type SerializedWhiteboard = z.infer<typeof whiteboardV2Schema> | z.infer<typeof whiteboardV3Schema>;
/** Deterministic page identity; never mutate the original or an outbox payload. */
export function migrateWhiteboard(doc: SerializedV1): z.infer<typeof whiteboardV2Schema>;
export function migrateWhiteboard(doc: SerializedV1 | SerializedWhiteboard): SerializedWhiteboard;
export function migrateWhiteboard(doc: SerializedV1 | SerializedWhiteboard): SerializedWhiteboard {
  if (doc.schemaVersion !== 1) return doc;
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
