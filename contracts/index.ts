import { z } from 'zod';

export const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
export const uuid = z.uuid();
const reference = z.string().min(1).max(100);
export const contextSchema = z.strictObject({
  classId: reference.nullable(), subjectId: reference.nullable(),
  classLabel: z.string().max(100), subjectLabel: z.string().max(100),
});
export const targetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('whiteboard') }),
  z.strictObject({ kind: z.literal('annotation'), sceneId: reference }),
]);
export const inkSchema = z.strictObject({
  id: uuid, kind: z.literal('ink'), tool: z.enum(['pen', 'eraser']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/), width: z.number().positive().max(512),
  points: z.array(z.number().finite().min(0).max(1200)).min(2).max(200000)
    .refine(points => points.length % 2 === 0, 'Coordinate pairs required'),
});
export const documentSchema = z.strictObject({
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
export const sessionSchema = z.strictObject({ id: uuid, context: contextSchema });
export const saveRequestSchema = z.strictObject({
  mutationId: uuid, baseServerRevision: z.number().int().nonnegative().max(2147483646), document: documentSchema,
});
export const acknowledgementSchema = z.strictObject({
  documentId: uuid, mutationId: uuid, serverRevision: z.number().int().positive(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/), durable: z.literal(true),
});
export const remoteDocumentSchema = z.strictObject({ document: documentSchema, serverRevision: z.number().int().positive() });
export const sessionResponseSchema = sessionSchema.extend({ documents: z.array(remoteDocumentSchema).max(100) });
export type SerializedDocument = z.infer<typeof documentSchema>;
export type SessionIdentity = z.infer<typeof sessionSchema>;
export type SaveRequest = z.infer<typeof saveRequestSchema>;
export type SaveAcknowledgement = z.infer<typeof acknowledgementSchema>;
