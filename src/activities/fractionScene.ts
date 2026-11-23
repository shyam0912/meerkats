import { FRACTION_PIECE_UNITS, fractionLanes, type FractionPlacement } from '../../contracts/fractions';

// Presentation coordinates only. The saved contract remains integer quarter-units.
export const fractionScene = { x: 260, width: 800, unit: 200, height: 100,
  lanes: { top: 128, bottom: 252 }, tray: 410 } as const;
export function fractionOrigin(index: number, placement: FractionPlacement | null) {
  return placement ? { x: fractionScene.x + placement.start * fractionScene.unit, y: fractionScene.lanes[placement.lane] }
    : index < 2 ? { x: 100 + index * 450, y: 422 } : { x: 100 + (index - 2) * 225, y: 542 };
}
/** Undefined means no drop; null explicitly means return to the tray. No clamping or resizing. */
export function fractionDropTarget(index: number, x: number, y: number): FractionPlacement | null | undefined {
  const units = FRACTION_PIECE_UNITS[index];
  if (!units || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x + units * fractionScene.unit > 1200 || y + fractionScene.height > 675) return undefined;
  for (const lane of fractionLanes) {
    if (Math.abs(y - fractionScene.lanes[lane]) > 34) continue;
    const start = Math.round((x - fractionScene.x) / fractionScene.unit) || 0;
    if (start < 0 || start + units > 4 || Math.abs(x - fractionScene.x - start * fractionScene.unit) > 60) return undefined;
    return { lane, start };
  }
  return y >= fractionScene.tray ? null : undefined;
}
