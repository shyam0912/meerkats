import type { Stroke } from "../types/drawing";
import { SCENE_BOUNDS, type SceneBounds } from "./scene";
import { teachingShapeSchema, type TeachingShape } from '../../contracts';

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
}
export type DrawingOperation =
  | { type: "add-ink"; object: Stroke }
  | { type: 'add-shape'; object: TeachingShape }
  | { type: 'edit-shape'; before: TeachingShape; after: TeachingShape }
  | { type: 'delete-shape'; object: TeachingShape; index: number }
  | { type: "clear-content"; removed: readonly Stroke[]; removedShapes?: readonly TeachingShape[] };
export interface DocumentState {
  document: DrawingDocument;
  past: readonly DrawingOperation[];
  future: readonly DrawingOperation[];
}
export type DocumentAction =
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
  if (operation.type === 'add-shape' || operation.type === 'edit-shape' || operation.type === 'delete-shape') return objects;
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
    if (action.type === "clear") {
      if (state.document.objects.length === 0 && !state.document.shapes?.length) return state;
      operation = { type: "clear-content", removed: state.document.objects, removedShapes: state.document.shapes };
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
          [...state.document.objects, ...(state.document.shapes ?? [])].some(o => o.id === action.shape.id)) return state;
      operation = { type: 'add-shape', object: teachingShapeSchema.parse(action.shape) };
    } else {
      const stroke = action.stroke;
      if (stroke.points.length < 2 || stroke.points.length % 2 !== 0 ||
          !stroke.points.every(Number.isFinite) || !Number.isFinite(stroke.width) ||
          stroke.width <= 0 || [...state.document.objects, ...(state.document.shapes ?? [])].some((object) => object.id === stroke.id)) return state;
      // History never owns the mutable input buffer.
      operation = { type: "add-ink", object: { ...stroke, points: [...stroke.points] } };
    }
    objects = apply(state.document.objects, operation);
    past = [...past, operation].slice(-HISTORY_LIMIT);
    future = [];
  }
  let shapes = state.document.shapes;
  if (operation.type === 'clear-content') {
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
  return {
    document: { ...state.document, ...(shapes ? { shapes } : {}), objects, revision: state.document.revision + 1 },
    past, future,
  };
}
