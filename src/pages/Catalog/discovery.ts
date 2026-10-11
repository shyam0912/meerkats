import type { Catalog } from '../../../contracts/lesson';

export const catalogPath = (id: string | null) => id ? `/catalog?parent=${encodeURIComponent(id)}` : '/catalog';
export function chapterLabel(title: string) {
  const match = /^(Unit|Chapter)\s+(\d+)\s*[·:–-]\s*(.+)$/i.exec(title);
  return match ? { number: `${match[1]} ${match[2]}`, title: match[3]! } : { number: null, title };
}
export function discovery(data: Catalog, id: string | null) {
  const parent = data.nodes.find(n => n.id === id && n.kind !== 'curriculum');
  const level = parent?.kind === 'class' ? 'subject' : parent?.kind === 'subject' ? 'chapter' : parent?.kind === 'chapter' ? 'concept' : parent?.kind === 'topic' ? 'lesson' : 'class';
  const ancestors: Catalog['nodes'] = [];
  let ancestor = data.nodes.find(n => n.id === parent?.parentId);
  while (ancestor && !ancestors.some(n => n.id === ancestor!.id)) {
    ancestors.unshift(ancestor); ancestor = data.nodes.find(n => n.id === ancestor?.parentId);
  }
  const nodes = data.nodes.filter(n => parent ? n.parentId === parent.id : n.kind === 'class').sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const lessons = data.lessons.filter(l => parent?.kind === 'topic' && l.topicId === parent.id).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const title = { class: 'Which class are you teaching?', subject: 'Choose a subject', chapter: 'Choose a chapter', concept: 'What shall we explore?', lesson: lessons.length ? 'Ready to teach' : 'Concept' }[level];
  const empty = { class: 'No classes available yet', subject: 'No subjects available yet', chapter: 'No chapters available yet', concept: 'No concepts available yet', lesson: 'Lesson not available yet' }[level];
  return { parent, ancestors, level, nodes, lessons, title, empty, invalid: id !== null && !parent };
}
