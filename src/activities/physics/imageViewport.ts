// Rendering coordinates only. The physical image remains at the unmodified v and m.
export function imageViewport(distance: number | null, magnification: number | null) {
  if (distance === null || magnification === null) return null;
  const x = 600 + distance * 4, y = 230 - 60 * magnification;
  const dx = x - 600, dy = y - 230;
  const outside = x < 40 || x > 1160 || y < 40 || y > 368;
  const factor = Math.min(1, dx > 0 ? 560 / dx : dx < 0 ? -560 / dx : Infinity,
    dy > 0 ? 138 / dy : dy < 0 ? -190 / dy : Infinity);
  const directions = [x < 40 ? 'left' : x > 1160 ? 'right' : '', y < 40 ? 'above' : y > 368 ? 'below' : ''].filter(Boolean);
  return { x, y, outside, direction: directions.join(' and '),
    edgeX: 600 + dx * factor, edgeY: 230 + dy * factor,
    angle: Math.atan2(dy, dx) * 180 / Math.PI };
}
