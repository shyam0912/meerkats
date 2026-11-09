import type { TeachingShape, TeachingText } from '../../contracts';
import { SCENE_BOUNDS } from './scene';
import { selectionCorners } from './shapeEditing';
import { arrowHead } from './teachingShapes';
import type { Point } from './tools/InkTool';

// Prefer down/right. Reverse near an edge, or use the room left on a tight axis.
function offset(min: number, max: number, limit: number) {
  const forward = Math.max(0, limit - max);
  const backward = Math.max(0, min);
  if (forward >= 24) return 24;
  return backward > forward ? -Math.min(24, backward) : forward;
}

export function duplicateObject(source: TeachingShape | TeachingText, id: string): TeachingShape | TeachingText {
  const points = source.kind === 'text'
    ? [source.origin, { x: source.origin.x + source.size.width, y: source.origin.y + source.size.height }]
    : selectionCorners(source);
  if (source.kind === 'shape' && source.shape === 'arrow') points.push(...arrowHead(source.start, source.end, source.width));
  const padding = source.kind === 'shape' ? source.width / 2 : 0;
  const shift = (axis: 'x' | 'y', limit: number) => {
    const coords = points.map(p => p[axis]);
    // Rotated boxes also store an unrotated origin constrained by the wire contract.
    const origin = 'origin' in source ? source.origin[axis] : coords[0]!;
    return offset(Math.min(origin, Math.min(...coords) - padding), Math.max(origin, Math.max(...coords) + padding), limit);
  };
  const dx = shift('x', SCENE_BOUNDS.width);
  const dy = shift('y', SCENE_BOUNDS.height);
  const move = (p: Point) => ({ x: p.x + dx, y: p.y + dy });
  if (source.kind === 'text') return { ...source, id, origin: move(source.origin) };
  if (source.shape === 'line' || source.shape === 'arrow') return { ...source, id, start: move(source.start), end: move(source.end) };
  if (source.shape === 'circle') return { ...source, id, center: move(source.center) };
  return { ...source, id, origin: move(source.origin) };
}
