import { describe, expect, it } from 'vitest';
import { fractionDropTarget, fractionOrigin, fractionScene } from './fractionScene';
import { FRACTION_PIECE_UNITS, fractionLanes } from '../../contracts/fractions';

describe('fraction scene geometry', () => {
  it('uses equal wholes and unchanged half/quarter widths in the tray and lanes', () => {
    expect(fractionScene.width).toBe(4 * fractionScene.unit);
    expect(FRACTION_PIECE_UNITS[0] * fractionScene.unit).toBe(2 * FRACTION_PIECE_UNITS[2] * fractionScene.unit);
    for (let index = 0; index < 6; index++) {
      const p = fractionOrigin(index, null);
      expect(p.x + FRACTION_PIECE_UNITS[index]! * fractionScene.unit).toBeLessThanOrEqual(1200);
      expect(p.y + fractionScene.height).toBeLessThanOrEqual(675);
      expect(fractionDropTarget(index, p.x, p.y)).toBeNull();
    }
  });
  it('snaps each legal placement without changing piece size or integer position', () => {
    for (let index = 0; index < 6; index++) for (const lane of fractionLanes) for (let start = 0; start <= 4 - FRACTION_PIECE_UNITS[index]!; start++) {
      const target = { lane, start }, p = fractionOrigin(index, target);
      expect(fractionDropTarget(index, p.x, p.y)).toEqual(target);
      expect(fractionDropTarget(index, p.x + 35, p.y - 15)).toEqual(target);
    }
  });
  it('rejects ambiguous, outside and oversized drops rather than clamping into a lane', () => {
    for (const [x, y] of [[860, 128], [370, 128], [-20, 128], [260, 190], [260, 700], [NaN, 128], [260, Infinity]])
      expect(fractionDropTarget(0, x!, y!)).toBeUndefined();
    expect(fractionDropTarget(9, 260, 128)).toBeUndefined();
    expect(fractionDropTarget(0, 259.9999, 128)).toEqual({ lane: 'top', start: 0 });
    expect(fractionDropTarget(2, 860, 128)).toEqual({ lane: 'top', start: 3 });
  });
});
