import { z } from 'zod';
import { documentSchema, sessionSchema, type SerializedDocument } from '../../contracts';
import type { DrawingDocument, DocumentState } from '../drawing/document';
import type { DrawingSession } from '../drawing/session';
import { DEMO_SCENE_ID } from '../drawing/scene';

export const snapshotSchema = z.strictObject({
  schemaVersion: z.literal(1), identity: sessionSchema,
  mode: z.enum(['whiteboard', 'explore', 'annotate']),
  selection: z.enum(['circle', 'triangle', 'square']).nullable(),
  whiteboard: documentSchema,
  annotations: z.record(z.string(), documentSchema),
}).superRefine((snapshot, ctx) => {
  const docs = [snapshot.whiteboard, ...Object.values(snapshot.annotations)];
  if (docs.some(d => d.owner.sessionId !== snapshot.identity.id || d.owner.classId !== snapshot.identity.context.classId || d.owner.subjectId !== snapshot.identity.context.subjectId) ||
      new Set(docs.map(d => d.id)).size !== docs.length || snapshot.whiteboard.owner.target.kind !== 'whiteboard' ||
      Object.entries(snapshot.annotations).some(([key, d]) => d.owner.target.kind !== 'annotation' || d.owner.target.sceneId !== key) ||
      !snapshot.annotations[DEMO_SCENE_ID] || Object.keys(snapshot.annotations).length !== 1)
    ctx.addIssue({ code: 'custom', message: 'Invalid session document ownership or scene' });
});
export type SessionSnapshot = z.infer<typeof snapshotSchema>;
export function serializeDocument(document: DrawingDocument): SerializedDocument {
  const { revision, ...rest } = document;
  return documentSchema.parse({ ...rest, localRevision: revision });
}
export function deserializeDocument(value: unknown): DocumentState {
  const { localRevision, ...document } = documentSchema.parse(value);
  return { document: { ...document, revision: localRevision }, past: [], future: [] };
}
export function serializeSession(session: DrawingSession, identity: SessionSnapshot['identity'], selection: SessionSnapshot['selection']): SessionSnapshot {
  return snapshotSchema.parse({ schemaVersion: 1, identity, selection, mode: session.mode,
    whiteboard: serializeDocument(session.whiteboard.document),
    annotations: Object.fromEntries(Object.entries(session.annotations).map(([key, state]) => [key, serializeDocument(state.document)])),
  });
}
export function deserializeSession(value: unknown): DrawingSession {
  const snapshot = snapshotSchema.parse(value);
  return { mode: snapshot.mode, whiteboard: deserializeDocument(snapshot.whiteboard),
    annotations: Object.fromEntries(Object.entries(snapshot.annotations).map(([key, document]) => [key, deserializeDocument(document)])),
  };
}
