import { describe, expect, it } from 'vitest';
import { rayHeight, solveLens } from './optics';
import { imageViewport } from './imageViewport';
import { constrain } from '../interaction/useAxisDrag';
import { initialLensState, lensStateSchema } from '../../../contracts/lens';
import { physicsVersion, PHYSICS } from '../../../contracts/physics';
import { bundledCatalog } from '../../../contracts/catalog-content';
import { initialProgress, validProgress } from '../../../contracts/lesson';
import { createLessonSession, sessionReducer } from '../../drawing/session';
import { serializeSession, deserializeSession } from '../../persistence/serialization';

describe('thin-lens calculation and construction', () => {
  it.each([[75, 37.5, -.5], [50, 50, -1], [40, 200 / 3, -5 / 3], [10, -50 / 3, 5 / 3]])('convex object at %s cm', (distance, v, m) => {
    const result = solveLens({ ...initialLensState, distance });
    expect(result.imageDistance).toBeCloseTo(v); expect(result.magnification).toBeCloseTo(m);
  });
  it('matches SCERT page 39 example using Cartesian signs', () => {
    expect(solveLens({ lens: 'convex', distance: 90, focalLength: 22.5 }).imageDistance).toBe(30);
  });
  it('has no finite image at F and changes sign across F without clamping the result', () => {
    expect(solveLens({ ...initialLensState, distance: 25 })).toMatchObject({ kind: 'infinity', imageDistance: null, magnification: null });
    expect(solveLens({ ...initialLensState, distance: 24.999 }).imageDistance).toBeLessThan(-100000);
    expect(solveLens({ ...initialLensState, distance: 25.001 }).imageDistance).toBeGreaterThan(100000);
  });
  it('concave images stay virtual, upright and diminished throughout allowed distances', () => {
    for (let distance = 5; distance <= 120; distance++) for (let focalLength = 10; focalLength <= 50; focalLength++) {
      const result = solveLens({ lens: 'concave', distance, focalLength });
      expect(result.kind).toBe('virtual'); expect(result.imageDistance).toBeGreaterThan(-focalLength);
      expect(result.magnification).toBeGreaterThan(0); expect(result.magnification).toBeLessThan(1);
    }
  });
  it('both rays intersect at the calculated image tip for real and virtual cases', () => {
    for (const lens of ['convex', 'concave'] as const) for (const distance of [5, 24, 26, 50, 120]) {
      const result = solveLens({ ...initialLensState, lens, distance });
      for (const ray of ['parallel', 'central'] as const)
        expect(rayHeight(result.imageDistance!, ray, distance, result.f)).toBeCloseTo(15 * result.magnification!);
    }
  });
  it('bounds user input, rejects invalid payloads and rejects invalid calculations', () => {
    expect(constrain(-50, 5, 120)).toBe(5); expect(constrain(999, 5, 120)).toBe(120);
    for (const distance of [0, NaN, Infinity, 121]) expect(lensStateSchema.safeParse({ ...initialLensState, distance }).success).toBe(false);
    expect(() => solveLens({ ...initialLensState, distance: 0 })).toThrow(RangeError);
  });
});
describe('lens activity ownership', () => {
  it('adds stable records without replacing the Chemistry lesson', () => {
    expect(bundledCatalog.lessons.map(l => l.id)).toContain(PHYSICS.lesson);
    expect(new Set(bundledCatalog.nodes.map(n => n.id)).size).toBe(bundledCatalog.nodes.length);
    expect(physicsVersion.provenance.reviewStatus).toBe('teacher-review-pending');
  });
  it('validates persisted runtime against the pinned activity kind and bounds', () => {
    const progress = initialProgress(physicsVersion); expect(validProgress(physicsVersion, progress)).toBe(true);
    progress.states[PHYSICS.activity] = { ...initialLensState, distance: 121 };
    expect(validProgress(physicsVersion, progress)).toBe(false);
  });
  it('round-trips lens changes without modifying whiteboard or annotation histories', () => {
    const identity = { id: crypto.randomUUID(), lessonVersionId: PHYSICS.version, context: { classId: '50000000-0000-4000-8000-000000000002', subjectId: PHYSICS.subject, classLabel: 'Standard X', subjectLabel: 'Physics' } };
    const session = createLessonSession({ sessionId: identity.id, classId: identity.context.classId, subjectId: PHYSICS.subject }, physicsVersion);
    const changed = sessionReducer(session, { type: 'activity-state', id: PHYSICS.activity, state: { ...initialLensState, lens: 'concave' } });
    expect(changed.whiteboard).toBe(session.whiteboard); expect(changed.annotations).toBe(session.annotations);
    expect(deserializeSession(serializeSession(changed, identity, null)).lesson).toEqual(changed.lesson);
  });
});

describe('image visibility is separate from optical calculation', () => {
  it.each([
    [120, 600 / 19, -5 / 19, 'real'], // beyond 2F
    [50, 50, -1, 'real'], // at 2F
    [40, 200 / 3, -5 / 3, 'real'], // between F and 2F
    [26, 650, -25, 'real'], // just outside F
    [24, -600, 25, 'virtual'], // just inside F
    [10, -50 / 3, 5 / 3, 'virtual'],
  ] as const)('retains Cartesian positions and magnification at d=%s', (distance, v, m, kind) => {
    const result = solveLens({ ...initialLensState, distance });
    expect(result.kind).toBe(kind); expect(result.imageDistance).toBeCloseTo(v); expect(result.magnification).toBeCloseTo(m);
    const view = imageViewport(result.imageDistance, result.magnification)!;
    expect(view.x).toBeCloseTo(600 + v * 4); expect(view.y).toBeCloseTo(230 - m * 60);
  });
  it('points toward a finite image beyond both right and bottom without moving the image', () => {
    const view = imageViewport(650, -25)!;
    expect(view).toMatchObject({ x: 3200, y: 1730, outside: true, direction: 'right and below' });
    expect(view.edgeY).toBe(368); expect(view.edgeX).toBeLessThan(view.x);
    expect((view.edgeY - 230) / (view.edgeX - 600)).toBeCloseTo((view.y - 230) / (view.x - 600));
  });
  it('distinguishes a virtual image outside left/above from an image only below the view', () => {
    expect(imageViewport(-600, 25)).toMatchObject({ outside: true, direction: 'left and above' });
    expect(imageViewport(87.5, -2.5)).toMatchObject({ outside: true, direction: 'below' });
    expect(imageViewport(-18.75, .25)).toMatchObject({ outside: false, x: 525, y: 215 });
  });
  it('does not create a finite boundary image at the focal point', () => {
    const result = solveLens({ ...initialLensState, distance: 25 });
    expect(imageViewport(result.imageDistance, result.magnification)).toBeNull();
    expect(rayHeight(50, 'parallel', 25, 25) - rayHeight(0, 'parallel', 25, 25)).toBe(
      rayHeight(50, 'central', 25, 25) - rayHeight(0, 'central', 25, 25));
  });
});
