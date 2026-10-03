import { eq } from 'drizzle-orm';
import { catalogSchema, lessonVersionSchema } from '../../../contracts/lesson.js';
import { bundledCatalog, bundledVersions } from '../../../contracts/catalog-content.js';
import type { Database } from '../db/connection.js';
import { catalogNodes, lessons, lessonVersions } from '../db/schema.js';
import { ApiError } from './sessions.js';

// Reference and demo catalog are shared read-only by active school members. No school-private content yet.
export function catalogService(db: Database) {
  return {
    async catalog() {
      const nodes = await db.select().from(catalogNodes).orderBy(catalogNodes.order, catalogNodes.id);
      const rows = await db.select().from(lessons);
      return catalogSchema.parse({ nodes, lessons: rows.map(r => r.definition).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)) });
    },
    async version(id: string) {
      const [row] = await db.select().from(lessonVersions).where(eq(lessonVersions.id, id));
      if (!row) throw new ApiError(404, 'lesson_version_not_found');
      return lessonVersionSchema.parse(row.definition);
    },
  };
}
export async function seedCatalog(db: Database) {
  // Validate fixtures before any insertion. Re-seeding cannot edit a published version.
  const catalog = catalogSchema.parse(bundledCatalog); const versions = bundledVersions.map(v => lessonVersionSchema.parse(v));
  await db.transaction(async tx => {
    for (const node of catalog.nodes) await tx.insert(catalogNodes).values(node).onConflictDoNothing();
    for (const definition of catalog.lessons) await tx.insert(lessons).values({ id: definition.id, topicId: definition.topicId, definition }).onConflictDoNothing();
    for (const version of versions) await tx.insert(lessonVersions).values({ id: version.id, lessonId: version.lessonId, version: version.version, definition: version }).onConflictDoNothing();
  });
}

/** Internal publication boundary, deliberately not exposed as a teacher authoring API. */
export async function publishVersion(db: Database, input: unknown) {
  const definition = lessonVersionSchema.parse(input);
  await db.insert(lessonVersions).values({ id: definition.id, lessonId: definition.lessonId, version: definition.version, definition });
  return definition;
}
