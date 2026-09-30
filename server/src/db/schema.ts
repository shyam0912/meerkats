import { pgTable, uuid, text, integer, jsonb, timestamp, primaryKey, unique, foreignKey, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { SerializedDocument, SessionIdentity } from '../../../contracts/index.js';
import type { LessonVersion, LessonProgress, LessonDefinition, Catalog } from '../../../contracts/lesson.js';
export const catalogNodes = pgTable('catalog_nodes', { id: uuid().primaryKey(), parentId: uuid('parent_id'),
  kind: text().$type<Catalog['nodes'][number]['kind']>().notNull(), title: text().notNull(), order: integer().notNull() },
  t => [foreignKey({ columns: [t.parentId], foreignColumns: [t.id] })]);
export const lessons = pgTable('lessons', { id: uuid().primaryKey(), topicId: uuid('topic_id').notNull().references(() => catalogNodes.id),
  definition: jsonb().$type<LessonDefinition>().notNull() });
export const lessonVersions = pgTable('lesson_versions', { id: uuid().primaryKey(), lessonId: uuid('lesson_id').notNull().references(() => lessons.id),
  version: integer().notNull(), definition: jsonb().$type<LessonVersion>().notNull() }, t => [unique().on(t.lessonId, t.version)]);
export const schools = pgTable('schools', { id: uuid().primaryKey(), name: text().notNull() });
export const users = pgTable('users', {
  id: uuid().primaryKey(), issuer: text().notNull(), subject: text().notNull(),
}, t => [unique().on(t.issuer, t.subject)]);
export const memberships = pgTable('school_memberships', {
  schoolId: uuid('school_id').notNull().references(() => schools.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: text().notNull(), active: integer().notNull().default(1),
}, t => [primaryKey({ columns: [t.schoolId, t.userId] }), check('membership_role', sql`${t.role} in ('teacher', 'school_admin')`), check('membership_active', sql`${t.active} in (0, 1)`)]);
export const sessions = pgTable('teaching_sessions', {
  id: uuid().primaryKey(), schoolId: uuid('school_id').notNull(), userId: uuid('user_id').notNull(),
  context: jsonb().$type<SessionIdentity['context']>().notNull(),
  lessonVersionId: uuid('lesson_version_id').references(() => lessonVersions.id),
  progress: jsonb().$type<LessonProgress>(), progressServerRevision: integer('progress_server_revision').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [unique().on(t.id, t.schoolId), foreignKey({ columns: [t.schoolId, t.userId], foreignColumns: [memberships.schoolId, memberships.userId] })]);
export const documents = pgTable('documents', {
  id: uuid().primaryKey(), sessionId: uuid('session_id').notNull(), schoolId: uuid('school_id').notNull(),
  anchor: text().notNull(), serverRevision: integer('server_revision').notNull(),
  snapshot: jsonb().$type<SerializedDocument>().notNull(), contentHash: text('content_hash').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [foreignKey({ columns: [t.sessionId, t.schoolId], foreignColumns: [sessions.id, sessions.schoolId] }),
  unique().on(t.sessionId, t.anchor), check('positive_revision', sql`${t.serverRevision} > 0`)]);
export const receipts = pgTable('save_receipts', {
  documentId: uuid('document_id').notNull().references(() => documents.id),
  mutationId: uuid('mutation_id').notNull(), requestHash: text('request_hash').notNull(),
  contentHash: text('content_hash').notNull(), serverRevision: integer('server_revision').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.documentId, t.mutationId] })]);
export const progressReceipts = pgTable('progress_receipts', {
  sessionId: uuid('session_id').notNull().references(() => sessions.id), mutationId: uuid('mutation_id').notNull(),
  requestHash: text('request_hash').notNull(), serverRevision: integer('server_revision').notNull(),
}, t => [primaryKey({ columns: [t.sessionId, t.mutationId] })]);
