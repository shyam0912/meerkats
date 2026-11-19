import { lessonVersionSchema, type Catalog } from './lesson.js';
import { CHEMISTRY } from './chemistry-content.js';
export const PLANT = { class: '80000000-0000-4000-8000-000000000002', subject: '80000000-0000-4000-8000-000000000003',
  chapter: '80000000-0000-4000-8000-000000000004', topic: '80000000-0000-4000-8000-000000000005',
  lesson: '80000000-0000-4000-8000-000000000006', version: '80000000-0000-4000-8000-000000000007',
  activity: '81000000-0000-4000-8000-000000000001', scene: '82000000-0000-4000-8000-000000000001' } as const;
export const plantCatalog: Catalog = { nodes: [
  { id: PLANT.class, parentId: CHEMISTRY.curriculum, kind: 'class', title: 'Standard 2', order: 1 },
  { id: PLANT.subject, parentId: PLANT.class, kind: 'subject', title: 'Environmental Studies', order: 0 },
  { id: PLANT.chapter, parentId: PLANT.subject, kind: 'chapter', title: 'Original Demo Concepts', order: 0 },
  { id: PLANT.topic, parentId: PLANT.chapter, kind: 'topic', title: 'Build a Plant', order: 0 },
], lessons: [{ id: PLANT.lesson, curriculumId: CHEMISTRY.curriculum, classLevelId: PLANT.class, subjectId: PLANT.subject,
  chapterId: PLANT.chapter, topicId: PLANT.topic, title: 'Build a Plant', order: 0, publishedVersionId: PLANT.version }] };
export const plantVersion = lessonVersionSchema.parse({ id: PLANT.version, lessonId: PLANT.lesson, schemaVersion: 1,
  version: 1, title: 'Build a Plant', status: 'published',
  objectives: ['Identify roots, stem, leaves and flower and explore what they do.', 'Observe how roots take in water and leaves use light to make food.'],
  provenance: { sourceType: 'original-demo', sourceTitle: 'Original Meerkats Demo Concept', edition: null, pages: [],
    reviewStatus: 'teacher-review-pending', note: 'Original Demo Concept — Preview / Teacher Review Pending. Not an official SCERT chapter.' },
  assetIds: [], activities: [{ id: PLANT.activity, sceneId: PLANT.scene, kind: 'plant-builder', title: 'Build a Plant',
    guidance: 'Build, touch and explore a flowering plant.', annotationPolicy: 'ink', config: { model: 'flowering-plant-parts-v1',
      partIds: Array.from({ length: 5 }, (_, i) => `83000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`) } }] });
