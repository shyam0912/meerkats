import { expect, it } from 'vitest';
import { MAX_SNAPSHOT_BYTES, teachingShapeSchema, teachingTextSchema, type TeachingShape, type TeachingText } from '../../contracts';
import { boardInkReducer, boardPayload, createWhiteboard } from './whiteboard';
import { duplicateObject } from './duplicateObject';

const text: TeachingText = { id: crypto.randomUUID(), kind: 'text', font: 'noto-sans-malayalam',
  color: '#225eaf', fontSize: 32, text: 'English മലയാളം\nക്ഷേത്രം!', origin: { x: 1000, y: 600 }, size: { width: 200, height: 75 } };
const style = { id: crypto.randomUUID(), kind: 'shape' as const, color: '#214f45', width: 8 };
const shapes: TeachingShape[] = [
  ...(['line', 'arrow'] as const).map(shape => ({ ...style, shape, start: { x: 1199, y: 674 }, end: { x: 1199, y: 620 } })),
  { ...style, shape: 'circle', center: { x: 1100, y: 575 }, radius: 100 },
  ...(['rectangle', 'triangle'] as const).map(shape => ({ ...style, shape, origin: { x: 1, y: 300 }, size: { width: 1198, height: 50 }, rotation: 15 })),
];

it.each(shapes)('duplicates $shape within page bounds with its exact geometry and style', original => {
  const id = crypto.randomUUID(); const copy = duplicateObject(original, id);
  expect(teachingShapeSchema.parse(copy)).toMatchObject({ id, shape: original.shape, width: 8, color: style.color });
  if (original.shape === 'line' || original.shape === 'arrow') {
    expect(copy).toEqual({ ...original, id, start: { x: 1175, y: 650 }, end: { x: 1175, y: 596 } });
  } else if (original.shape === 'circle') {
    expect(copy).toEqual({ ...original, id, center: { x: 1076, y: 551 } });
  } else {
    expect(copy).toMatchObject({ rotation: 15, size: original.size });
    expect(copy).not.toMatchObject({ origin: original.origin });
  }
});

it('keeps full-page objects in place and flips a boundary text copy inward without remeasuring Unicode', () => {
  const id = crypto.randomUUID();
  expect(teachingTextSchema.parse(duplicateObject(text, id))).toEqual({ ...text, id, origin: { x: 976, y: 576 } });
  const full = { ...text, origin: { x: 0, y: 0 }, size: { width: 1200, height: 675 } };
  expect(duplicateObject(full, id)).toEqual({ ...full, id });
});

it.each(['object count', 'serialized bytes'])('rejects a copy at the %s limit without changing the page, revision or history', limit => {
  const board = createWhiteboard({ sessionId: crypto.randomUUID(), classId: null, subjectId: null }, crypto.randomUUID());
  const id = board.document.activePageId;
  const saved = boardInkReducer(board, id, { type: 'commit-text', text });
  const page = saved.document.pages[0]!;
  const many = Array.from({ length: limit === 'object count' ? 9999 : 170 }, () => ({
    ...text, id: crypto.randomUUID(), text: limit === 'object count' ? 'a' : 'മ'.repeat(4096),
  }));
  // Use small legal ink dots for the count test so that the byte limit is independent.
  const dots = many.map(t => ({ id: t.id, kind: 'ink' as const, tool: 'pen' as const, points: [10, 10], color: '#000000', width: 3 }));
  const fullPage = limit === 'object count' ? { ...page, objects: dots } : { ...page, texts: many };
  const full = { ...saved, document: { ...saved.document, pages: [fullPage] } };
  const size = () => new TextEncoder().encode(JSON.stringify(boardPayload(full.document))).length;
  if (limit === 'serialized bytes') while (size() > MAX_SNAPSHOT_BYTES) many.pop();
  expect(size()).toBeLessThanOrEqual(MAX_SNAPSHOT_BYTES);
  const copy = duplicateObject(fullPage.texts![0]!, crypto.randomUUID());
  if (copy.kind !== 'text') throw new Error('Expected text');
  const rejected = boardInkReducer(full, id, { type: 'commit-text', text: copy });
  expect(rejected.error).toContain('capacity'); expect(rejected.document).toBe(full.document); expect(rejected.histories).toBe(full.histories);
});
