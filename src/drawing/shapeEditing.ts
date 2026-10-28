import { teachingShapeSchema, type TeachingShape } from '../../contracts';
import { boxCorners } from '../../contracts/shape-geometry';
import type { Point } from './tools/InkTool';

export type ShapeHandle = 'move' | 'start' | 'end' | 'nw' | 'ne' | 'se' | 'sw' | 'rotate';
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const turn = (p: Point, angle: number): Point => ({ x: p.x * Math.cos(angle) - p.y * Math.sin(angle), y: p.x * Math.sin(angle) + p.y * Math.cos(angle) });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function shapeFrame(s: TeachingShape) {
  if (s.shape === 'line' || s.shape === 'arrow') return { center: { x: (s.start.x + s.end.x) / 2, y: (s.start.y + s.end.y) / 2 },
    width: distance(s.start, s.end), height: 0, angle: Math.atan2(s.end.y - s.start.y, s.end.x - s.start.x) };
  if (s.shape === 'circle') return { center: s.center, width: s.radius * 2, height: s.radius * 2, angle: 0 };
  return { center: { x: s.origin.x + s.size.width / 2, y: s.origin.y + s.size.height / 2 }, width: s.size.width, height: s.size.height, angle: (s.rotation ?? 0) * Math.PI / 180 };
}
export function selectionCorners(s: TeachingShape): Point[] {
  if (s.shape === 'rectangle' || s.shape === 'triangle') return boxCorners(s);
  if (s.shape === 'line' || s.shape === 'arrow') return [s.start, s.end];
  const { x, y } = s.center; const r = s.radius;
  return [{ x: x - r, y: y - r }, { x: x + r, y: y - r }, { x: x + r, y: y + r }, { x: x - r, y: y + r }];
}
export function shapeHandles(s: TeachingShape, scale: number): { kind: ShapeHandle; point: Point }[] {
  const corners = selectionCorners(s); const frame = shapeFrame(s);
  const keys: ShapeHandle[] = corners.length === 2 ? ['start', 'end'] : ['nw', 'ne', 'se', 'sw'];
  // Keep the rotation target inside the scene; prefer above, otherwise below.
  const offset = frame.height / 2 + 52 / scale;
  const above = add(frame.center, turn({ x: 0, y: -offset }, frame.angle));
  const below = add(frame.center, turn({ x: 0, y: offset }, frame.angle));
  const margin = 24 / scale;
  const fits = (p: Point) => p.x >= margin && p.x <= 1200 - margin && p.y >= margin && p.y <= 675 - margin;
  const rotation = fits(above) ? above : fits(below) ? below : {
    x: Math.max(margin, Math.min(1200 - margin, above.x)), y: Math.max(margin, Math.min(675 - margin, above.y)),
  };
  return [...corners.map((point, i) => ({ kind: keys[i]!, point })), { kind: 'rotate', point: rotation }];
}
function segmentDistance(p: Point, a: Point, b: Point) {
  const v = sub(b, a); const w = sub(p, a); const length = v.x * v.x + v.y * v.y;
  const t = length ? Math.max(0, Math.min(1, (w.x * v.x + w.y * v.y) / length)) : 0;
  return distance(p, { x: a.x + t * v.x, y: a.y + t * v.y });
}
export function hitShape(s: TeachingShape, p: Point, tolerance: number): boolean {
  const pad = tolerance + s.width / 2;
  if (s.shape === 'line' || s.shape === 'arrow') {
    if (segmentDistance(p, s.start, s.end) <= pad) return true;
    if (s.shape === 'line') return false;
    const f = shapeFrame(s); const head = Math.min(f.width * .3, Math.max(14, s.width * 3));
    return [-1, 1].some(sign => segmentDistance(p, s.end, add(s.end, turn({ x: -head, y: sign * head / 2 }, f.angle))) <= pad);
  }
  if (s.shape === 'circle') return distance(p, s.center) <= s.radius + pad;
  const f = shapeFrame(s); const q = turn(sub(p, f.center), -f.angle);
  if (s.shape === 'rectangle') return Math.abs(q.x) <= f.width / 2 + pad && Math.abs(q.y) <= f.height / 2 + pad;
  const vertices = [{ x: 0, y: -f.height / 2 }, { x: f.width / 2, y: f.height / 2 }, { x: -f.width / 2, y: f.height / 2 }];
  const cross = vertices.map((a, i) => { const b = vertices[(i + 1) % 3]!; return (b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x); });
  return cross.every(n => n >= 0) || cross.every(n => n <= 0) || vertices.some((a, i) => segmentDistance(q, a, vertices[(i + 1) % 3]!) <= pad);
}
export function pickShape(shapes: readonly TeachingShape[], p: Point, tolerance: number) {
  return shapes.findLast(s => hitShape(s, p, tolerance));
}
export function pickHandle(s: TeachingShape, p: Point, scale: number) {
  // Choose nearest when tiny shapes have overlapping touch targets.
  return shapeHandles(s, scale).map(h => ({ ...h, distance: distance(h.point, p) })).sort((a, b) => a.distance - b.distance).find(h => h.distance <= 24 / scale)?.kind;
}
function valid(s: TeachingShape): TeachingShape | null {
  const f = shapeFrame(s);
  if (f.width < 2 || (s.shape !== 'line' && s.shape !== 'arrow' && f.height < 2)) return null;
  return teachingShapeSchema.safeParse(s).success ? s : null;
}
export function translateShape(s: TeachingShape, delta: Point): TeachingShape | null {
  const corners = selectionCorners(s);
  const dx = Math.max(-Math.min(...corners.map(p => p.x)), Math.min(1200 - Math.max(...corners.map(p => p.x)), delta.x));
  const dy = Math.max(-Math.min(...corners.map(p => p.y)), Math.min(675 - Math.max(...corners.map(p => p.y)), delta.y));
  const d = { x: dx, y: dy };
  return valid(s.shape === 'line' || s.shape === 'arrow' ? { ...s, start: add(s.start, d), end: add(s.end, d) }
    : s.shape === 'circle' ? { ...s, center: add(s.center, d) } : { ...s, origin: add(s.origin, d) });
}
export function rotateShape(s: TeachingShape, radians: number): TeachingShape | null {
  const f = shapeFrame(s);
  if (s.shape === 'circle') return s; // A circle is rotationally symmetric; no meaningless history entry.
  if (s.shape === 'line' || s.shape === 'arrow') return valid({ ...s, start: add(f.center, turn(sub(s.start, f.center), radians)), end: add(f.center, turn(sub(s.end, f.center), radians)) });
  const degrees = ((f.angle + radians) * 180 / Math.PI % 360 + 540) % 360 - 180;
  return valid({ ...s, rotation: degrees });
}
export function resizeShape(s: TeachingShape, handle: ShapeHandle, point: Point): TeachingShape | null {
  if (s.shape === 'line' || s.shape === 'arrow') return handle === 'start' || handle === 'end' ? valid({ ...s, [handle]: point }) : null;
  const index = ['nw', 'ne', 'se', 'sw'].indexOf(handle); if (index < 0) return null;
  const f = shapeFrame(s); const opposite = selectionCorners(s)[(index + 2) % 4]!;
  const local = turn(sub(point, opposite), -f.angle);
  const sx = index === 0 || index === 3 ? -1 : 1; const sy = index < 2 ? -1 : 1;
  let w = local.x * sx; let h = local.y * sy;
  if (w < 2 || h < 2) return null;
  if (s.shape === 'circle') w = h = Math.min(w, h);
  const center = add(opposite, turn({ x: sx * w / 2, y: sy * h / 2 }, f.angle));
  return valid(s.shape === 'circle' ? { ...s, center, radius: w / 2 }
    : { ...s, origin: { x: center.x - w / 2, y: center.y - h / 2 }, size: { width: w, height: h } });
}

/** Draft-only transform. Settings and the immutable original are captured at pointer-down. */
export class ShapeEditInteraction {
  private active: { pointerId: number; original: TeachingShape; handle: ShapeHandle; start: Point } | null = null;
  draft: TeachingShape | null = null;
  get pointerId() { return this.active?.pointerId ?? null; }
  begin(pointerId: number, original: TeachingShape, handle: ShapeHandle, start: Point) {
    if (this.active) return false;
    this.active = { pointerId, original, handle, start }; this.draft = original; return true;
  }
  move(pointerId: number, point: Point) {
    if (this.active?.pointerId !== pointerId) return;
    const { original, handle, start } = this.active;
    if (distance(point, start) < 2) { this.draft = original; return; }
    const c = shapeFrame(original).center;
    const next = handle === 'move' ? translateShape(original, sub(point, start)) : handle === 'rotate'
      ? rotateShape(original, Math.atan2(point.y - c.y, point.x - c.x) - Math.atan2(start.y - c.y, start.x - c.x))
      : resizeShape(original, handle, point);
    if (next) this.draft = next; // Keep the last valid preview at bounds; never commit degenerate geometry.
  }
  complete(pointerId: number, point: Point) {
    if (this.active?.pointerId !== pointerId) return null;
    this.move(pointerId, point); const draft = this.draft; const original = this.active.original; this.cancel();
    return JSON.stringify(draft) === JSON.stringify(original) ? null : draft;
  }
  cancel() { this.active = null; this.draft = null; }
}
