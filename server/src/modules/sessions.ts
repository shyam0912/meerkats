import { and, eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { Config } from '../config/env.js';
import type { Database } from '../db/connection.js';
import { sessions, documents, receipts, memberships, lessonVersions, lessons, progressReceipts } from '../db/schema.js';
import type { SaveRequest, SessionIdentity } from '../../../contracts/index.js';
import { annotationKey, initialProgress, lessonVersionSchema, validProgress, type ProgressSave } from '../../../contracts/lesson.js';

export class ApiError extends Error {
  constructor(public statusCode: number, public code: string) { super(code); }
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export function sessionService(db: Database, identity: Config) {
  const schoolId = identity.DEV_SCHOOL_ID; const userId = identity.DEV_USER_ID;
  const owned = (id: string) => and(eq(sessions.id, id), eq(sessions.schoolId, schoolId), eq(sessions.userId, userId));
  async function authorize() {
    const [membership] = await db.select().from(memberships).where(and(eq(memberships.schoolId, schoolId), eq(memberships.userId, userId), eq(memberships.active, 1)));
    if (!membership || !['teacher', 'school_admin'].includes(membership.role)) throw new ApiError(403, 'access_denied');
  }
  return {
    authorize,
    async create(input: SessionIdentity) {
      let progress;
      if (input.lessonVersionId) {
        const [row] = await db.select().from(lessonVersions).where(eq(lessonVersions.id, input.lessonVersionId));
        if (!row) throw new ApiError(404, 'lesson_version_not_found');
        const version = lessonVersionSchema.parse(row.definition);
        const [lesson] = await db.select().from(lessons).where(eq(lessons.id, version.lessonId));
        if (!lesson || input.context.classId !== lesson.definition.classLevelId || input.context.subjectId !== lesson.definition.subjectId)
          throw new ApiError(400, 'lesson_context_mismatch');
        progress = initialProgress(version);
      }
      await db.insert(sessions).values({ ...input, schoolId, userId, progress }).onConflictDoNothing();
      const [existing] = await db.select().from(sessions).where(owned(input.id));
      if (!existing) throw new ApiError(404, 'session_not_found');
      if (hash(existing.context) !== hash(input.context)) throw new ApiError(409, 'session_context_conflict');
      if ((existing.lessonVersionId ?? undefined) !== input.lessonVersionId) throw new ApiError(409, 'immutable_lesson_pin');
      return { id: existing.id, context: existing.context, ...(existing.lessonVersionId ? { lessonVersionId: existing.lessonVersionId } : {}) };
    },
    async get(id: string) {
      const [session] = await db.select().from(sessions).where(owned(id));
      if (!session) throw new ApiError(404, 'session_not_found');
      const rows = await db.select().from(documents).where(and(eq(documents.sessionId, id), eq(documents.schoolId, schoolId)));
      return { id, context: session.context, ...(session.lessonVersionId ? { lessonVersionId: session.lessonVersionId,
        progress: session.progress, progressServerRevision: session.progressServerRevision } : {}),
        documents: rows.map(row => ({ document: row.snapshot, serverRevision: row.serverRevision })) };
    },
    async progress(sessionId: string, input: ProgressSave) {
      return db.transaction(async tx => {
        const [session] = await tx.select().from(sessions).where(owned(sessionId)).for('update');
        if (!session) throw new ApiError(404, 'session_not_found');
        if (session.lessonVersionId !== input.progress.lessonVersionId) throw new ApiError(400, 'lesson_pin_mismatch');
        const [row] = await tx.select().from(lessonVersions).where(eq(lessonVersions.id, input.progress.lessonVersionId));
        if (!row || !validProgress(lessonVersionSchema.parse(row.definition), input.progress)) throw new ApiError(400, 'invalid_activity_progress');
        const requestHash = hash(input);
        const [receipt] = await tx.select().from(progressReceipts).where(and(eq(progressReceipts.sessionId, sessionId), eq(progressReceipts.mutationId, input.mutationId)));
        if (receipt) {
          if (receipt.requestHash !== requestHash) throw new ApiError(409, 'mutation_reused');
          return { mutationId: input.mutationId, serverRevision: receipt.serverRevision, durable: true as const };
        }
        if (session.progressServerRevision !== input.baseServerRevision) throw new ApiError(409, 'stale_revision');
        const serverRevision = session.progressServerRevision + 1;
        await tx.update(sessions).set({ progress: input.progress, progressServerRevision: serverRevision }).where(owned(sessionId));
        await tx.insert(progressReceipts).values({ sessionId, mutationId: input.mutationId, requestHash, serverRevision });
        return { mutationId: input.mutationId, serverRevision, durable: true as const };
      });
    },
    async save(sessionId: string, documentId: string, input: SaveRequest) {
      const doc = input.document;
      if (doc.id !== documentId || doc.owner.sessionId !== sessionId) throw new ApiError(400, 'ownership_mismatch');
      return db.transaction(async tx => {
        // Lock the owned session, including first saves: two concurrent inserts cannot bypass revision checks.
        const [session] = await tx.select().from(sessions).where(owned(sessionId)).for('update');
        if (!session) throw new ApiError(404, 'session_not_found');
        if (doc.owner.classId !== session.context.classId || doc.owner.subjectId !== session.context.subjectId)
          throw new ApiError(400, 'context_mismatch');
        const [existing] = await tx.select().from(documents).where(eq(documents.id, documentId));
        if (existing && (existing.sessionId !== sessionId || existing.schoolId !== schoolId)) throw new ApiError(404, 'document_not_found');
        const requestHash = hash(input); const contentHash = hash(doc);
        const [receipt] = await tx.select().from(receipts).where(and(eq(receipts.documentId, documentId), eq(receipts.mutationId, input.mutationId)));
        if (receipt) {
          if (receipt.requestHash !== requestHash) throw new ApiError(409, 'mutation_reused');
          return { documentId, mutationId: input.mutationId, serverRevision: receipt.serverRevision, contentHash: receipt.contentHash, durable: true as const };
        }
        if ((existing?.serverRevision ?? 0) !== input.baseServerRevision) throw new ApiError(409, 'stale_revision');
        if (doc.owner.target.kind === 'annotation' && session.lessonVersionId) {
          const [row] = await tx.select().from(lessonVersions).where(eq(lessonVersions.id, session.lessonVersionId));
          const target = doc.owner.target;
          if (target.lessonVersionId !== session.lessonVersionId || !row?.definition.activities.some(a => a.id === target.activityId && a.sceneId === target.sceneId))
            throw new ApiError(400, 'annotation_anchor_mismatch');
        } else if (doc.owner.target.kind === 'annotation' && doc.owner.target.lessonVersionId) throw new ApiError(400, 'annotation_anchor_mismatch');
        const anchor = doc.owner.target.kind === 'whiteboard' ? 'whiteboard' : `annotation:${annotationKey(doc.owner.target)}`;
        if (existing && existing.anchor !== anchor) throw new ApiError(409, 'immutable_anchor');
        const [anchorOwner] = await tx.select().from(documents).where(and(eq(documents.sessionId, sessionId), eq(documents.anchor, anchor)));
        if (anchorOwner && anchorOwner.id !== documentId) throw new ApiError(409, 'anchor_conflict');
        if (!existing) {
          const sessionDocuments = await tx.select({ id: documents.id }).from(documents).where(eq(documents.sessionId, sessionId));
          if (sessionDocuments.length >= 16) throw new ApiError(422, 'session_document_limit');
        }
        const serverRevision = input.baseServerRevision + 1;
        if (existing) {
          await tx.update(documents).set({ serverRevision, snapshot: doc, contentHash, updatedAt: new Date() })
            .where(and(eq(documents.id, documentId), eq(documents.sessionId, sessionId), eq(documents.schoolId, schoolId)));
        } else {
          // A different session has a different lock. A concurrent UUID claim must never
          // turn an insert into an update of that other session's document.
          const inserted = await tx.insert(documents).values({ id: documentId, sessionId, schoolId, anchor, serverRevision, snapshot: doc, contentHash })
            .onConflictDoNothing({ target: documents.id }).returning({ id: documents.id });
          if (!inserted.length) throw new ApiError(409, 'document_id_conflict');
        }
        await tx.insert(receipts).values({ documentId, mutationId: input.mutationId, requestHash, contentHash, serverRevision });
        return { documentId, mutationId: input.mutationId, serverRevision, contentHash, durable: true as const };
      });
    },
  };
}
