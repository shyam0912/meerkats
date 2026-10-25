import { expect, it } from 'vitest';
import { documentSchema, type TeachingShapeType } from '../../contracts';
import { createShape } from './teachingShapes';
import { boardInkReducer, boardPayload, boardSurface, createWhiteboard, pageReducer } from './whiteboard';
import { createDocument, documentReducer } from './document';
import { serializeDocument } from '../persistence/serialization';
import type { Stroke } from '../types/drawing';

const id = () => crypto.randomUUID();
const owner = () => ({ sessionId: id(), classId: null, subjectId: null });
const ink = (tool: Stroke['tool']): Stroke => ({ id: id(), kind: 'ink', tool, color: '#225eaf', width: 6, points: [100, 100, 400, 300] });
const shape = (type: TeachingShapeType) => createShape(id(), { shape: type, color: '#b63737', width: 8 }, { x: 100, y: 200 }, { x: 400, y: 400 })!;

it('clears pen, masks and all five shape types as one reversible page action', () => {
  let board = createWhiteboard(owner(), id()); const page = board.document.activePageId;
  board = pageReducer(board, { type: 'background', id: page, background: 'grid' });
  for (const tool of ['pen', 'eraser'] as const) board = boardInkReducer(board, page, { type: 'commit', stroke: ink(tool) });
  for (const type of ['line', 'arrow', 'rectangle', 'circle', 'triangle'] as const)
    board = boardInkReducer(board, page, { type: 'commit-shape', shape: shape(type) });
  const before = board; const history = boardSurface(board).past;
  board = boardInkReducer(board, page, { type: 'clear' });
  expect(board.document.pages[0]).toEqual({ ...before.document.pages[0], objects: [], shapes: [] });
  expect(board.document).toMatchObject({ id: before.document.id, owner: before.document.owner, activePageId: page, schemaVersion: 3 });
  expect(boardSurface(board).past).toHaveLength(history.length + 1);
  expect(board.document.revision).toBe(before.document.revision + 1);
  expect(documentSchema.parse(boardPayload(board.document)).schemaVersion).toBe(3);
  board = boardInkReducer(board, page, { type: 'undo' });
  expect(board.document.pages).toEqual(before.document.pages);
  expect(boardSurface(board).past).toEqual(history);
  board = boardInkReducer(board, page, { type: 'redo' });
  expect(board.document.pages[0]).toEqual({ ...before.document.pages[0], objects: [], shapes: [] });
  expect(boardSurface(board).future).toEqual([]);
});

it('does not change other pages, deleted pages, their backgrounds or their history', () => {
  let board = createWhiteboard(owner(), id()); const first = board.document.activePageId; const second = id(); const third = id();
  board = boardInkReducer(board, first, { type: 'commit-shape', shape: shape('arrow') });
  board = pageReducer(board, { type: 'add', id: second });
  board = boardInkReducer(board, second, { type: 'commit-shape', shape: shape('circle') });
  board = pageReducer(board, { type: 'background', id: second, background: 'dotted' });
  board = pageReducer(board, { type: 'add', id: third });
  board = boardInkReducer(board, third, { type: 'commit-shape', shape: shape('triangle') });
  board = pageReducer(board, { type: 'delete', id: third });
  const before = board;
  board = boardInkReducer(board, second, { type: 'clear' });
  expect(board.document.pages[0]).toBe(before.document.pages[0]);
  expect(board.histories[first]).toBe(before.histories[first]);
  expect(board.document.deletedPages).toBe(before.document.deletedPages);
  expect(board.document.pages[1]).toEqual({ ...before.document.pages[1], shapes: [] });
  expect(boardInkReducer(board, second, { type: 'undo' }).document.pages).toEqual(before.document.pages);
});

it('clears shape-only pages, keeps empty Clear a no-op and discards only an obsolete Redo branch', () => {
  let board = createWhiteboard(owner(), id()); const page = board.document.activePageId;
  board = boardInkReducer(board, page, { type: 'commit-shape', shape: shape('rectangle') });
  board = boardInkReducer(board, page, { type: 'clear' });
  expect(boardSurface(board).document.shapes).toEqual([]);
  expect(boardInkReducer(board, page, { type: 'clear' })).toBe(board);
  board = boardInkReducer(board, page, { type: 'undo' });
  const replacement = shape('line');
  board = boardInkReducer(board, page, { type: 'commit-shape', shape: replacement });
  expect(boardSurface(board).future).toEqual([]);
  expect(boardSurface(board).document.shapes).toHaveLength(2);
  expect(boardInkReducer(board, page, { type: 'redo' })).toBe(board);
});

it('keeps ink-only v2 boards and v1 annotation serialization compatible', () => {
  let board = createWhiteboard(owner(), id()); const page = board.document.activePageId;
  board = boardInkReducer(board, page, { type: 'commit', stroke: ink('pen') });
  board = boardInkReducer(board, page, { type: 'clear' });
  expect(documentSchema.parse(boardPayload(board.document)).schemaVersion).toBe(2);
  let annotation = createDocument({ ...owner(), target: { kind: 'annotation', sceneId: 'neutral-shapes-v1' } }, id());
  annotation = documentReducer(annotation, { type: 'commit', stroke: ink('pen') });
  const before = serializeDocument(annotation.document);
  annotation = documentReducer(annotation, { type: 'clear' });
  expect(serializeDocument(annotation.document)).toEqual({ ...before, objects: [], localRevision: before.localRevision + 1 });
  annotation = documentReducer(annotation, { type: 'undo' });
  expect(serializeDocument(annotation.document)).toEqual({ ...before, localRevision: before.localRevision + 2 });
});
