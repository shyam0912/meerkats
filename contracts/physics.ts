import { lessonVersionSchema, type Catalog } from './lesson.js';
import { CHEMISTRY } from './chemistry.js';

export const PHYSICS = { subject: '60000000-0000-4000-8000-000000000003', chapter: '60000000-0000-4000-8000-000000000004',
  topic: '60000000-0000-4000-8000-000000000005', lesson: '60000000-0000-4000-8000-000000000006',
  version: '60000000-0000-4000-8000-000000000007', activity: '61000000-0000-4000-8000-000000000001', scene: '62000000-0000-4000-8000-000000000001' } as const;
// Additive records: reuse the existing curriculum/class without republishing them.
export const physicsCatalog: Catalog = { nodes: [
  { id: PHYSICS.subject, parentId: CHEMISTRY.class, kind: 'subject', title: 'Physics · English Medium', order: 1 },
  { id: PHYSICS.chapter, parentId: PHYSICS.subject, kind: 'chapter', title: 'Chapter 2 · Lenses', order: 1 },
  { id: PHYSICS.topic, parentId: PHYSICS.chapter, kind: 'topic', title: 'Explore image formation', order: 0 },
], lessons: [{ id: PHYSICS.lesson, curriculumId: CHEMISTRY.curriculum, classLevelId: CHEMISTRY.class, subjectId: PHYSICS.subject,
  chapterId: PHYSICS.chapter, topicId: PHYSICS.topic, title: 'Lenses · Interactive exploration', order: 0, publishedVersionId: PHYSICS.version }] };
export const physicsVersion = lessonVersionSchema.parse({ id: PHYSICS.version, lessonId: PHYSICS.lesson, schemaVersion: 1,
  version: 1, title: 'Lenses', status: 'published', objectives: ['Explore how object distance and focal length affect image formation.', 'Compare convex and concave lenses.'],
  provenance: { sourceType: 'textbook-reference', sourceTitle: 'SCERT Kerala Physics Standard X, Part I, Chapter 2: Lenses',
    edition: 'First Edition, 2025', pages: ['27–40'], reviewStatus: 'teacher-review-pending',
    note: 'Original interactive thin-lens model and graphics. Prototype pending academic teacher review. No textbook artwork reproduced. Technical publication freezes this version; it does not imply academic approval.' },
  assetIds: [], activities: [{ id: PHYSICS.activity, sceneId: PHYSICS.scene, kind: 'thin-lens', title: 'Explore image formation',
    guidance: 'Drag the object. Change the lens. Follow the light.', annotationPolicy: 'ink', config: { model: 'ideal-thin-lens-v1' } }] });
