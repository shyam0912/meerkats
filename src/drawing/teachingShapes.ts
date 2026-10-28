import { teachingShapeSchema, type TeachingShape, type TeachingShapeType } from '../../contracts';
import type { Point } from './tools/InkTool';
import { boxCorners } from '../../contracts/shape-geometry';

export interface ShapeSettings { shape: TeachingShapeType; color: string; width: number }
export function createShape(id: string, settings: ShapeSettings, start: Point, end: Point): TeachingShape | null {
  const base = { id, kind: 'shape' as const, color: settings.color, width: settings.width };
  const dx = end.x - start.x; const dy = end.y - start.y;
  let shape: TeachingShape;
  if (settings.shape === 'line' || settings.shape === 'arrow') {
    if (Math.hypot(dx, dy) < 2) return null;
    shape = { ...base, shape: settings.shape, start: { ...start }, end: { ...end } };
  } else {
    if (Math.abs(dx) < 2 || Math.abs(dy) < 2) return null;
    if (settings.shape === 'circle') {
      const radius = Math.min(Math.abs(dx), Math.abs(dy)) / 2;
      shape = { ...base, shape: 'circle', center: { x: start.x + Math.sign(dx) * radius, y: start.y + Math.sign(dy) * radius }, radius };
    } else shape = { ...base, shape: settings.shape,
      origin: { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) }, size: { width: Math.abs(dx), height: Math.abs(dy) } };
  }
  return teachingShapeSchema.safeParse(shape).success ? shape : null;
}

/** Shared vector geometry for live rendering, thumbnails and PNG export. No ink masks apply here. */
export function shapePath(s: TeachingShape): string {
  if (s.shape === 'line' || s.shape === 'arrow') {
    const { start: a, end: b } = s;
    const line = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
    if (s.shape === 'line') return line;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const head = Math.min(length * .3, Math.max(14, s.width * 3));
    const ux = (b.x - a.x) / length; const uy = (b.y - a.y) / length;
    return `${line} M ${b.x - head * ux - head * .5 * uy} ${b.y - head * uy + head * .5 * ux} L ${b.x} ${b.y} L ${b.x - head * ux + head * .5 * uy} ${b.y - head * uy - head * .5 * ux}`;
  }
  if (s.shape === 'circle') {
    const { x, y } = s.center; const r = s.radius;
    return `M ${x - r} ${y} A ${r} ${r} 0 1 0 ${x + r} ${y} A ${r} ${r} 0 1 0 ${x - r} ${y} Z`;
  }
  const { x, y } = s.origin; const { width: w, height: h } = s.size;
  if (s.rotation) {
    const [a, b, c, d] = boxCorners(s) as [Point, Point, Point, Point];
    const points = s.shape === 'rectangle' ? [a, b, c, d] : [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, c, d];
    return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ') + ' Z';
  }
  return s.shape === 'rectangle' ? `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`
    : `M ${x + w / 2} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
}

/** One immutable settings snapshot per gesture, separate from the proven ink ToolManager. */
export class ShapeInteraction {
  private active: { pointerId: number; id: string; start: Point; settings: ShapeSettings } | null = null;
  draft: TeachingShape | null = null;
  get pointerId() { return this.active?.pointerId ?? null; }
  begin(pointerId: number, id: string, settings: ShapeSettings, start: Point) {
    if (this.active) return false;
    this.active = { pointerId, id, settings: { ...settings }, start: { ...start } }; this.draft = null; return true;
  }
  move(pointerId: number, end: Point) {
    if (this.active?.pointerId !== pointerId) return;
    const { id, settings, start } = this.active;
    this.draft = createShape(id, settings, start, end);
  }
  complete(pointerId: number, end: Point) {
    if (this.active?.pointerId !== pointerId) return null;
    this.move(pointerId, end); const shape = this.draft; this.cancel(); return shape;
  }
  cancel() { this.active = null; this.draft = null; }
}
