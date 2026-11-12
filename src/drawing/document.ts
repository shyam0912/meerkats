import type { Stroke } from "../types/drawing";
import { SCENE_BOUNDS, type SceneBounds } from "./scene";
import { teachingTextSchema, type TeachingText, teachingShapeSchema, type TeachingShape } from '../../contracts';
import { MAX_SELECTION, type EditableObject } from './objectSelection';

export type BatchAction = { type: 'batch'; kind: 'move' | 'duplicate' | 'delete'; ids: readonly string[]; objects?: readonly EditableObject[] };
type ObjectChange = { before?: EditableObject; after?: EditableObject; index: number };
function applyChanges<T extends EditableObject>(items: readonly T[], changes: readonly ObjectChange[], kind: T['kind'], reverse: boolean): T[] {
  const relevant = changes.filter(c => (c.before ?? c.after)!.kind === kind);
  const result = items.flatMap(item => {
    const change = relevant.find(c => (reverse ? c.after : c.before)?.id === item.id);
    if (!change) return [item];
    const next = reverse ? change.before : change.after;
    return next ? [next as T] : [];
  });
  for (const c of [...relevant].sort((a, b) => a.index - b.index)) {
    const before = reverse ? c.after : c.before; const after = reverse ? c.before : c.after;
    if (!before && after) result.splice(c.index, 0, after as T);
  }
  return result;
}

export interface DocumentOwner {
  sessionId: string;
  classId: string | null;
  subjectId: string | null;
  target?: { kind: "whiteboard" } | { kind: "annotation"; sceneId: string; lessonVersionId?: string; activityId?: string };
}
export interface DrawingDocument {
  /** Rendering projection only; a whiteboard page keeps the aggregate document ID. */
  pageId?: string;
  background?: import('../../contracts').PageBackground;
  schemaVersion: 1;
  id: string;
  owner: DocumentOwner;
  revision: number;
  bounds: SceneBounds;
  objects: readonly Stroke[];
  shapes?: readonly TeachingShape[];
  texts?: readonly TeachingText[];
}
export type DrawingOperation =
  | { type: 'batch'; changes: readonly ObjectChange[] }
  | { type: 'add-text'; object: TeachingText }
  | { type: 'edit-text'; before: TeachingText; after: TeachingText }
  | { type: 'delete-text'; object: TeachingText; index: number }
  | { type: "add-ink"; object: Stroke }
  | { type: 'add-shape'; object: TeachingShape }
  | { type: 'edit-shape'; before: TeachingShape; after: TeachingShape }
  | { type: 'delete-shape'; object: TeachingShape; index: number }
  | { type: "clear-content"; removed: readonly Stroke[]; removedShapes?: readonly TeachingShape[]; removedTexts?: readonly TeachingText[] };
export interface DocumentState {
  document: DrawingDocument;
  past: readonly DrawingOperation[];
  future: readonly DrawingOperation[];
}
export type DocumentAction =
  | BatchAction
  | { type: 'commit-text'; text: TeachingText }
  | { type: 'edit-text'; text: TeachingText }
  | { type: 'delete-text'; id: string }
  | { type: "commit"; stroke: Stroke }
  | { type: 'commit-shape'; shape: TeachingShape }
  | { type: 'edit-shape'; shape: TeachingShape }
  | { type: 'delete-shape'; id: string }
  | { type: "clear" }
  | { type: "undo" }
  | { type: "redo" };

export const HISTORY_LIMIT = 100;

export function createDocument(owner: DocumentOwner, id: string): DocumentState {
  return {
    document: { schemaVersion: 1, id, owner, bounds: { ...SCENE_BOUNDS }, revision: 0, objects: [] },
    past: [], future: [],
  };
}
function apply(objects: readonly Stroke[], operation: DrawingOperation, reverse = false) {
  if (operation.type === 'batch') return objects;
  if (operation.type === 'add-text' || operation.type === 'edit-text' || operation.type === 'delete-text' || operation.type === 'add-shape' || operation.type === 'edit-shape' || operation.type === 'delete-shape') return objects;
  if (operation.type === "clear-content") return reverse ? operation.removed : [];
  return reverse ? objects.filter((object) => object.id !== operation.object.id)
    : [...objects, operation.object];
}
export function documentReducer(state: DocumentState, action: DocumentAction): DocumentState {
  let operation: DrawingOperation;
  let objects: readonly Stroke[];
  let past = state.past;
  let future = state.future;
  if (action.type === "undo" || action.type === "redo") {
    const entry = (action.type === "undo" ? past : future).at(-1);
    if (!entry) return state;
    operation = entry;
    objects = apply(state.document.objects, operation, action.type === "undo");
    if (action.type === "undo") {
      past = past.slice(0, -1);
      future = [...future, operation];
    } else {
      past = [...past, operation].slice(-HISTORY_LIMIT);
      future = future.slice(0, -1);
    }
  } else {
    if (action.type === 'batch') {
      if (!state.document.pageId || !action.ids.length || action.ids.length > MAX_SELECTION || new Set(action.ids).size !== action.ids.length) return state;
      const editable = [...(state.document.shapes ?? []), ...(state.document.texts ?? [])];
      const originals = action.ids.map(id => editable.find(o => o.id === id));
      if (originals.some(o => !o)) return state;
      const changes: ObjectChange[] = [];
      const next = action.objects ?? [];
      if (action.kind !== 'delete' && (next.length !== action.ids.length || new Set(next.map(o => o.id)).size !== next.length ||
        next.some(o => !(o.kind === 'text' ? teachingTextSchema : teachingShapeSchema).safeParse(o).success))) return state;
      if (action.kind === 'delete' && next.length) return state;
      let shapeIndex = state.document.shapes?.length ?? 0; let textIndex = state.document.texts?.length ?? 0;
      for (let i = 0; i < originals.length; i++) {
        const before = originals[i]!; const after = next[i];
        const index = (before.kind === 'text' ? state.document.texts : state.document.shapes)!.findIndex(o => o.id === before.id);
        if (action.kind === 'delete') changes.push({ before, index });
        else {
          if (!after || after.kind !== before.kind || (after.kind === 'shape' && before.kind === 'shape' && after.shape !== before.shape)) return state;
          if (action.kind === 'duplicate') {
            if ([...state.document.objects, ...editable].some(o => o.id === after.id)) return state;
            changes.push({ after, index: after.kind === 'text' ? textIndex++ : shapeIndex++ });
          } else {
            if (before.id !== after.id) return state;
            if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ before, after, index });
          }
        }
      }
      if (!changes.length) return state;
      operation = { type: 'batch', changes };
    } else if (action.type === "clear") {
      if (state.document.objects.length === 0 && !state.document.shapes?.length && !state.document.texts?.length) return state;
      operation = { type: "clear-content", removed: state.document.objects, removedShapes: state.document.shapes, removedTexts: state.document.texts };
    } else if (action.type === 'commit-text' || action.type === 'edit-text' || action.type === 'delete-text') {
      if (!state.document.pageId) return state;
      const id = action.type === 'delete-text' ? action.id : action.text.id;
      const index = state.document.texts?.findIndex(t => t.id === id) ?? -1;
      const before = state.document.texts?.[index];
      if (action.type === 'delete-text') {
        if (!before) return state;
        operation = { type: 'delete-text', object: before, index };
      } else {
        const parsed = teachingTextSchema.safeParse(action.text); if (!parsed.success) return state;
        if (action.type === 'commit-text') {
          if ([...state.document.objects, ...(state.document.shapes ?? []), ...(state.document.texts ?? [])].some(o => o.id === id)) return state;
          operation = { type: 'add-text', object: parsed.data };
        } else {
          if (!before || JSON.stringify(before) === JSON.stringify(parsed.data)) return state;
          operation = { type: 'edit-text', before, after: parsed.data };
        }
      }
    } else if (action.type === 'edit-shape' || action.type === 'delete-shape') {
      if (!state.document.pageId) return state;
      const index = state.document.shapes?.findIndex(s => s.id === (action.type === 'edit-shape' ? action.shape.id : action.id)) ?? -1;
      const before = state.document.shapes?.[index];
      if (!before) return state;
      if (action.type === 'delete-shape') operation = { type: 'delete-shape', object: before, index };
      else {
        const parsed = teachingShapeSchema.safeParse(action.shape);
        if (!parsed.success || parsed.data.shape !== before.shape || JSON.stringify(parsed.data) === JSON.stringify(before)) return state;
        operation = { type: 'edit-shape', before, after: parsed.data };
      }
    } else if (action.type === 'commit-shape') {
      if (!state.document.pageId || !teachingShapeSchema.safeParse(action.shape).success ||
          [...state.document.objects, ...(state.document.shapes ?? []), ...(state.document.texts ?? [])].some(o => o.id === action.shape.id)) return state;
      operation = { type: 'add-shape', object: teachingShapeSchema.parse(action.shape) };
    } else {
      const stroke = action.stroke;
      if (stroke.points.length < 2 || stroke.points.length % 2 !== 0 ||
          !stroke.points.every(Number.isFinite) || !Number.isFinite(stroke.width) ||
          stroke.width <= 0 || [...state.document.objects, ...(state.document.shapes ?? []), ...(state.document.texts ?? [])].some((object) => object.id === stroke.id)) return state;
      // History never owns the mutable input buffer.
      operation = { type: "add-ink", object: { ...stroke, points: [...stroke.points] } };
    }
    objects = apply(state.document.objects, operation);
    past = [...past, operation].slice(-HISTORY_LIMIT);
    future = [];
  }
  let shapes = state.document.shapes;
  if (operation.type === 'batch') {
    if (shapes) shapes = applyChanges(shapes, operation.changes, 'shape', action.type === 'undo');
  } else if (operation.type === 'clear-content') {
    // Keep ink-only annotation/v1 projections free of shape fields.
    shapes = action.type === 'undo' ? operation.removedShapes : shapes ? [] : undefined;
  } else if (operation.type === 'add-shape') {
    shapes = action.type === 'undo'
      ? (shapes ?? []).filter(s => s.id !== operation.object.id)
      : [...(shapes ?? []), operation.object];
  } else if (operation.type === 'edit-shape') {
    const replacement = action.type === 'undo' ? operation.before : operation.after;
    shapes = shapes?.map(s => s.id === replacement.id ? replacement : s);
  } else if (operation.type === 'delete-shape') {
    const removed = operation.object;
    shapes = [...(shapes ?? [])];
    if (action.type === 'undo') (shapes as TeachingShape[]).splice(operation.index, 0, removed);
    else shapes = shapes.filter(s => s.id !== removed.id);
  }
  let texts = state.document.texts;
  if (operation.type === 'batch') {
    if (texts) texts = applyChanges(texts, operation.changes, 'text', action.type === 'undo');
  } else if (operation.type === 'clear-content') texts = action.type === 'undo' ? operation.removedTexts : texts ? [] : undefined;
  else if (operation.type === 'add-text') texts = action.type === 'undo' ? texts?.filter(t => t.id !== operation.object.id) : [...(texts ?? []), operation.object];
  else if (operation.type === 'edit-text') { const next = action.type === 'undo' ? operation.before : operation.after; texts = texts?.map(t => t.id === next.id ? next : t); }
  else if (operation.type === 'delete-text') {
    const restored = [...(texts ?? [])];
    if (action.type === 'undo') { restored.splice(operation.index, 0, operation.object); texts = restored; }
    else texts = restored.filter(t => t.id !== operation.object.id);
  }
  return {
    document: { ...state.document, ...(texts ? { texts } : {}), ...(shapes ? { shapes } : {}), objects, revision: state.document.revision + 1 },
    past, future,
  };
}
