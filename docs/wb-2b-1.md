# WB-2B.1 — teaching shapes

## Model and compatibility

Whiteboards with ink only continue to serialize as version 2. The first accepted shape action upgrades that board to version 3, including an explicit `shapes` array on each live and deleted page. Undoing the shape does not downgrade the document. Shape data contains stable IDs, colour, width and discriminated geometry: line/arrow endpoints, rectangle/triangle origin and dimensions, or circle centre and radius. No Konva node state is serialized. These local geometric frames can be transformed by a future editing increment; selection, transforms and object deletion are not implemented here.

Version 1 whiteboards still follow the existing atomic original-backup migration into version 2. Version 2 documents need no eager conversion or extra serialized bytes. Existing page/document/session IDs, 1200 × 675 scene coordinates, annotation version 1 and published lesson content remain unchanged. Strict schemas accept versions 1–3 and reject unsupported versions and malformed geometry.

IndexedDB opens at database version 3, with the same stores, so older clients requesting versions 1 or 2 cannot overwrite newer data. Existing connections close on version change. There is no SQL migration, dependency change or new endpoint. The shared server validation accepts v3; the existing version downgrade check, optimistic revisions and idempotency receipts are unchanged. Deploy the compatible API before the new frontend. An older API will reject v3 saves; local durability remains available and synchronization reports attention rather than discarding data.

The persistence controller and unload protection are unchanged. Pending v1/v2 requests retain their original payload, mutation ID and base revision. They finish before a fresh v3 mutation is created. Capacity checks count shape geometry and v3 envelope overhead before accepting the action: 2 MiB per board, 20 pages including deleted pages, and 10,000 combined ink/shape objects per page. A rejected shape leaves the prior document and history intact.

## Input, rendering and history

The ink ToolManager, PenTool and EraserTool are unchanged. A separate gesture-scoped ShapeInteraction captures shape settings and ID on primary pointer-down. The existing drawing surface supplies pointer capture and logical coordinates. Moves update an animation-frame-rendered draft without broad context updates; pointer-up commits one shape. Escape, pointer cancellation, capture loss, blur, hidden-page transition and resize cancel the draft. Secondary pointers are ignored. Page/tool controls remain disabled during a gesture.

Shapes render in a separate layer above ink. Both historic and new destination-out eraser masks affect ink only; shapes and backgrounds are unaffected. Shared vector-path geometry is used by live rendering, thumbnails and PNG export. The extra live Konva layer is mounted only for a selected shape tool or existing shapes. Circle drags create a true circle inscribed in the drag rectangle; triangle drags create an upright isosceles triangle. Sub-two-unit or degenerate drags create nothing. Strokes at scene edges can be clipped by the existing scene boundary.

Per-page history orders completed ink and shape actions together. Undo/Redo retains the same shape ID and geometry. Page reordering, recoverable deletion and restoration retain shape data. Following the approved Clear behavior correction, Clear removes all ink, eraser masks and shapes on the current page in one reversible operation. Its confirmation asks “Clear everything on this page?”; page identity, background and other pages remain unchanged. Clear is available on shape-only pages and is a no-op on an empty page. Undo history remains memory-only after reload. Individual shape deletion and editing await WB-2B.2.

## Teacher UI

Standalone Whiteboard Pro adds a modal Shapes tray with five large labelled choices, an accessible colour control and independent Fine/Medium/Broad width presets. Closing or Escape returns focus to the trigger. The active type stays visible in the toolbar. Ink settings continue to edit pen/eraser settings; shape settings live in the Shapes tray. No tools are added to Classroom/annotation controls in this increment.

## Validation coverage

New unit tests cover geometry, reverse dragging, degeneracy, gesture settings stability, cancellation, secondary pointer rejection, mixed ordered history, branching, page Clear isolation, per-page operations, capacity, v1/v2/v3 contracts, IndexedDB recovery, immutable pending retries and old-client protection. The Clear correction adds mixed-content atomic Undo/Redo, shape-only/empty pages, background and other-page preservation, unchanged annotation serialization, pending pre-clear mutation preservation, thumbnail/PNG updates and local/remote recovery. It does not change the persisted schema or gesture lifecycle. Existing tests that inspect raw storage open the current IndexedDB version.

New browser tests use installed Chrome and actual mouse/CDP touch input for five shapes at all three supported resolutions, previews, modal focus, colour/width, PNG pixels after erasing over a shape, Undo/Redo, page deletion/restoration, reload, Recent boards, outside release, resize and cancellation. API coverage verifies v3 persistence and fresh-browser recovery; backend tests verify geometry validation, downgrade prevention, revisions, exact v2 retry and school isolation.

Physical Android-panel, stylus pressure and palm-rejection validation remain unavailable. The existing asynchronous-save limitation remains: a forced exit or choosing Leave before IndexedDB completes can lose unsaved work.

## Final review record

Frontend: typecheck and lint PASS; 127 unit tests in 16 files PASS; 90 frontend E2E PASS (two workers, retries disabled); 16 API E2E PASS (one worker, retries disabled); production build PASS. Backend: typecheck/lint PASS; 32 tests in 2 files PASS; production build PASS. No tests were removed or skipped for this increment. The frontend main bundle is 719.65 kB (218.60 kB gzip); the existing >500 kB warning remains.

The initial sandbox unit run could not import temporary transformed modules (ENOENT), so it executed no tests. Running the unchanged suite outside that sandbox passed. An intermediate backend typecheck exposed the migration helper's widened union return type; a narrow overload for v1 input corrected it while retaining the v1-to-v2 behavior. Final browser suites had no intermittent failures. Expected console errors in existing failed-module fallback tests are deliberately induced by those tests.

A separate installed-Chrome QA pass used keyboard selection and a completed emulated touch circle, then resized the same drawing through all three viewports. Rendered width/height measured 397/397, 235/235 and 189/190 pixels respectively (antialiasing rounding at the smallest size). Focus entry/exit and a real 2400 × 1350 PNG download passed; the downloaded image was visually inspected. No console errors were observed in that pass. Physical hardware is not tested. Screenshots live outside the repository.

Exact changed files (16 modified, 7 new, no deletions):

Modified:

- contracts/index.ts
- server/tests/api.test.ts
- src/components/whiteboard/PageNavigator.tsx
- src/components/whiteboard/WhiteboardPro.tsx
- src/components/whiteboard/whiteboard-pro.css
- src/components/workspace/DrawingCanvas.tsx
- src/components/workspace/DrawingToolbar.tsx
- src/drawing/document.ts
- src/drawing/exportBoard.ts
- src/drawing/whiteboard.ts
- src/persistence/database.ts
- src/persistence/migration.test.ts
- src/persistence/recentBoards.test.ts
- src/store/DrawingProvider.tsx
- src/store/drawing-context.ts
- tests/e2e/whiteboard-reliability.spec.ts

Created:

- docs/wb-2b-1.md
- src/components/whiteboard/ShapeMenu.tsx
- src/drawing/teachingShapes.test.ts
- src/drawing/teachingShapes.ts
- src/persistence/shapes.test.ts
- tests/api-e2e/whiteboard-shapes.spec.ts
- tests/e2e/whiteboard-shapes.spec.ts

All changes remain uncommitted on meerkats-v2 at 5ad7e68011f3a1b83a0745db763065bb870902ea. No protected branch, dependency manifest, SQL schema/migration, published lesson, backend endpoint or synchronization-controller implementation changed.

After the final page-help wording update, the eight page E2E tests and frontend production build passed again. git diff --check passed (line-ending notices only). The complete 90-test browser run and 16-test API run above passed before that text-only clarification.
