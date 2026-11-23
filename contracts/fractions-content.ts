import { lessonVersionSchema, type Catalog } from './lesson.js';
import { CHEMISTRY } from './chemistry-content.js';

// Original development preview. Deliberately absent from the public demo catalog.
export const FRACTIONS = {
  class: '90000000-0000-4000-8000-000000000002', subject: '90000000-0000-4000-8000-000000000003',
  chapter: '90000000-0000-4000-8000-000000000004', topic: '90000000-0000-4000-8000-000000000005',
  lesson: '90000000-0000-4000-8000-000000000006', version: '90000000-0000-4000-8000-000000000007',
  activity: '91000000-0000-4000-8000-000000000001', scene: '92000000-0000-4000-8000-000000000001',
} as const;
export const fractionsCatalog: Catalog = { nodes: [
  { id: FRACTIONS.class, parentId: CHEMISTRY.curriculum, kind: 'class', title: 'Standard 3', order: 2 },
  { id: FRACTIONS.subject, parentId: FRACTIONS.class, kind: 'subject', title: 'Mathematics', order: 0 },
  { id: FRACTIONS.chapter, parentId: FRACTIONS.subject, kind: 'chapter', title: 'Original Demo Concepts', order: 0 },
  { id: FRACTIONS.topic, parentId: FRACTIONS.chapter, kind: 'topic', title: 'Interactive Fractions', order: 0 },
], lessons: [{ id: FRACTIONS.lesson, curriculumId: CHEMISTRY.curriculum, classLevelId: FRACTIONS.class,
  subjectId: FRACTIONS.subject, chapterId: FRACTIONS.chapter, topicId: FRACTIONS.topic,
  title: 'Interactive Fractions', order: 0, publishedVersionId: FRACTIONS.version }] };
export const fractionsVersion = lessonVersionSchema.parse({
  id: FRACTIONS.version, lessonId: FRACTIONS.lesson, schemaVersion: 1, version: 1,
  title: 'Interactive Fractions', status: 'published',
  objectives: ['Recognise halves and quarters as equal parts of a common whole.',
    'Combine, separate and compare pieces without changing their size.'],
  provenance: { sourceType: 'original-demo', sourceTitle: 'Original Meerkats Demo Concept', edition: null, pages: [],
    reviewStatus: 'teacher-review-pending',
    note: 'Original Demo Concept — Preview / Teacher Review Pending. Curriculum verification pending; not an official SCERT chapter.' },
  assetIds: [], activities: [{ id: FRACTIONS.activity, sceneId: FRACTIONS.scene, kind: 'fraction-board',
    title: 'Interactive Fractions', guidance: 'Explore halves and quarters of the same-sized whole.', annotationPolicy: 'ink',
    config: { model: 'equal-parts-bars-v1', pieceIds: Array.from({ length: 6 }, (_, i) => `93000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`) } }],
});
