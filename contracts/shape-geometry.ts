/** Shared box geometry for validation, drawing, selection and export. Degrees, clockwise. */
export function boxCorners(shape: { origin: { x: number; y: number }; size: { width: number; height: number }; rotation?: number }) {
  const { width: w, height: h } = shape.size;
  const c = { x: shape.origin.x + w / 2, y: shape.origin.y + h / 2 };
  const angle = (shape.rotation ?? 0) * Math.PI / 180;
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => ({
    x: c.x + x! * Math.cos(angle) - y! * Math.sin(angle), y: c.y + x! * Math.sin(angle) + y! * Math.cos(angle),
  }));
}
