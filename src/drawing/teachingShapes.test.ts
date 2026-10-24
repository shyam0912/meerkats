import { describe, expect, it } from 'vitest';
import { createShape, ShapeInteraction, shapePath } from './teachingShapes';
import { boardInkReducer, boardPayload, boardSurface, createWhiteboard, pageReducer } from './whiteboard';
import { documentSchema, documentV1Schema, migrateWhiteboard, whiteboardV2Schema, whiteboardV3Schema, type TeachingShapeType } from '../../contracts';
import { deserializeSession } from '../persistence/serialization';
import { capacityRecord } from '../../tests/helpers/capacity';

const id = () => crypto.randomUUID();
const shape = (type: TeachingShapeType = 'rectangle') => createShape(id(), { shape: type, color: '#214f45', width: 4 }, { x: 100, y: 100 }, { x: 300, y: 200 })!;
const board = () => createWhiteboard({ sessionId: id(), classId: null, subjectId: null }, id());

describe('teaching shape geometry and gestures', () => {
  it.each(['line', 'arrow', 'rectangle', 'circle', 'triangle'] as const)('creates bounded %s data and a renderer-independent path', type => {
    const object = shape(type);
    expect(object.shape).toBe(type); expect(object.color).toBe('#214f45'); expect(object.width).toBe(4);
    expect(shapePath(object)).toMatch(/^M /); expect(shapePath(object)).not.toContain('NaN');
    if (object.shape === 'circle') expect(object).toMatchObject({ center: { x: 150, y: 150 }, radius: 50 });
    if (object.shape === 'triangle') expect(shapePath(object)).toBe('M 200 100 L 300 200 L 100 200 Z');
  });
  it('normalizes reverse drags, preserves line direction, and rejects degenerate and out-of-bounds shapes', () => {
    const settings = { shape: 'rectangle' as const, color: '#000000', width: 2 };
    expect(createShape(id(), settings, { x: 300, y: 200 }, { x: 100, y: 100 })).toMatchObject({ origin: { x: 100, y: 100 }, size: { width: 200, height: 100 } });
    expect(createShape(id(), { ...settings, shape: 'line' }, { x: 300, y: 100 }, { x: 100, y: 100 })).toMatchObject({ start: { x: 300, y: 100 }, end: { x: 100, y: 100 } });
    expect(createShape(id(), settings, { x: 10, y: 10 }, { x: 10, y: 10 })).toBeNull();
    expect(createShape(id(), settings, { x: 0, y: 0 }, { x: 1300, y: 700 })).toBeNull();
  });
  it('keeps gesture settings stable, ignores secondary pointers, and cancels without a completed object', () => {
    const input = new ShapeInteraction(); const settings = { shape: 'circle' as const, color: '#000000', width: 2 }; const objectId = id();
    expect(input.begin(1, objectId, settings, { x: 10, y: 10 })).toBe(true); settings.color = '#ff0000';
    expect(input.begin(2, id(), settings, { x: 100, y: 100 })).toBe(false);
    input.move(2, { x: 200, y: 200 }); expect(input.draft).toBeNull();
    input.move(1, { x: 110, y: 210 }); expect(input.draft).toMatchObject({ id: objectId, color: '#000000', radius: 50 });
    expect(input.complete(2, { x: 200, y: 200 })).toBeNull();
    input.cancel(); expect(input.complete(1, { x: 200, y: 200 })).toBeNull();
    input.begin(3, objectId, settings, { x: 10, y: 10 });
    expect(input.complete(3, { x: 110, y: 110 })?.id).toBe(objectId); expect(input.pointerId).toBeNull();
  });
});

describe('page shape history and version compatibility', () => {
  it('upgrades only on completed shape, supports ordered mixed history and branching, and leaves shapes during Clear ink', () => {
    let state = board(); const page = state.document.activePageId; const object = shape();
    expect(boardPayload(state.document).schemaVersion).toBe(2);
    state = boardInkReducer(state, page, { type: 'commit-shape', shape: object });
    expect(boardPayload(state.document).schemaVersion).toBe(3); expect(boardSurface(state).past).toHaveLength(1);
    state = boardInkReducer(state, page, { type: 'commit', stroke: { id: id(), kind: 'ink', tool: 'eraser', color: '#000000', width: 40, points: [100, 100] } });
    state = boardInkReducer(state, page, { type: 'undo' }); expect(boardSurface(state).document.shapes).toEqual([object]);
    state = boardInkReducer(state, page, { type: 'undo' }); expect(boardSurface(state).document.shapes).toEqual([]);
    state = boardInkReducer(state, page, { type: 'redo' }); expect(boardSurface(state).document.shapes).toEqual([object]);
    state = boardInkReducer(state, page, { type: 'redo' }); state = boardInkReducer(state, page, { type: 'clear' });
    expect(boardSurface(state).document.shapes).toEqual([object]); expect(boardSurface(state).document.objects).toEqual([]);
    state = boardInkReducer(state, page, { type: 'undo' }); state = boardInkReducer(state, page, { type: 'commit-shape', shape: shape('line') });
    expect(boardSurface(state).future).toEqual([]);
  });
  it('keeps shapes with stable page IDs through reorder, deletion/restoration and page-specific Undo', () => {
    let state = board(); const a = state.document.activePageId; const b = id(); const object = shape();
    state = boardInkReducer(state, a, { type: 'commit-shape', shape: object }); state = pageReducer(state, { type: 'add', id: b });
    state = boardInkReducer(state, b, { type: 'commit-shape', shape: shape('circle') }); state = boardInkReducer(state, b, { type: 'undo' });
    expect(boardSurface(state, a).document.shapes).toEqual([object]);
    state = pageReducer(state, { type: 'move', id: a, direction: 1 }); state = pageReducer(state, { type: 'delete', id: a });
    expect(state.document.deletedPages[0]!.shapes).toEqual([object]);
    state = pageReducer(state, { type: 'restore', id: a }); expect(boardSurface(state).document.shapes).toEqual([object]);
    expect(whiteboardV3Schema.safeParse(boardPayload(state.document)).success).toBe(true);
  });
  it('retains legacy formats, rejects unsupported versions and prevents shape data in annotation/v2 payloads', () => {
    const v2 = whiteboardV2Schema.parse(boardPayload(board().document));
    const v1 = { schemaVersion: 1 as const, id: v2.id, owner: v2.owner, localRevision: 1, bounds: v2.bounds, objects: [] };
    expect(documentV1Schema.safeParse(v1).success).toBe(true); expect(migrateWhiteboard(v1).id).toBe(v1.id);
    expect(migrateWhiteboard(v2)).toBe(v2);
    expect(documentSchema.safeParse({ ...v2, schemaVersion: 99 }).success).toBe(false);
    expect(documentSchema.safeParse({ ...v2, pages: [{ ...v2.pages[0], shapes: [shape()] }] }).success).toBe(false);
    expect(documentV1Schema.safeParse({ ...v1, shapes: [shape()] }).success).toBe(false);
  });
  it('rejects shape and upgrade overhead above capacity without changing the valid document or history', () => {
    const state = deserializeSession(capacityRecord().snapshot).whiteboard;
    const rejected = boardInkReducer(state, state.document.activePageId, { type: 'commit-shape', shape: shape() });
    expect(rejected.document).toBe(state.document); expect(rejected.histories).toBe(state.histories); expect(rejected.error).toContain('2 MiB');
  }, 30000);
});
