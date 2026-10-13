import type { LensState } from '../../../contracts/lens';

/** Ideal thin lens in air. x increases along light travel; object is at x=-distance.
 * Equivalent to Cartesian 1/f = 1/v - 1/u, with u=-distance. */
export function solveLens({ lens, distance, focalLength }: Pick<LensState, 'lens' | 'distance' | 'focalLength'>) {
  if (!Number.isFinite(distance) || distance <= 0 || !Number.isFinite(focalLength) || focalLength <= 0)
    throw new RangeError('Distances must be finite and positive');
  const f = lens === 'convex' ? focalLength : -focalLength;
  if (Math.abs(distance - f) < 1e-9) return { kind: 'infinity' as const, f, imageDistance: null, magnification: null };
  const imageDistance = f * distance / (distance - f);
  return { kind: imageDistance > 0 ? 'real' as const : 'virtual' as const, f, imageDistance, magnification: -imageDistance / distance };
}

// Two independent paraxial rays determine the image; negative x is a back-extension.
export function rayHeight(x: number, ray: 'parallel' | 'central', distance: number, signedFocalLength: number, height = 15) {
  return ray === 'parallel' ? height * (1 - x / signedFocalLength) : -height * x / distance;
}
