import { describe, expect, it } from 'vitest';
import { teachingTextSchema, whiteboardV3Schema, whiteboardV4Schema, type TeachingText } from '../../contracts';
import { boardInkReducer, boardPayload, boardSurface, createWhiteboard, pageReducer } from './whiteboard';
import { hitText, moveText, TextMoveInteraction } from './teachingText';
const owner = { sessionId: crypto.randomUUID(), classId: null, subjectId: null };
const text = (): TeachingText => ({ id: crypto.randomUUID(), kind: 'text', text: 'English മലയാളം\nക്ഷേത്രം — H₂O, 10!',
  origin: { x: 100, y: 100 }, size: { width: 400, height: 116 }, color: '#214f45', font: 'noto-sans-malayalam', fontSize: 32 });
describe('editable teaching text', () => {
  it('preserves exact mixed Unicode and newline content in v4; v3 rejects it', () => {
    const initial = createWhiteboard(owner, crypto.randomUUID()); const value = text();
    const next = boardInkReducer(initial, initial.document.activePageId, { type: 'commit-text', text: value });
    expect(initial.document.schemaVersion).toBe(2); expect(next.document.schemaVersion).toBe(4);
    expect(whiteboardV4Schema.parse(boardPayload(next.document)).pages[0]!.texts).toEqual([value]);
    expect(whiteboardV3Schema.safeParse(boardPayload(next.document)).success).toBe(false);
  });
  it('creates, edits, deletes and clears in single reversible page actions', () => {
    let board = createWhiteboard(owner, crypto.randomUUID()); const page = board.document.activePageId; const value = text();
    const act = (action: Parameters<typeof boardInkReducer>[2]) => { board = boardInkReducer(board, page, action); };
    act({ type: 'commit-text', text: value }); act({ type: 'undo' }); expect(board.document.pages[0]!.texts).toEqual([]);
    act({ type: 'redo' }); expect(board.document.pages[0]!.texts).toEqual([value]);
    const edited = { ...value, text: 'മലയാളം English', color: '#225eaf' };
    act({ type: 'edit-text', text: edited }); act({ type: 'undo' }); expect(board.document.pages[0]!.texts).toEqual([value]);
    act({ type: 'redo' }); act({ type: 'delete-text', id: value.id }); act({ type: 'undo' }); expect(board.document.pages[0]!.texts).toEqual([edited]);
    act({ type: 'clear' }); expect(board.document.pages[0]!.texts).toEqual([]);
    act({ type: 'undo' }); expect(board.document.pages[0]!.texts).toEqual([edited]); act({ type: 'redo' }); expect(board.document.pages[0]!.texts).toEqual([]);
  });
  it('isolates page history and preserves text through reordering/deletion/restoration', () => {
    let board = createWhiteboard(owner, crypto.randomUUID()); const first = board.document.activePageId; const second = crypto.randomUUID();
    board = boardInkReducer(board, first, { type: 'commit-text', text: text() }); const original = board.document.pages[0];
    board = pageReducer(board, { type: 'add', id: second });
    board = boardInkReducer(board, second, { type: 'undo' }); expect(board.document.pages[0]).toEqual(original);
    board = pageReducer(board, { type: 'move', id: first, direction: 1 });
    board = pageReducer(board, { type: 'delete', id: first }); board = pageReducer(board, { type: 'restore', id: first });
    expect(board.document.pages.find(p => p.id === first)).toEqual(original);
  });
  it('rejects invalid or oversized text without changing board or history', () => {
    const board = createWhiteboard(owner, crypto.randomUUID());
    expect(boardInkReducer(board, board.document.activePageId, { type: 'commit-text', text: { ...text(), text: 'a'.repeat(4097) } })).toBe(board);
    expect(teachingTextSchema.safeParse({ ...text(), origin: { x: 1199, y: 100 } }).success).toBe(false);
    expect(teachingTextSchema.safeParse({ ...text(), text: ' \n ' }).success).toBe(false);
    for (const value of ['null\0character', 'unpaired\ud800', 'unpaired\udfff'])
      expect(teachingTextSchema.safeParse({ ...text(), text: value }).success).toBe(false);
  });
  it('keeps text within scene, hit tests it and treats cancelled/secondary pointers as drafts', () => {
    const value = text(); const moved = moveText(value, { x: 2000, y: -2000 });
    expect(moved.origin).toEqual({ x: 800, y: 0 }); expect(hitText(moved, { x: 900, y: 50 })).toBe(true);
    const gesture = new TextMoveInteraction(); gesture.begin(1, value, { x: 100, y: 100 });
    gesture.move(2, { x: 600, y: 100 }); expect(gesture.draft).toEqual(value);
    expect(gesture.complete(2, { x: 600, y: 100 })).toBeNull();
    gesture.move(1, { x: 200, y: 200 }); gesture.cancel(); expect(gesture.draft).toBeNull();
    gesture.begin(3, value, { x: 100, y: 100 }); expect(gesture.complete(3, { x: 100, y: 100 })).toBeNull();
  });
  it('retains v4 after Undo and shape creation, and does not record unchanged edits', () => {
    let board = createWhiteboard(owner, crypto.randomUUID()); const page = board.document.activePageId; const value = text();
    board = boardInkReducer(board, page, { type: 'commit-text', text: value });
    const before = boardSurface(board).past.length;
    board = boardInkReducer(board, page, { type: 'edit-text', text: value }); expect(boardSurface(board).past).toHaveLength(before);
    board = boardInkReducer(board, page, { type: 'undo' });
    board = boardInkReducer(board, page, { type: 'commit-shape', shape: { id: crypto.randomUUID(), kind: 'shape', shape: 'line', start: { x: 10, y: 10 }, end: { x: 50, y: 50 }, color: '#000000', width: 3 } });
    expect(board.document.schemaVersion).toBe(4); expect(whiteboardV4Schema.safeParse(boardPayload(board.document)).success).toBe(true);
    expect(boardSurface(board).future).toHaveLength(0);
  });
});
