import { MAX_SNAPSHOT_BYTES, MAX_WHITEBOARD_PAGES, type PageBackground, type SerializedWhiteboard } from '../../contracts';
import { createDocument, documentReducer, type DocumentAction, type DocumentOwner, type DocumentState } from './document';
import type { Stroke } from '../types/drawing';

export interface BoardPage { id: string; background: PageBackground; objects: readonly Stroke[] }
export interface WhiteboardDocument {
  schemaVersion: 2; id: string; owner: DocumentOwner; revision: number;
  bounds: { width: 1200; height: 675 }; activePageId: string;
  pages: readonly BoardPage[]; deletedPages: readonly BoardPage[];
}
type InkHistory = Pick<DocumentState, 'past' | 'future'>;
export interface WhiteboardState { document: WhiteboardDocument; histories: Record<string, InkHistory>; error?: string }
export type PageAction =
  | { type: 'select'; id: string }
  | { type: 'add'; id: string; objects?: readonly Stroke[] }
  | { type: 'move'; id: string; direction: -1 | 1 }
  | { type: 'delete' | 'restore'; id: string }
  | { type: 'background'; id: string; background: PageBackground }
  | { type: 'dismiss-error' };

export function createWhiteboard(owner: DocumentOwner, id: string): WhiteboardState {
  const initial = createDocument({ ...owner, target: { kind: 'whiteboard' } }, id).document;
  return { document: { schemaVersion: 2, id, owner: initial.owner, bounds: { width: 1200, height: 675 }, revision: 0,
    activePageId: id, pages: [{ id, background: 'white', objects: [] }], deletedPages: [] }, histories: {} };
}
export function boardSurface(board: WhiteboardState, pageId = board.document.activePageId): DocumentState {
  const doc = board.document; const page = doc.pages.find(p => p.id === pageId);
  if (!page) throw new Error('Whiteboard page not found');
  return { document: { schemaVersion: 1, id: doc.id, owner: doc.owner, bounds: doc.bounds, revision: doc.revision,
    objects: page.objects, pageId: page.id, background: page.background }, ...(board.histories[page.id] ?? { past: [], future: [] }) };
}
export function boardPayload(document: WhiteboardDocument): SerializedWhiteboard {
  const { revision, ...rest } = document;
  // Immutable internal arrays become JSON arrays at the serialization boundary.
  return { ...rest, owner: { ...rest.owner, target: { kind: 'whiteboard' } }, localRevision: revision,
    pages: document.pages.map(p => ({ ...p, objects: [...p.objects] })),
    deletedPages: document.deletedPages.map(p => ({ ...p, objects: [...p.objects] })) };
}
function accept(previous: WhiteboardState, next: WhiteboardState): WhiteboardState {
  const pages = [...next.document.pages, ...next.document.deletedPages];
  if (pages.length > MAX_WHITEBOARD_PAGES) return { ...previous, error: `This board allows ${MAX_WHITEBOARD_PAGES} pages including deleted pages. No page was added.` };
  if (pages.some(p => p.objects.length > 10000) || new TextEncoder().encode(JSON.stringify(boardPayload(next.document))).byteLength > MAX_SNAPSHOT_BYTES)
    return { ...previous, error: 'Board capacity reached (2 MiB / 10,000 ink actions per page). The last action was not applied. Export your work, or undo/clear ink to make space.' };
  return { ...next, error: undefined };
}
export function boardInkReducer(board: WhiteboardState, pageId: string, action: DocumentAction): WhiteboardState {
  if (!board.document.pages.some(p => p.id === pageId)) return board;
  const before = boardSurface(board, pageId); const after = documentReducer(before, action);
  if (after === before) return board;
  return accept(board, { ...board, document: { ...board.document, revision: board.document.revision + 1,
    pages: board.document.pages.map(p => p.id === pageId ? { ...p, objects: after.document.objects } : p) },
    histories: { ...board.histories, [pageId]: { past: after.past, future: after.future } } });
}
export function pageReducer(board: WhiteboardState, action: PageAction): WhiteboardState {
  if (action.type === 'dismiss-error') return { ...board, error: undefined };
  const doc = board.document; const pages = [...doc.pages]; let deletedPages = [...doc.deletedPages]; let activePageId = doc.activePageId;
  const index = pages.findIndex(p => p.id === action.id);
  if (action.type === 'add') {
    if ([...pages, ...deletedPages].some(p => p.id === action.id)) return board;
    pages.push({ id: action.id, background: 'white', objects: action.objects ? action.objects.map(o => ({ ...o, points: [...o.points] })) : [] }); activePageId = action.id;
  } else if (action.type === 'restore') {
    const page = deletedPages.find(p => p.id === action.id); if (!page) return board;
    pages.push(page); deletedPages = deletedPages.filter(p => p.id !== action.id); activePageId = action.id;
  } else {
    if (index < 0) return board;
    if (action.type === 'select') { if (activePageId === action.id) return board; activePageId = action.id; }
    if (action.type === 'background') { if (pages[index]!.background === action.background) return board; pages[index] = { ...pages[index]!, background: action.background }; }
    if (action.type === 'move') {
      const destination = index + action.direction; if (destination < 0 || destination >= pages.length) return board;
      [pages[index], pages[destination]] = [pages[destination]!, pages[index]!];
    }
    if (action.type === 'delete') {
      if (pages.length === 1) return board;
      deletedPages.push(pages[index]!); pages.splice(index, 1);
      if (activePageId === action.id) activePageId = pages[Math.min(index, pages.length - 1)]!.id;
    }
  }
  return accept(board, { ...board, document: { ...doc, pages, deletedPages, activePageId, revision: doc.revision + 1 } });
}
