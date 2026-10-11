import type { Catalog, LessonDefinition, LessonVersion } from '../../../contracts/lesson';

// Presentation mappings to existing catalog identities. Planned choices are NOT
// catalog nodes, session context IDs, or claims of authored curriculum coverage.
export const pilotClassId = '50000000-0000-4000-8000-000000000002';
const internalCurriculumId = '40000000-0000-4000-8000-000000000001';
export type ContentState = 'Ready' | 'Preview' | 'Planned';
export function contentState(definition?: LessonDefinition, version?: LessonVersion): ContentState {
  if (!definition) return 'Planned';
  return version?.id === definition.publishedVersionId && version.lessonId === definition.id &&
    version.provenance.reviewStatus === 'reviewed' ? 'Ready' : 'Preview';
}
export function schoolCatalog(data: Catalog): Catalog {
  const hidden = new Set([internalCurriculumId]);
  // Parent order is not part of the API contract.
  for (let level = 0; level < 4; level++) for (const node of data.nodes) {
    if (node.parentId && hidden.has(node.parentId)) hidden.add(node.id);
  }
  return { nodes: data.nodes.filter(n => !hidden.has(n.id)), lessons: data.lessons.filter(l => !hidden.has(l.curriculumId)) };
}
export function standardChoices(data: Catalog) {
  return Array.from({ length: 10 }, (_, i) => {
    const number = i + 1;
    const node = number === 10 ? data.nodes.find(n => n.id === pilotClassId && n.kind === 'class') : undefined;
    return { number, node, label: `Standard ${number}`, path: node ? `/catalog?parent=${node.id}` : `/catalog?standard=${number}` };
  });
}
export function plannedStandard(value: string | null) {
  return value && /^(?:[1-9]|10)$/.test(value) ? Number(value) : null;
}
export function teacherLabel(node: Catalog['nodes'][number]) {
  if (node.id === pilotClassId) return 'Standard 10';
  if (node.kind === 'subject') return node.title.split(' · ')[0]!;
  return node.title;
}
export function compactContext(nodes: Catalog['nodes']) {
  return nodes.filter(n => n.kind !== 'curriculum').map(n => {
    if (n.kind === 'chapter') return /^(?:Unit|Chapter)\s+\d+/i.exec(n.title)?.[0] ?? n.title;
    return teacherLabel(n);
  }).join(' / ') || 'Classroom';
}
