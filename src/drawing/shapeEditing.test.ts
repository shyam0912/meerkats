import { describe, expect, it } from 'vitest';
import { teachingShapeSchema, type TeachingShapeType } from '../../contracts';
import { createShape, shapePath } from './teachingShapes';
import { hitShape, pickShape, resizeShape, rotateShape, selectionCorners, ShapeEditInteraction, shapeFrame, shapeHandles, translateShape } from './shapeEditing';
import { boardInkReducer, boardSurface, createWhiteboard, pageReducer } from './whiteboard';
import { capacityRecord } from '../../tests/helpers/capacity';
import { deserializeSession } from '../persistence/serialization';

const id = () => crypto.randomUUID();
const shape = (kind: TeachingShapeType = 'rectangle') => createShape(id(), { shape: kind, color: '#225eaf', width: 8 }, { x: 200, y: 200 }, { x: 400, y: 400 })!;
const board = () => createWhiteboard({ sessionId: id(), classId: null, subjectId: null }, id());
describe('shape selection geometry', () => {
  it.each(['line', 'arrow', 'rectangle', 'circle', 'triangle'] as const)('hits %s accurately and preserves identity/style through transformations', kind => {
    const original = shape(kind); const moved = translateShape(original, { x: 100, y: 0 })!;
    expect(hitShape(original, { x: 300, y: 300 }, 0)).toBe(true);
    expect(hitShape(original, { x: 100, y: 100 }, 10)).toBe(false);
    expect(moved).toMatchObject({ id: original.id, color: original.color, width: original.width, shape: kind });
    expect(shapeFrame(moved).center).toEqual({ x: 400, y: 300 });
    const rotated = rotateShape(moved, Math.PI / 4)!;
    expect(teachingShapeSchema.safeParse(rotated).success).toBe(true);
    expect(shapeFrame(rotated).center.x).toBeCloseTo(400);
    expect(shapePath(rotated)).not.toMatch(/NaN|undefined/);
  });
  it('distinguishes triangle corners, line distances and arrowheads, and picks the topmost hit', () => {
    const triangle = shape('triangle');
    expect(hitShape(triangle, { x: 205, y: 205 }, 0)).toBe(false);
    const line = shape('line'); expect(hitShape(line, { x: 350, y: 220 }, 12)).toBe(false);
    const arrow = createShape(id(), { shape: 'arrow', color: '#000000', width: 8 }, { x: 100, y: 100 }, { x: 300, y: 100 })!;
    expect(hitShape(arrow, { x: 276, y: 112 }, 0)).toBe(true);
    const a = shape(); const b = shape(); expect(pickShape([a, b], { x: 300, y: 300 }, 0)?.id).toBe(b.id);
    expect(pickShape([a, b], { x: 0, y: 0 }, 12)).toBeUndefined();
  });
  it('uses rotated rather than axis-aligned hit geometry', () => {
    const rotated = rotateShape(shape(), Math.PI / 4)!;
    expect(hitShape(rotated, { x: 300, y: 165 }, 0)).toBe(true);
    expect(hitShape(rotated, { x: 205, y: 205 }, 0)).toBe(false);
  });
  it('resizes all shapes, keeps circles round and anchors the opposite corner after rotation', () => {
    for (const kind of ['line', 'arrow', 'rectangle', 'circle', 'triangle'] as const) {
      const original = shape(kind); const handle = kind === 'line' || kind === 'arrow' ? 'end' : 'se';
      const resized = resizeShape(original, handle, { x: 500, y: 450 })!;
      expect(resized.id).toBe(original.id); expect(teachingShapeSchema.safeParse(resized).success).toBe(true);
      if (resized.shape === 'circle') expect(resized.radius).toBe(125);
      expect(resizeShape(original, handle, { x: 200, y: 200 })).toBeNull();
    }
    const rotated = rotateShape(shape(), Math.PI / 4)!; const corner = selectionCorners(rotated)[2]!;
    const resized = resizeShape(rotated, 'se', { x: corner.x + 30, y: corner.y + 60 })!;
    const anchor = selectionCorners(resized)[0]!; const before = selectionCorners(rotated)[0]!;
    expect(anchor.x).toBeCloseTo(before.x); expect(anchor.y).toBeCloseTo(before.y);
  });
  it('keeps movement inside bounds, rejects invalid rotations, and accepts old payloads without adding defaults', () => {
    const edge = translateShape(shape(), { x: -1000, y: -1000 })!;
    expect(selectionCorners(edge)[0]).toEqual({ x: 0, y: 0 }); expect(rotateShape(edge, Math.PI / 4)).toBeNull();
    const original = shape(); expect(teachingShapeSchema.parse(original)).toEqual(original);
    expect(teachingShapeSchema.safeParse({ ...original, rotation: 360 }).success).toBe(false);
    expect(teachingShapeSchema.safeParse({ ...original, rotation: NaN }).success).toBe(false);
    expect(teachingShapeSchema.safeParse({ ...shape('circle'), rotation: 20 }).success).toBe(false);
    expect(shapeHandles(edge, .6).at(-1)!.point.y).toBeGreaterThanOrEqual(40);
  });
});

describe('draft-only editing and atomic page history', () => {
  it('ignores secondary pointers, never mutates the original, and cancels or completes one gesture', () => {
    const original = shape(); const before = JSON.stringify(original); const edit = new ShapeEditInteraction();
    expect(edit.begin(1, original, 'move', { x: 300, y: 300 })).toBe(true);
    expect(edit.begin(2, shape(), 'move', { x: 300, y: 300 })).toBe(false);
    edit.move(2, { x: 600, y: 300 }); expect(edit.draft).toEqual(original); expect(edit.complete(2, { x: 0, y: 0 })).toBeNull();
    edit.move(1, { x: 500, y: 300 }); expect(edit.draft).not.toEqual(original); expect(JSON.stringify(original)).toBe(before);
    edit.cancel(); expect(edit.draft).toBeNull(); expect(edit.complete(1, { x: 500, y: 300 })).toBeNull();
    edit.begin(3, original, 'move', { x: 300, y: 300 });
    expect(edit.complete(3, { x: 300, y: 300 })).toBeNull();
    edit.begin(4, original, 'se', { x: 400, y: 400 });
    expect(edit.complete(4, { x: 450, y: 450 })).toEqual(resizeShape(original, 'se', { x: 450, y: 450 }));
  });
  it('edits/deletes in one action, restores stacking order, and preserves Clear-all, page identity and backgrounds', () => {
    let state = board(); const page = state.document.activePageId; const a = shape(); const b = shape('triangle');
    for (const s of [a, b]) state = boardInkReducer(state, page, { type: 'commit-shape', shape: s });
    state = boardInkReducer(state, page, { type: 'commit', stroke: { id: id(), kind: 'ink', tool: 'eraser', color: '#000000', width: 5, points: [100, 100] } });
    state = pageReducer(state, { type: 'background', id: page, background: 'grid' });
    const before = state; const transformed = rotateShape(translateShape(a, { x: 200, y: 0 })!, .5)!;
    state = boardInkReducer(state, page, { type: 'edit-shape', shape: transformed });
    expect(boardSurface(state).past).toHaveLength(boardSurface(before).past.length + 1);
    expect(state.document.revision).toBe(before.document.revision + 1);
    expect(boardInkReducer(state, page, { type: 'edit-shape', shape: transformed })).toBe(state);
    state = boardInkReducer(state, page, { type: 'undo' }); expect(state.document.pages).toEqual(before.document.pages);
    state = boardInkReducer(state, page, { type: 'redo' });
    const edited = state;
    state = boardInkReducer(state, page, { type: 'delete-shape', id: a.id }); expect(state.document.pages[0]!.shapes).toEqual([b]);
    state = boardInkReducer(state, page, { type: 'undo' }); expect(state.document.pages).toEqual(edited.document.pages);
    state = boardInkReducer(state, page, { type: 'clear' }); expect(state.document.pages[0]).toEqual({ id: page, background: 'grid', objects: [], shapes: [] });
    state = boardInkReducer(state, page, { type: 'undo' }); expect(state.document.pages).toEqual(edited.document.pages);
    state = boardInkReducer(state, page, { type: 'redo' }); expect(state.document.pages[0]!.shapes).toEqual([]);
  });
  it('isolates page edits, preserves deleted/restored objects and discards obsolete redo', () => {
    let state = board(); const first = state.document.activePageId; const second = id(); const a = shape();
    state = boardInkReducer(state, first, { type: 'commit-shape', shape: a }); state = pageReducer(state, { type: 'add', id: second });
    const firstBefore = state.document.pages[0];
    expect(boardInkReducer(state, second, { type: 'edit-shape', shape: translateShape(a, { x: 10, y: 0 })! })).toBe(state);
    const b = shape('circle'); state = boardInkReducer(state, second, { type: 'commit-shape', shape: b });
    state = boardInkReducer(state, second, { type: 'delete-shape', id: b.id }); state = boardInkReducer(state, second, { type: 'undo' });
    state = boardInkReducer(state, second, { type: 'edit-shape', shape: translateShape(b, { x: 20, y: 0 })! });
    expect(boardSurface(state, second).future).toEqual([]); expect(state.document.pages[0]).toBe(firstBefore);
    const edited = state.document.pages[1]; state = pageReducer(state, { type: 'delete', id: second }); state = pageReducer(state, { type: 'restore', id: second });
    expect(state.document.pages[1]).toBe(edited);
  });
  it('rejects an oversized edit without changing pages, revision or history', () => {
    const original = shape(); const payload = capacityRecord(2097152 - JSON.stringify(original).length - 12).snapshot;
    let state = deserializeSession(payload).whiteboard; const page = state.document.activePageId;
    state = boardInkReducer(state, page, { type: 'commit-shape', shape: original }); expect(state.error).toBeUndefined();
    const before = state;
    state = boardInkReducer(state, page, { type: 'edit-shape', shape: rotateShape(original, .3456789)! });
    expect(state.error).toContain('capacity'); expect(state.document).toBe(before.document); expect(state.histories).toBe(before.histories);
  });
});
