import { lessonVersionSchema, type Catalog } from './lesson.js';
import { CHEMISTRY } from './chemistry-content.js';

export const COUNTING = { class: '70000000-0000-4000-8000-000000000002', subject: '70000000-0000-4000-8000-000000000003',
  chapter: '70000000-0000-4000-8000-000000000004', topic: '70000000-0000-4000-8000-000000000005',
  lesson: '70000000-0000-4000-8000-000000000006', version: '70000000-0000-4000-8000-000000000007',
  activity: '71000000-0000-4000-8000-000000000001', scene: '72000000-0000-4000-8000-000000000001' } as const;
export const countingCatalog: Catalog = { nodes: [
  { id: COUNTING.class, parentId: CHEMISTRY.curriculum, kind: 'class', title: 'Standard 1', order: 0 },
  { id: COUNTING.subject, parentId: COUNTING.class, kind: 'subject', title: 'Mathematics', order: 0 },
  { id: COUNTING.chapter, parentId: COUNTING.subject, kind: 'chapter', title: 'Original Demo Concepts', order: 0 },
  { id: COUNTING.topic, parentId: COUNTING.chapter, kind: 'topic', title: 'Same Number, Different Arrangements', order: 0 },
], lessons: [{ id: COUNTING.lesson, curriculumId: CHEMISTRY.curriculum, classLevelId: COUNTING.class, subjectId: COUNTING.subject,
  chapterId: COUNTING.chapter, topicId: COUNTING.topic, title: 'Same Number, Different Arrangements', order: 0, publishedVersionId: COUNTING.version }] };
export const countingVersion = lessonVersionSchema.parse({ id: COUNTING.version, lessonId: COUNTING.lesson, schemaVersion: 1,
  version: 1, title: 'Same Number, Different Arrangements', status: 'published',
  objectives: ['Notice that moving objects does not change how many there are.', 'Count each object once, in different arrangements.'],
  provenance: { sourceType: 'original-demo', sourceTitle: 'Original Meerkats Demo Concept', edition: null, pages: [],
    reviewStatus: 'teacher-review-pending', note: 'Original Demo Concept — Preview / Teacher Review Pending. Not an official SCERT chapter.' },
  assetIds: [], activities: [{ id: COUNTING.activity, sceneId: COUNTING.scene, kind: 'counting-board',
    title: 'Same Number, Different Arrangements', guidance: 'Move the counters. Is the number still the same?', annotationPolicy: 'ink',
    config: { model: 'quantity-conservation-v1', initialQuantity: 5,
      counterIds: Array.from({ length: 10 }, (_, i) => `73000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`) } }] });
