# V2-2C interactive Physics prototype

Review date: 2026-10-12. Branch: `meerkats-v2`.
Starting checkpoint: `badef9e8931f5a8223159cefc16aa85afd9870dd`.
Uncommitted implementation; no dependencies added.

## Implemented boundary

This is one continuous interactive reference experience, not a universal scientific simulation engine.
The generic layer provides constrained axis dragging and native range-property editing with local previews,
pointer capture, cancellation, keyboard operation and completed-gesture commits. Physics rules are separate
pure functions. Other subjects can reuse these input capabilities while supplying their own models and renderers.

`thin-lens` is an additive strict activity discriminator with a bounded runtime payload:
`{ kind, lens, distance, focalLength }`. The activity is lazy-loaded through the existing registry and host.
No drawing, document-history, serialization, synchronization or database-schema implementation was replaced.

Completed exploration changes use existing lesson progress persistence. Pointer movement updates only the
activity's local draft; it does not serialize progress or create drawing history. A gesture captures its start
value, coordinate scale and callbacks. Provider rerenders cannot reconfigure that active gesture. A resize,
Escape, pointer cancellation, lost capture, blur or visibility change cancels the draft. Release also checks
geometry synchronously, because browser resize events may arrive after pointerup. Teacher controls are locked
during a gesture. Native property controls retain keyboard semantics and commit pointer edits at release.

## Catalog and ownership

- Existing Kerala SCERT curriculum and Standard X IDs are reused unchanged.
- New Physics subject, Chapter 2 Lenses, one topic, one lesson definition and one immutable version use stable
  `60000000-...` IDs. Activity and scene IDs use `61000000-...` and `62000000-...` respectively.
- Existing Chemistry and developer demo publication payloads are unchanged.
- The new version is technically published for version pinning but explicitly **Prototype / teacher review pending**.
  It is not presented as academically validated content.
- The existing idempotent seed inserts the new records without a schema migration. The shared activity contract
  must be deployed to the API alongside the frontend before real API-backed lens sessions are used.
- Physics chapter selection opens its primary experience directly. Chemistry's existing discovery flow remains.
  If the Lenses chapter has multiple authored experiences, the presentation exposes an all-experiences entry.
  Direct topic routes remain usable. Failed or abandoned version loads do not intentionally launch sessions.
- Annotation retains existing lesson-version/activity/scene ownership. Whiteboard remains an independent document.
  Undo/Redo/Clear continue to operate on the active ink document only.

## Teaching surface and controls

The same 1200 x 675 logical scene, proportional fitting and annotation layer are retained. SVG renders rays,
lens and object beneath Konva ink. Explore gives input to the activity; Annotate makes its DOM subtree inert.
Whiteboard unmounts content while retaining committed lesson state and annotations. Ink is anchored to the
scene, not attached to a moving object. Moving the object in Explore does not move existing annotations.

A compact session header and scoped workspace styling apply to this continuous prototype. Existing Chemistry
workspace presentation is retained. Explore, Annotate, Whiteboard and Reset are functional. Focus removes
secondary session context while retaining modes and drawing controls; Escape exits it unless a modal is open
or ink is being drawn. Focus is not browser fullscreen and is not persisted.

One minimal discovery breakpoint correction keeps Chemistry and Physics side by side at 951-1100 CSS px.
The approved Home, foundation tokens and other discovery treatments remain unchanged.

## Academic model and source check

Reference: SCERT Kerala, Physics Standard X Part I, First Edition 2025, Chapter 2, printed pages 27-40.
The chapter text was inspected and page 39 was rendered to verify its Cartesian equation and worked example.
The official [Standard 10 index](https://scert.kerala.gov.in/standard-10/) was checked; its Physics link could
not be fetched by the web reader. The publisher-authored PDF was read from this
[textbook mirror](https://oxfordacademykerala.com/wp-content/uploads/2026/03/Physics_-PART-1-ENG.pdf).
[OpenStax's lens reference](https://openstax.org/books/physics/pages/16-3-lenses) provided a second check
of ray construction and real/virtual cases. No source artwork or passages are reproduced in the app.

- Cartesian convention: `u = -distance`, `f > 0` for convex, `f < 0` for concave.
- `1/f = 1/v - 1/u`; implementation uses `v = f * distance / (distance - f)` and `m = -v / distance`.
- The parallel and optical-centre rays meet at the computed image tip. Dashed paths are virtual back-extensions.
- At the convex focal point, emerging rays are parallel and there is no finite image. The display says infinity.
- Finite image tips outside the drawing window receive a directional boundary indicator and an explicit
  out-of-view notice. The image arrow is omitted there; calculated positions are never clamped into view.
- Object distance: 5-120 cm; focal-length magnitude: 10-50 cm; input step: 1 cm. The object height is fixed.
- This is an ideal paraxial thin-lens construction in air. Lens outline is schematic. It does not model aperture,
  finite lens thickness, aberrations, wavelength, diffraction, intensity, material or an actual physical apparatus.

## Initial prototype verification (2026-10-12)

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS, 85 tests (12 new) |
| `npm run test:e2e -- --workers=4` | Final run PASS, 62 tests (10 new), retries 0 |
| `npm run test:e2e:api` | PASS, 14 tests (1 new), retries 0 |
| `npm run build` | PASS; main-chunk size warning remains |
| `git diff --check` | PASS |
| server `npm run db:seed` | PASS; additive local development records |
| server `npm run typecheck` | PASS |
| server `npm test` | PASS, 29 tests |

New tests cover optical cases, the textbook worked example, ray intersections, invalid/bounded runtime,
session serialization, direct launch, mouse/touch, second-pointer isolation, outside release, cancellation,
resize, keyboard controls, native property gestures, modes, Focus, whiteboard independence, viewport bounds,
reload and API recovery on a fresh device. Existing assertions were retained. Two unit-test expected arrays
were expanded from Chemistry-only to the exact Chemistry-plus-Physics catalog.

Failures encountered are not hidden:

1. Sandbox subprocess restrictions initially prevented Vite/Vitest startup. Runs with normal process permissions worked.
2. The first unit run had two outdated Chemistry-only catalog expectations; these were updated as described above.
3. The first new-browser test run exposed SVG touch interception and two new-test locator mistakes. These were corrected.
4. The first full browser run caught subject overflow at 1024 x 600 and a pointerup/resize race. Both implementation issues were fixed.
5. A subsequent full run passed 61/62; the unchanged Chemistry 1920 x 1080 resize test sampled old and new geometry
   immediately after resize (320 px difference). It had passed in the preceding run and passed in the final 62/62 run.
   Its assertions were not changed. Treat this as an observed intermittent timing failure deserving separate follow-up.
6. Automatic approval review hit an account usage limit and did not execute one validation command. Validation resumed
   after the user asked to continue; the final results above are executed results.

The existing fallback tests deliberately abort activity imports and produce expected browser console errors.
These are distinct from unexpected runtime failures.

## Manual review and remaining limits

The live app was used through Home, Standard 10, Physics and chapter launch. Mouse dragging changed distance
75 to 40 cm, with image magnification and distance updating. Convex/concave switching, annotation over content,
Focus, Whiteboard drawing, Undo, Redo, Clear Cancel, Clear Confirm and Undo Clear were exercised. Content ink
remained after returning from Whiteboard. Keyboard, simulated touch and fresh-device recovery also have automated checks.

Reviewed at 1920 x 1080, 1280 x 720 and 1024 x 600. Controls fit; the smallest viewport necessarily has smaller
diagram labels than a full panel. Physical Android panels, stylus hardware, palm rejection and real classroom-distance
readability remain unverified. Screenshots are delivered outside the repository.

No frame-rate benchmark was performed. The scene uses a small SVG tree and local drafts, without full-session
writes per pointer movement. There is no scientific solver dependency or animation loop. The main bundle still
exceeds Vite's 500 kB warning threshold; the lens implementation and styles are separate lazy chunks.

Exploration is reversible by manipulating properties and Reset; there is no separate exploration Undo stack.
Drawing Undo remains independent. No Chemistry Lab, full Physics curriculum, authentication or universal object
editor is included. Academic teacher review and physical-panel testing should precede pilot claims.

## Reviewable file inventory

Modified (9):

- `contracts/catalog-content.ts`
- `contracts/lesson.ts`
- `src/activities/registry.ts`
- `src/components/workspace/TeacherControls.tsx`
- `src/pages/Catalog/Catalog.tsx`
- `src/pages/Catalog/catalog.css`
- `src/pages/Catalog/discovery.test.ts`
- `src/pages/Catalog/schoolPilot.test.ts`
- `src/pages/Workspace/Workspace.tsx`

Created (15, including the final refinement):

- `contracts/lens.ts`
- `contracts/physics.ts`
- `src/activities/interaction/RangeProperty.tsx`
- `src/activities/interaction/useAxisDrag.ts`
- `src/activities/kinds/ThinLens.tsx`
- `src/activities/kinds/thin-lens.css`
- `src/activities/physics/optics.ts`
- `src/activities/physics/imageViewport.ts`
- `src/activities/physics/optics.test.ts`
- `src/components/workspace/InteractiveSessionHeader.tsx`
- `src/pages/Workspace/interactive-workspace.css`
- `tests/helpers/physics.ts`
- `tests/e2e/physics.spec.ts`
- `tests/api-e2e/physics-session.spec.ts`
- `docs/v2-2c-interactive-physics.md`

Removed: none. All changes are unstaged. No commit or push.
Preserved branch heads: `main` = `133c2ad7df2f72fad746b9536b2d9283ecd872ef`;
`gpt6-astra-rework` = `9474adcf559b8e2dc5417d9052115fcc537eb3ed`.

## Final Physics refinement (2026-10-13)

The approved composition and interactions are retained. The image arrow now has a stronger purple stem,
a pale contrast outline, a marker centred exactly on the ray intersection, and a labelled leader.
Its location, orientation and height remain calculated values. Virtual stems stay dashed.
F/2F and object/image labels are stronger and have pale outlines; focal labels render above rays.
Parallel and centre rays have a compact protected colour key. The secondary heading is slightly smaller.

`imageViewport` separates physical image coordinates from a directional boundary marker. A finite image
outside the usable ray window has no image arrow inside the scene: double chevrons point toward its true
tip and the badge states left/right and above/below. Numeric image distance and magnification remain true.
The convex focal point has no finite image marker. The optical solver and gesture lifecycle are unchanged.

Added nine unit cases and three browser cases covering Cartesian signs, exact ray-tip positions, near-F
real/virtual images, directional boundaries, and the F singularity at all three supported viewports.
No existing assertions were weakened, skipped or removed.

| Final command | Executed result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS, 94 tests |
| `npm run test:e2e -- --workers=4` | PASS, 65 tests, no retries |
| `npm run test:e2e:api` | PASS, 14 tests, no retries |
| `npm run build` | PASS; existing main chunk warning |
| `git diff --check` | PASS; Git also reports LF/CRLF conversion warnings |
| server `npm run typecheck` | PASS |
| server `npm run lint` | PASS |
| server `npm test` | PASS, 29 tests |
| server `npm run build` | PASS |

Both full browser runs during refinement passed. The historical Chemistry resize timing failure noted
above did not recur. A manual-browser navigation call timed out although the page loaded; reconnecting
to that tab allowed normal review. The reviewed browser had no captured warnings/errors.

Manual review covered the discovery journey, convex diminished/magnified images, concave virtual images,
finite off-screen images on both sides of F, exact F, keyboard object/focal changes, reload recovery,
Annotate input blocking, Whiteboard return, Focus and Reset. Screenshots were captured at 1920 x 1080,
1280 x 720 and 1024 x 600 outside the repository. Existing automation additionally verifies dragging,
pointer cancellation, drawing, touch emulation, history and API recovery. Physical panels remain untested.

This refinement touches only `ThinLens.tsx`, `thin-lens.css`, `optics.test.ts`, `physics.spec.ts`, this report,
and the new `imageViewport.ts`. Backend, schema, Chemistry, dependencies and shared drawing/persistence
implementations are unchanged. The lazy ThinLens JS is 11.64 kB (4.01 kB gzip); CSS is 2.70 kB (0.94 kB gzip).
The full working tree remains nine modified tracked files and fifteen untracked files, with no removals.
