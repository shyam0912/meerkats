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
  | { type: "clear-ink"; removed: readonly Stroke[] };
export interface DocumentState {
  document: DrawingDocument;
  past: readonly DrawingOperation[];
  future: readonly DrawingOperation[];
}
export type DocumentAction =
  | { type: "commit"; stroke: Stroke }
  | { type: 'commit-shape'; shape: TeachingShape }
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
  if (operation.type === 'add-shape') return objects;
  if (operation.type === "clear-ink") return reverse ? operation.removed : [];
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
      if (state.document.objects.length === 0) return state;
      operation = { type: "clear-ink", removed: state.document.objects };
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
  const shapes = operation.type === 'add-shape' ? action.type === 'undo'
    ? (state.document.shapes ?? []).filter(s => s.id !== operation.object.id)
    : [...(state.document.shapes ?? []), operation.object] : state.document.shapes;
  return {
    document: { ...state.document, ...(shapes ? { shapes } : {}), objects, revision: state.document.revision + 1 },
    past, future,
  };
}
