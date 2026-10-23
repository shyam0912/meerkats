import { describe, expect, it } from 'vitest';
import { MAX_WHITEBOARD_PAGES, whiteboardV2Schema } from '../../contracts';
import { boardInkReducer, boardPayload, boardSurface, createWhiteboard, pageReducer } from './whiteboard';
const fresh = () => createWhiteboard({ sessionId: crypto.randomUUID(), classId: null, subjectId: null }, crypto.randomUUID());
const ink = () => ({ id: crypto.randomUUID(), kind: 'ink' as const, tool: 'pen' as const, color: '#000000', width: 3, points: [10, 10, 100, 100] });

describe('multi-page document and per-page history', () => {
  it('isolates drawing, repeated undo/redo and redo branching across pages', () => {
    let board = fresh(); const a = board.document.activePageId; const b = crypto.randomUUID(); const stroke = ink();
    board = boardInkReducer(board, a, { type: 'commit', stroke });
    board = pageReducer(board, { type: 'add', id: b });
    board = boardInkReducer(board, b, { type: 'commit', stroke: ink() });
    board = boardInkReducer(board, b, { type: 'undo' });
    expect(boardSurface(board, a).document.objects).toEqual([stroke]); expect(boardSurface(board, b).document.objects).toEqual([]);
    board = boardInkReducer(board, b, { type: 'redo' }); board = boardInkReducer(board, b, { type: 'undo' });
    const replacement = ink(); board = boardInkReducer(board, b, { type: 'commit', stroke: replacement });
    expect(boardSurface(board, b).future).toEqual([]); expect(boardSurface(board, b).document.objects).toEqual([replacement]);
    board = boardInkReducer(board, a, { type: 'clear' }); board = boardInkReducer(board, a, { type: 'undo' });
    expect(boardSurface(board, a).document.objects).toEqual([stroke]); expect(boardSurface(board, b).document.objects).toEqual([replacement]);
  });
  it('reorders by stable ID and safely deletes/restores ink, background and history', () => {
    let board = fresh(); const a = board.document.activePageId; const b = crypto.randomUUID(); const stroke = ink();
    board = boardInkReducer(board, a, { type: 'commit', stroke }); board = pageReducer(board, { type: 'background', id: a, background: 'grid' });
    board = pageReducer(board, { type: 'add', id: b }); board = pageReducer(board, { type: 'move', id: b, direction: -1 });
    expect(board.document.pages.map(p => p.id)).toEqual([b, a]); expect(board.document.activePageId).toBe(b);
    board = pageReducer(board, { type: 'delete', id: a });
    expect(board.document.deletedPages[0]).toEqual({ id: a, background: 'grid', objects: [stroke] });
    expect(pageReducer(board, { type: 'delete', id: b })).toBe(board);
    board = pageReducer(board, { type: 'restore', id: a });
    expect(boardSurface(board).document.objects).toEqual([stroke]); expect(boardSurface(board).past).toHaveLength(1);
  });
  it('does not route stale or deleted-page completions to the selected page', () => {
    let board = fresh(); const a = board.document.activePageId; const b = crypto.randomUUID();
    board = pageReducer(board, { type: 'add', id: b }); board = boardInkReducer(board, a, { type: 'commit', stroke: ink() });
    expect(boardSurface(board).document.objects).toHaveLength(0); expect(boardSurface(board, a).document.objects).toHaveLength(1);
    board = pageReducer(board, { type: 'delete', id: a }); expect(boardInkReducer(board, a, { type: 'commit', stroke: ink() })).toBe(board);
  });
  it('enforces page capacity including recoverable deleted pages', () => {
    let board = fresh(); for (let i = 1; i < MAX_WHITEBOARD_PAGES; i++) board = pageReducer(board, { type: 'add', id: crypto.randomUUID() });
    board = pageReducer(board, { type: 'delete', id: board.document.pages[0]!.id });
    const before = board.document; board = pageReducer(board, { type: 'add', id: crypto.randomUUID() });
    expect(board.document).toBe(before); expect(board.error).toContain('20 pages');
    board = pageReducer(board, { type: 'restore', id: before.deletedPages[0]!.id }); expect(board.document.pages).toHaveLength(20);
  });
  it('rejects a completed action that exceeds capacity without poisoning history or saved state', () => {
    let board = fresh(); const page = board.document.activePageId;
    const stroke = { ...ink(), points: Array.from({ length: 200000 }, (_, i) => i % 2 ? 123.456789 : 234.567891) };
    const original = board.document; board = boardInkReducer(board, page, { type: 'commit', stroke });
    expect(board.document).toBe(original); expect(boardSurface(board).past).toEqual([]); expect(board.error).toContain('2 MiB');
    expect(whiteboardV2Schema.safeParse(boardPayload(board.document)).success).toBe(true);
  });
  it('rejects invalid wire format: duplicate pages, missing selection, annotation targets and oversized payloads', () => {
    const doc = boardPayload(fresh().document); const page = doc.pages[0]!;
    for (const invalid of [{ ...doc, pages: [page, page] }, { ...doc, activePageId: crypto.randomUUID() },
      { ...doc, owner: { ...doc.owner, target: { kind: 'annotation', sceneId: 'demo' } } },
      { ...doc, pages: [{ ...page, objects: [{ ...ink(), points: Array(200000).fill(100.123456789) }] }] }])
      expect(whiteboardV2Schema.safeParse(invalid).success).toBe(false);
  });
});
