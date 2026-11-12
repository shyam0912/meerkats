import { expect, it } from 'vitest';
import { MAX_SNAPSHOT_BYTES, documentSchema, type TeachingShape, type TeachingText } from '../../contracts';
import { boardInkReducer, boardPayload, boardSurface, createWhiteboard, pageReducer } from './whiteboard';
import { duplicateObjects, enclosedObjects, moveObjects, MultiObjectInteraction, objectBounds, rectangle, type EditableObject } from './objectSelection';

const shape = (x = 200): Extract<TeachingShape, { shape: 'rectangle' }> => ({ id: crypto.randomUUID(), kind: 'shape', shape: 'rectangle', color: '#214f45', width: 4, origin: { x, y: 200 }, size: { width: 200, height: 100 }, rotation: 15 });
const text = (): TeachingText => ({ id: crypto.randomUUID(), kind: 'text', text: 'English മലയാളം\nക്ഷേത്രം!', font: 'noto-sans-malayalam', fontSize: 32, color: '#225eaf', origin: { x: 700, y: 200 }, size: { width: 250, height: 120 } });
function fixture() {
  let board = createWhiteboard({ sessionId: crypto.randomUUID(), classId: null, subjectId: null }, crypto.randomUUID());
  const id = board.document.activePageId;
  board = boardInkReducer(board, id, { type: 'commit-shape', shape: shape() });
  board = boardInkReducer(board, id, { type: 'commit-shape', shape: shape(450) });
  board = boardInkReducer(board, id, { type: 'commit-text', text: text() });
  const page = board.document.pages[0]!;
  return { board, id, objects: [...page.shapes!, ...page.texts!] };
}
it('marquee uses full visual bounds, handles reversed drags and never selects a partial text', () => {
  const s = shape(); const t = text(); const b = objectBounds(s);
  expect(enclosedObjects([s, t], b)).toEqual([s]);
  expect(enclosedObjects([s, t], { ...b, right: b.right - 1 })).toEqual([]);
  expect(enclosedObjects([t], rectangle({ x: 700, y: 200 }, { x: 949, y: 320 }))).toEqual([]);
  expect(enclosedObjects([s, t], rectangle({ x: 1200, y: 675 }, { x: 0, y: 0 }))).toEqual([s, t]);
});
it('moves mixed objects with one shared boundary delta, preserving rotation, Unicode and relative geometry', () => {
  const objects = [shape(), text()]; const moved = moveObjects(objects, { x: 1000, y: 1000 });
  expect(moved[0]).toEqual({ ...objects[0], origin: { x: 450, y: 548.8218041752946 } });
  expect(moved[1]).toEqual({ ...objects[1], origin: { x: 950, y: 548.8218041752946 } });
});
it('duplicates all five shape kinds and multilingual text without changing styles or spacing', () => {
  const style = { id: crypto.randomUUID(), kind: 'shape' as const, color: '#214f45', width: 4 };
  const objects: EditableObject[] = [shape(), { ...shape(), shape: 'triangle' },
    { ...style, shape: 'line', start: { x: 50, y: 50 }, end: { x: 120, y: 90 } },
    { ...style, id: crypto.randomUUID(), shape: 'arrow', start: { x: 50, y: 150 }, end: { x: 120, y: 190 } },
    { ...style, id: crypto.randomUUID(), shape: 'circle', center: { x: 500, y: 500 }, radius: 50 }, text()];
  const copies = duplicateObjects(objects);
  expect(new Set(copies.map(o => o.id)).size).toBe(6);
  expect(copies.map(o => ({ ...o, id: '' }))).toEqual(moveObjects(objects, { x: 24, y: 24 }).map(o => ({ ...o, id: '' })));
  expect(copies.every(o => !objects.some(source => source.id === o.id))).toBe(true);
});
it('reverses a shared duplicate offset near edges and keeps full-page selections in place', () => {
  const a = { ...text(), origin: { x: 950, y: 555 } }; const b = { ...shape(), rotation: 0, origin: { x: 100, y: 200 } };
  const copy = duplicateObjects([a, b]);
  expect(copy[0]).toMatchObject({ origin: { x: 926, y: 531 } });
  expect(copy[1]).toMatchObject({ origin: { x: 76, y: 176 } });
  const full = { ...text(), origin: { x: 0, y: 0 }, size: { width: 1200, height: 675 } };
  expect(duplicateObjects([full])[0]).toMatchObject({ origin: full.origin, size: full.size });
});
it.each(['move', 'duplicate', 'delete'] as const)('%s is one reversible page-local operation, with stable redo IDs', kind => {
  const { board, id, objects } = fixture(); const ids = objects.map(o => o.id);
  const other = pageReducer(board, { type: 'add', id: crypto.randomUUID() });
  const payload = kind === 'move' ? moveObjects(objects, { x: 30, y: 20 }) : kind === 'duplicate' ? duplicateObjects(objects) : undefined;
  const after = boardInkReducer(other, id, { type: 'batch', kind, ids, objects: payload });
  expect(after.document.schemaVersion).toBe(4); expect(documentSchema.safeParse(boardPayload(after.document)).success).toBe(true);
  expect(after.document.revision).toBe(other.document.revision + 1);
  expect(boardSurface(after, id).past.length).toBe(boardSurface(board, id).past.length + 1);
  expect(after.document.pages[1]).toBe(other.document.pages[1]);
  const undo = boardInkReducer(after, id, { type: 'undo' }); expect(undo.document.pages).toEqual(other.document.pages);
  expect(boardInkReducer(undo, id, { type: 'redo' }).document.pages).toEqual(after.document.pages);
});
it('restores interleaved deleted objects at their original stacking positions and discards a redo branch', () => {
  const { board, id, objects } = fixture();
  const deleted = boardInkReducer(board, id, { type: 'batch', kind: 'delete', ids: [objects[2]!.id, objects[0]!.id] });
  const undo = boardInkReducer(deleted, id, { type: 'undo' }); expect(undo.document.pages).toEqual(board.document.pages);
  const edited = boardInkReducer(undo, id, { type: 'batch', kind: 'move', ids: objects.map(o => o.id), objects: moveObjects(objects, { x: 3, y: 0 }) });
  expect(boardSurface(edited, id).future).toEqual([]);
  const cleared = boardInkReducer(edited, id, { type: 'clear' });
  expect(boardInkReducer(cleared, id, { type: 'undo' }).document.pages).toEqual(edited.document.pages);
});
it('rejects stale selection, duplicate IDs, invalid geometry, excessive selection and no-op edits atomically', () => {
  const { board, id, objects } = fixture(); const ids = objects.map(o => o.id);
  for (const action of [
    { type: 'batch' as const, kind: 'delete' as const, ids: [...ids, crypto.randomUUID()] },
    { type: 'batch' as const, kind: 'duplicate' as const, ids, objects },
    { type: 'batch' as const, kind: 'move' as const, ids, objects },
    { type: 'batch' as const, kind: 'move' as const, ids, objects: objects.map(o => ({ ...o, color: 'bad' })) },
    { type: 'batch' as const, kind: 'delete' as const, ids: Array.from({ length: 101 }, () => crypto.randomUUID()) },
  ]) expect(boardInkReducer(board, id, action)).toBe(board);
});
it.each(['bytes', 'count'])('rejects complete batch at %s capacity without changing history or document', limit => {
  const { board, id } = fixture(); const page = board.document.pages[0]!;
  const texts = Array.from({ length: 170 }, () => ({ ...text(), text: 'മ'.repeat(4096) }));
  const full = { ...board, document: { ...board.document, pages: [{ ...page, ...(limit === 'bytes' ? { texts } : { objects: Array.from({ length: 9997 }, () => ({ id: crypto.randomUUID(), kind: 'ink' as const, tool: 'pen' as const, points: [10, 10], color: '#000000', width: 3 })) }) }] } };
  const bytes = () => new TextEncoder().encode(JSON.stringify(boardPayload(full.document))).length;
  if (limit === 'bytes') while (bytes() > MAX_SNAPSHOT_BYTES) texts.pop();
  const objects = [full.document.pages[0]!.texts![0]!, page.shapes![0]!];
  const after = boardInkReducer(full, id, { type: 'batch', kind: 'duplicate', ids: objects.map(o => o.id), objects: duplicateObjects(objects) });
  expect(after.error).toContain('capacity'); expect(after.document).toBe(full.document); expect(after.histories).toBe(full.histories);
});
it('captures one gesture, ignores secondary pointers and discards cancelled movement and marquee', () => {
  const interaction = new MultiObjectInteraction(); const objects = [shape(), text()];
  expect(interaction.begin(1, { x: 10, y: 10 }, objects)).toBe(true);
  expect(interaction.begin(2, { x: 10, y: 10 }, objects)).toBe(false);
  interaction.move(2, { x: 200, y: 200 }); expect(interaction.draft).toBe(objects);
  interaction.move(1, { x: 20, y: 20 }); expect(interaction.draft).not.toEqual(objects);
  interaction.cancel(); expect(interaction.complete(1, { x: 40, y: 40 })).toBeNull();
  interaction.begin(1, { x: 0, y: 0 }, [], true); interaction.move(1, { x: 200, y: 200 });
  interaction.cancel(); expect(interaction.box).toBeNull(); expect(interaction.pointerId).toBeNull();
});
