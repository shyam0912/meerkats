import { catalogSchema, lessonVersionSchema } from './lesson.js';
import { moleculeSchema } from './molecule.js';

export const CHEMISTRY = {
  curriculum: '50000000-0000-4000-8000-000000000001', class: '50000000-0000-4000-8000-000000000002',
  subject: '50000000-0000-4000-8000-000000000003', chapter: '50000000-0000-4000-8000-000000000004',
  topic: '50000000-0000-4000-8000-000000000005', lesson: '50000000-0000-4000-8000-000000000006',
  version: '50000000-0000-4000-8000-000000000007',
} as const;
const atoms = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, element: 'C' as const }));
const bond = (id: string, from: string, to: string) => ({ id, from, to, order: 1 as const });
export const pentane = moleculeSchema.parse({ id: 'pentane', atoms,
  bonds: [bond('ab', 'a', 'b'), bond('bc', 'b', 'c'), bond('cd', 'c', 'd'), bond('de', 'd', 'e')],
  layout: { a: { x: .1, y: .5 }, b: { x: .3, y: .5 }, c: { x: .5, y: .5 }, d: { x: .7, y: .5 }, e: { x: .9, y: .5 } },
  parentChain: ['a', 'b', 'c', 'd', 'e'], branchAtomId: null, candidates: [],
});
export const methylbutane = moleculeSchema.parse({ id: 'methylbutane', atoms,
  bonds: [bond('ab', 'a', 'b'), bond('bc', 'b', 'c'), bond('cd', 'c', 'd'), bond('be', 'b', 'e')],
  layout: { a: { x: .14, y: .33 }, b: { x: .38, y: .33 }, c: { x: .62, y: .33 }, d: { x: .86, y: .33 }, e: { x: .38, y: .84 } },
  parentChain: ['a', 'b', 'c', 'd'], branchAtomId: 'e', candidates: [
    { id: 'short', label: 'Path A', atoms: ['a', 'b', 'e'] },
    { id: 'across', label: 'Path B', atoms: ['a', 'b', 'c', 'd'] },
    { id: 'turn', label: 'Path C', atoms: ['e', 'b', 'c', 'd'] },
  ],
});
export const chemistryCatalog = catalogSchema.parse({ nodes: [
  { id: CHEMISTRY.curriculum, parentId: null, kind: 'curriculum', title: 'Kerala SCERT · 2025', order: 1 },
  { id: CHEMISTRY.class, parentId: CHEMISTRY.curriculum, kind: 'class', title: 'Standard X', order: 1 },
  { id: CHEMISTRY.subject, parentId: CHEMISTRY.class, kind: 'subject', title: 'Chemistry · English Medium', order: 0 },
  { id: CHEMISTRY.chapter, parentId: CHEMISTRY.subject, kind: 'chapter', title: 'Unit 1 · Nomenclature of Organic Compounds and Isomerism', order: 0 },
  { id: CHEMISTRY.topic, parentId: CHEMISTRY.chapter, kind: 'topic', title: 'One branch. Two structures.', order: 0 },
], lessons: [{ id: CHEMISTRY.lesson, curriculumId: CHEMISTRY.curriculum, classLevelId: CHEMISTRY.class, subjectId: CHEMISTRY.subject,
  chapterId: CHEMISTRY.chapter, topicId: CHEMISTRY.topic, title: 'From carbon chains to isomers',
  description: 'Original interactive reference lesson · Academic teacher review pending', order: 0, publishedVersionId: CHEMISTRY.version }] });
const steps = [
  { stage: 'discover', title: 'Discover the carbon chain', guidance: 'Reveal a carbon at a time. Invite the class to count the chain.', structures: [pentane] },
  { stage: 'chain', title: 'Find the longest chain', guidance: 'Compare the three paths before revealing the parent chain.', structures: [methylbutane] },
  { stage: 'numbering', title: 'Number from the correct end', guidance: 'Try both directions. Which gives the branch the lower number?', structures: [methylbutane] },
  { stage: 'branch', title: 'Identify the branch', guidance: 'Separate the main chain from the one-carbon branch.', structures: [methylbutane] },
  { stage: 'name', title: 'Build the IUPAC name', guidance: 'Touch each name part to connect language with structure.', structures: [methylbutane] },
  { stage: 'rearrange', title: 'Rearrange the same atoms', guidance: 'Switch between two structures. What changes? What stays the same?', structures: [pentane, methylbutane] },
  { stage: 'isomers', title: 'Discover chain isomerism', guidance: 'Compare the formula and the carbon connections, then name the relationship.', structures: [pentane, methylbutane] },
] as const;
// Publication IDs are assigned once; sequence positions are not runtime/document identity.
const activityIds = ['51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000003',
  '51000000-0000-4000-8000-000000000004', '51000000-0000-4000-8000-000000000005', '51000000-0000-4000-8000-000000000006', '51000000-0000-4000-8000-000000000007'];
const sceneIds = ['52000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000003',
  '52000000-0000-4000-8000-000000000004', '52000000-0000-4000-8000-000000000005', '52000000-0000-4000-8000-000000000006', '52000000-0000-4000-8000-000000000007'];
export const chemistryVersion = lessonVersionSchema.parse({ id: CHEMISTRY.version, lessonId: CHEMISTRY.lesson, schemaVersion: 1,
  version: 1, title: 'From carbon chains to isomers', status: 'published',
  objectives: ['Compare continuous carbon chains.', 'Name an alkane with one methyl branch.', 'Relate different carbon connections to chain isomerism.'],
  provenance: { sourceType: 'textbook-reference', sourceTitle: 'SCERT Kerala Chemistry Standard X, Part I, English Medium',
    edition: 'First Edition, 2025', pages: ['7–10', '25–26'], reviewStatus: 'teacher-review-pending',
    note: 'Owner-supplied 10_Chemistry Eng.pdf. Original Meerkats graphics and interactions; no textbook artwork reproduced. Source mapped in docs/phase-5-source.md. Academic teacher review pending; publication freezes this technical version, not academic approval.' },
  assetIds: [], activities: steps.map((step, i) => ({ id: activityIds[i], sceneId: sceneIds[i], kind: 'molecule-builder',
    title: step.title, guidance: step.guidance, annotationPolicy: 'ink', config: { stage: step.stage, structures: step.structures } })),
});
