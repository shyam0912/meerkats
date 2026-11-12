import type { TeachingShape, TeachingText } from '../../contracts';
import { selectionCorners } from './shapeEditing';
import { arrowHead } from './teachingShapes';
import type { Point } from './tools/InkTool';

export type EditableObject = TeachingShape | TeachingText;
export type Bounds = { left: number; top: number; right: number; bottom: number };
export const MAX_SELECTION = 100;
export function objectBounds(object: EditableObject): Bounds {
  const points = object.kind === 'text' ? [object.origin, { x: object.origin.x + object.size.width, y: object.origin.y + object.size.height }]
    : selectionCorners(object);
  if (object.kind === 'shape' && object.shape === 'arrow') points.push(...arrowHead(object.start, object.end, object.width));
  const pad = object.kind === 'shape' ? object.width / 2 : 0;
  return { left: Math.min(...points.map(p => p.x)) - pad, top: Math.min(...points.map(p => p.y)) - pad,
    right: Math.max(...points.map(p => p.x)) + pad, bottom: Math.max(...points.map(p => p.y)) + pad };
}
export function selectionBounds(objects: readonly EditableObject[]): Bounds {
  const bounds = objects.map(objectBounds);
  return { left: Math.min(...bounds.map(b => b.left)), top: Math.min(...bounds.map(b => b.top)),
    right: Math.max(...bounds.map(b => b.right)), bottom: Math.max(...bounds.map(b => b.bottom)) };
}
export const rectangle = (a: Point, b: Point): Bounds => ({ left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), right: Math.max(a.x, b.x), bottom: Math.max(a.y, b.y) });
export function enclosedObjects(objects: readonly EditableObject[], box: Bounds) {
  return objects.filter(o => { const b = objectBounds(o); return Math.max(0, b.left) >= box.left && Math.max(0, b.top) >= box.top &&
    Math.min(1200, b.right) <= box.right && Math.min(675, b.bottom) <= box.bottom; });
}
function translated(object: EditableObject, d: Point): EditableObject {
  const p = (point: Point) => ({ x: point.x + d.x, y: point.y + d.y });
  if (object.kind === 'text') return { ...object, origin: p(object.origin) };
  if (object.shape === 'line' || object.shape === 'arrow') return { ...object, start: p(object.start), end: p(object.end) };
  if (object.shape === 'circle') return { ...object, center: p(object.center) };
  return { ...object, origin: p(object.origin) };
}
export function moveObjects(objects: readonly EditableObject[], requested: Point): EditableObject[] {
  if (!objects.length) return [];
  if (!Number.isFinite(requested.x) || !Number.isFinite(requested.y)) return [...objects];
  const b = selectionBounds(objects);
  // Existing edge strokes may extend half a stroke outside paper. Never force a
  // jump at pointer-down; constrain a common delta without separating members.
  const origins = objects.flatMap(o => 'origin' in o ? [o.origin] : []);
  const left = Math.min(b.left, ...origins.map(p => p.x)); const top = Math.min(b.top, ...origins.map(p => p.y));
  const d = { x: Math.max(Math.min(0, -left), Math.min(Math.max(0, 1200 - b.right), requested.x)),
    y: Math.max(Math.min(0, -top), Math.min(Math.max(0, 675 - b.bottom), requested.y)) };
  // Sources are committed, validated objects. Translation preserves their size
  // and content; full schema/capacity validation happens once at batch commit.
  return objects.map(o => translated(o, d));
}
export function duplicateObjects(objects: readonly EditableObject[], newId = () => crypto.randomUUID()): EditableObject[] {
  if (!objects.length) return [];
  const b = selectionBounds(objects);
  const offset = (min: number, max: number, limit: number) => limit - max >= 24 ? 24 : min > limit - max ? -Math.min(24, Math.max(0, min)) : Math.max(0, limit - max);
  return moveObjects(objects, { x: offset(b.left, b.right, 1200), y: offset(b.top, b.bottom, 675) }).map(o => ({ ...o, id: newId() }));
}

/** One immutable gesture-start selection; never reconfigured by provider renders. */
export class MultiObjectInteraction {
  private active: { id: number; start: Point; objects: readonly EditableObject[]; marquee: boolean } | null = null;
  draft: readonly EditableObject[] | null = null;
  box: Bounds | null = null;
  get pointerId() { return this.active?.id ?? null; }
  begin(id: number, start: Point, objects: readonly EditableObject[], marquee = false) {
    if (this.active) return false;
    this.active = { id, start, objects, marquee }; this.draft = marquee ? null : objects; this.box = marquee ? rectangle(start, start) : null; return true;
  }
  move(id: number, point: Point) {
    if (this.active?.id !== id) return;
    const { start, objects, marquee } = this.active;
    if (marquee) this.box = rectangle(start, point);
    else this.draft = moveObjects(objects, { x: point.x - start.x, y: point.y - start.y });
  }
  complete(id: number, point: Point) {
    if (this.active?.id !== id) return null;
    this.move(id, point);
    const result = { box: this.box, objects: this.draft, original: this.active.objects };
    this.cancel(); return result;
  }
  cancel() { this.active = null; this.draft = null; this.box = null; }
}
