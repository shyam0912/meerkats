import { catalogSchema, lessonVersionSchema } from './lesson.js';

// Assigned once. Labels, ordering and later publication versions never generate identity.
export const DEMO = {
  curriculum: '40000000-0000-4000-8000-000000000001', class: '40000000-0000-4000-8000-000000000002',
  subject: '40000000-0000-4000-8000-000000000003', chapter: '40000000-0000-4000-8000-000000000004',
  topic: '40000000-0000-4000-8000-000000000005', lesson: '40000000-0000-4000-8000-000000000006',
  version: '40000000-0000-4000-8000-000000000007',
} as const;
export const demoCatalog = catalogSchema.parse({ nodes: [
  { id: DEMO.curriculum, parentId: null, kind: 'curriculum', title: 'Meerkats demonstration', order: 0 },
  { id: DEMO.class, parentId: DEMO.curriculum, kind: 'class', title: 'Demo class', order: 0 },
  { id: DEMO.subject, parentId: DEMO.class, kind: 'subject', title: 'Visual exploration', order: 0 },
  { id: DEMO.chapter, parentId: DEMO.subject, kind: 'chapter', title: 'Observe and describe', order: 0 },
  { id: DEMO.topic, parentId: DEMO.chapter, kind: 'topic', title: 'Shapes and patterns', order: 0 },
], lessons: [{ id: DEMO.lesson, curriculumId: DEMO.curriculum, classLevelId: DEMO.class, subjectId: DEMO.subject,
  chapterId: DEMO.chapter, topicId: DEMO.topic, title: 'A closer look at shapes', order: 0, publishedVersionId: DEMO.version }] });
const items = [
  { id: '41000000-0000-4000-8000-000000000001', label: 'Circle', shape: 'circle', color: '#087f8c', description: 'One continuous curved edge.' },
  { id: '41000000-0000-4000-8000-000000000002', label: 'Triangle', shape: 'triangle', color: '#bb6628', description: 'Three sides. Three corners.' },
  { id: '41000000-0000-4000-8000-000000000003', label: 'Square', shape: 'square', color: '#6757a5', description: 'Four equal sides. Four corners.' },
];
export const demoVersion = lessonVersionSchema.parse({ id: DEMO.version, lessonId: DEMO.lesson, schemaVersion: 1,
  version: 1, title: 'A closer look at shapes', status: 'published', objectives: ['Observe a visual.', 'Explore differences.', 'Describe a sequence.'],
  provenance: { sourceType: 'original-demo', sourceTitle: 'Meerkats original engineering fixture', edition: null,
    pages: [], reviewStatus: 'engineering-demo', note: 'Architecture demonstration; not curriculum or textbook content.' }, assetIds: [],
  activities: [
    { id: '42000000-0000-4000-8000-000000000001', sceneId: '43000000-0000-4000-8000-000000000001', kind: 'explain', title: 'Look together',
      annotationPolicy: 'ink', guidance: 'Describe what you notice. Add ink to point out a feature.', config: { items } },
    { id: '42000000-0000-4000-8000-000000000002', sceneId: '43000000-0000-4000-8000-000000000002', kind: 'explore', title: 'Shape studio',
      annotationPolicy: 'ink', guidance: 'Touch a shape to explore its description.', config: { items }, initialState: { selectedId: null } },
    { id: '42000000-0000-4000-8000-000000000003', sceneId: '43000000-0000-4000-8000-000000000003', kind: 'reveal', title: 'Build an observation',
      annotationPolicy: 'ink', guidance: 'Reveal one prompt at a time. Invite a spoken response.', config: { items: [
        { id: '44000000-0000-4000-8000-000000000001', text: 'Choose a shape.' },
        { id: '44000000-0000-4000-8000-000000000002', text: 'Describe an edge or a corner.' },
        { id: '44000000-0000-4000-8000-000000000003', text: 'Compare it with another shape.' },
      ] }, initialState: { revealed: 0 } },
  ],
});
