# WB-2B.2 — selection and transformation

Starting checkpoint: `6793ae913b549bed32d102a8fc068b0965d4ce3a`, branch `meerkats-v2`.

## Architecture and compatibility

The existing Whiteboard v3 stores shape data, not Konva nodes. Selection is component-local, keyed to the active document/page; it is never serialized or entered into history. Hit testing uses scene geometry in reverse stacking order, with screen-scaled touch tolerance. Closed shapes can be selected through their interior. Next shape provides keyboard access and access to occluded objects.

The only wire-contract extension is optional `rotation` in degrees (-180 through 180) on rectangle and triangle shapes. Their existing origin/size describe the unrotated box; rotation is clockwise about its center. Absence means zero, without inserting defaults while parsing. All existing v3 records, v1/v2 migration, annotation formats and pending request payloads retain their meaning and IDs. Lines/arrows rotate by updating endpoints; circles are rotationally symmetric and rotating one creates no action. No SQL migration, database version change, dependency or backend implementation change is needed.

Rotated geometry could not be represented by the former axis-aligned box contract. Both frontend and API must receive this shared contract update before using rotation. An older API rejects a rotated payload instead of stripping the field. Older strict frontend readers reject records containing rotation; their existing IndexedDB save guard refuses to overwrite an unreadable stored record. Stale remote saves still fail revision checks. This is compatibility with existing v3 data, not a promise that older clients can edit newly rotated geometry. Unchanged requests retain their mutation ID and exact payload; retries precede revision checks as before.

`contracts/shape-geometry.ts` provides shared rotated box corners for validation, rendering and selection. The shared shape path supplies live canvas rendering, thumbnails and PNG exports. Rotated bounds are validated, and the existing aggregate 2 MiB/10,000-objects-per-page guard runs before accepting edits. No persisted schema version is bumped.

## Interaction and history

`ShapeEditInteraction` snapshots the original shape and pointer at gesture start. Pointer moves update a draft, with requestAnimationFrame drawing on the existing shape node to retain stacking order. Only the small selection overlay rerenders for handle movement; the provider and committed document do not update on pointer moves. Capture, outside release, Escape, pointer cancellation, lost capture, window blur, visibility and resize cancellation share the existing canvas lifecycle. The ink ToolManager and Pen/Eraser implementations are unchanged.

Movement keeps geometry inside the logical 1200×675 scene. Corner resizing preserves the opposite corner and box rotation; circle resizing preserves equal dimensions. Line/arrow endpoints resize independently. Degenerate or out-of-bounds resize/rotation proposals retain the last valid preview. Rotation uses the center. Each successful completed gesture emits one `edit-shape` action; cancellation emits none. Selection and zero-change gestures create no history entries.

History stores immutable before/after shapes for edits and the original array index for deletion, so Undo restores stacking order as well as geometry. All actions use the existing page reducer and capacity gate. Clear continues to capture all ink, eraser masks and shapes as one action, preserving page identity, background and other pages. Page deletion/restoration retains transformed shapes. No synchronization, unload protection or save-status logic changes.

## Controls

- Select sits alongside Pen, Eraser and Shapes in standalone Whiteboard Pro.
- Tap a shape to select; tap empty canvas or press Escape to deselect.
- Drag the shape to move; drag corner/endpoint handles to resize; use the round handle to rotate.
- Next shape cycles through the current page. Delete shape removes only the selection.
- With the canvas focused, arrow keys move and Delete/Backspace deletes. Tab to a handle and use arrows to resize or rotate; Shift uses a one-unit/one-degree step instead of ten.
- Toolbar controls and contextual buttons are 60 CSS px high. Handles have 48 CSS px hit targets regardless of scene scale. Next shape and Delete shape occupy a reserved row of the bottom toolbar, outside the drawable canvas. No permanent sidebar.
- Selection handles, contextual controls and unfinished drafts never enter the PNG renderer.

## Scope and limitations

Single geometric-shape selection only: no ink selection, multiple selection, grouping, style editing, instruments or text. Circles do not visibly rotate. Transformations remain within the existing scene and cannot flip through zero size. Rotated boxes also retain the existing nonnegative-origin constraints. The rotation target is kept inside the scene; corner hit areas at scene edges may be partly clipped, with keyboard handles available as an alternative. Very small shapes may have overlapping touch targets; nearest-target selection and keyboard access resolve these cases.

Selection and Undo history remain memory-only across reload. Wait for confirmed device saving before forced exits; existing recovery/conflict safeguards remain in place. Physical Android-panel/stylus testing is not available and has not been claimed.

## Verification

New unit coverage checks all five shapes, exact hit geometry and overlap order, move/resize/rotate, symmetric-circle no-ops, bounds, draft lifecycle and secondary-pointer rejection, atomic edit/delete history, stacking restoration, Clear-all, page isolation, recoverable deletion, redo branching and capacity rejection. Persistence coverage checks transformed geometry and unchanged pending pre-edit retries. Backend coverage checks rotated v3 storage, exact old retries, stale-write rejection and invalid angles.

New browser coverage checks all five types at 1920×1080, 1280×720 and 1024×600, selection without history, live edits, cancellation/outside release, keyboard access, deletion, page reorder/delete/restore, Clear Cancel/Confirm/Undo/Redo, reload/Recent Boards and selection-free PNG bytes. API browser coverage checks edit/delete/Undo/Redo synchronization and fresh-device recovery. All earlier tests remain intact.

## Changed-file manifest

- Modified [contracts/index.ts](<D:/Project meerkats/Projects/Meerkats/contracts/index.ts>)
- Modified [server/tests/api.test.ts](<D:/Project meerkats/Projects/Meerkats/server/tests/api.test.ts>)
- Modified [src/components/whiteboard/WhiteboardPro.tsx](<D:/Project meerkats/Projects/Meerkats/src/components/whiteboard/WhiteboardPro.tsx>)
- Modified [src/components/whiteboard/whiteboard-pro.css](<D:/Project meerkats/Projects/Meerkats/src/components/whiteboard/whiteboard-pro.css>)
- Modified [src/components/workspace/DrawingCanvas.tsx](<D:/Project meerkats/Projects/Meerkats/src/components/workspace/DrawingCanvas.tsx>)
- Modified [src/components/workspace/DrawingToolbar.tsx](<D:/Project meerkats/Projects/Meerkats/src/components/workspace/DrawingToolbar.tsx>)
- Modified [src/components/workspace/TeachingSurface.tsx](<D:/Project meerkats/Projects/Meerkats/src/components/workspace/TeachingSurface.tsx>)
- Modified [src/drawing/document.ts](<D:/Project meerkats/Projects/Meerkats/src/drawing/document.ts>)
- Modified [src/drawing/teachingShapes.ts](<D:/Project meerkats/Projects/Meerkats/src/drawing/teachingShapes.ts>)
- Modified [src/persistence/shapes.test.ts](<D:/Project meerkats/Projects/Meerkats/src/persistence/shapes.test.ts>)
- Modified [src/store/DrawingProvider.tsx](<D:/Project meerkats/Projects/Meerkats/src/store/DrawingProvider.tsx>)
- Modified [src/store/drawing-context.ts](<D:/Project meerkats/Projects/Meerkats/src/store/drawing-context.ts>)
- Created [contracts/shape-geometry.ts](<D:/Project meerkats/Projects/Meerkats/contracts/shape-geometry.ts>)
- Created [docs/wb-2b-2.md](<D:/Project meerkats/Projects/Meerkats/docs/wb-2b-2.md>)
- Created [src/components/whiteboard/ShapeSelection.tsx](<D:/Project meerkats/Projects/Meerkats/src/components/whiteboard/ShapeSelection.tsx>)
- Created [src/drawing/shapeEditing.test.ts](<D:/Project meerkats/Projects/Meerkats/src/drawing/shapeEditing.test.ts>)
- Created [src/drawing/shapeEditing.ts](<D:/Project meerkats/Projects/Meerkats/src/drawing/shapeEditing.ts>)
- Created [tests/api-e2e/shape-editing.spec.ts](<D:/Project meerkats/Projects/Meerkats/tests/api-e2e/shape-editing.spec.ts>)
- Created [tests/e2e/shape-editing.spec.ts](<D:/Project meerkats/Projects/Meerkats/tests/e2e/shape-editing.spec.ts>)
- Created [tests/e2e/selection-toolbar.spec.ts](<D:/Project meerkats/Projects/Meerkats/tests/e2e/selection-toolbar.spec.ts>)
- Created [tests/helpers/shape-editing.ts](<D:/Project meerkats/Projects/Meerkats/tests/helpers/shape-editing.ts>)

12 modified, 9 created, no removed files, including the P2-01 correction below. No commits or pushes.

## Final validation results

| Command | Result |
|---|---|
| Root npm run typecheck | PASS |
| Root npm run lint | PASS |
| Root npm test | PASS — 146 tests in 18 files |
| Root npm run test:e2e -- --workers=2 | PASS — 102 tests, retries disabled |
| Root npm run test:e2e:api | PASS — 18 tests, retries disabled |
| Root npm run build | PASS — existing >500 kB chunk warning |
| Server npm run typecheck | PASS |
| Server npm run lint | PASS |
| Server npm test | PASS — 33 tests in 2 files |
| Server npm run build | PASS |
| git diff --check | PASS — line-ending notices only |

Added 14 frontend unit cases, 10 frontend E2E cases (including four P2-01 regressions), 1 API E2E case and 1 backend case. Existing tests were not weakened, removed or skipped.

During the original implementation validation, the first sandboxed full Vitest run could not read temporary SSR module files (ENOENT, no tests executed). The unchanged suite passed outside the sandbox. Sandboxed PostgreSQL loopback access failed with EACCES, and sandboxed Vite was unreachable to external Chrome; both ran normally outside the sandbox. Intentional failed-module regression tests log expected console errors. P2-01 reproduction and correction-run failures are recorded separately below.

Installed Chrome 155.0.8059.85 and the existing Playwright package were used. Independent browser interaction QA passed at all three supported viewports, with no page/console errors or scrolling. It verified draft-versus-commit revisions, movement/resize/rotation, stable IDs/styles, deletion and Undo, Clear-all, backgrounds, page isolation, Focus, reload and Recent Boards. Actual 2400×1350 PNG exports with selection active matched deselected exports byte-for-byte and were visually inspected. Chrome CDP touch simulation passed secondary-pointer isolation, cancellation and subsequent completed movement. This is not physical-panel or stylus validation.

Evidence is stored outside the repository in:
C:/Users/Jerry/.codex/visualizations/2026/09/18/01a0b307-d2be-7b92-9304-e08675a144a0/wb-2b-2/

- [Selected shape, 1920×1080](<C:/Users/Jerry/.codex/visualizations/2026/09/18/01a0b307-d2be-7b92-9304-e08675a144a0/wb-2b-2/selected-1920.png>)
- [Resized shape, 1280×720](<C:/Users/Jerry/.codex/visualizations/2026/09/18/01a0b307-d2be-7b92-9304-e08675a144a0/wb-2b-2/resized-1280.png>)
- [Rotated shape, 1024×600](<C:/Users/Jerry/.codex/visualizations/2026/09/18/01a0b307-d2be-7b92-9304-e08675a144a0/wb-2b-2/rotated-1024.png>)
- [Actual PNG export](<C:/Users/Jerry/.codex/visualizations/2026/09/18/01a0b307-d2be-7b92-9304-e08675a144a0/wb-2b-2/export-1024.png>)
- [Browser observations](<C:/Users/Jerry/.codex/visualizations/2026/09/18/01a0b307-d2be-7b92-9304-e08675a144a0/wb-2b-2/browser-report.json>)
- [Simulated touch observations](<C:/Users/Jerry/.codex/visualizations/2026/09/18/01a0b307-d2be-7b92-9304-e08675a144a0/wb-2b-2/touch-report.json>)

## P2-01 correction — contextual toolbar obstruction

Before editing, installed Chrome reproduced the northwest-resize obstruction for the rectangle at (20,20)–(200,120) at all three supported resolutions. Browser hit testing found the absolutely positioned contextual toolbar above the SVG handle, and the attempted drag left the saved revision unchanged. At 1024×600 the rotation handle for the rectangle at (640,190)–(840,345) was similarly covered by the toolbar's help text. Moving the rectangle away from that toolbar exposed a working handle, confirming pointer interception rather than a transformation calculation defect.

Next shape, Delete shape and selection guidance now render through a React portal into a dedicated bottom-toolbar row, outside the drawable scene. Selection state remains local to DrawingCanvas; its callbacks, selection overlay, gesture lifecycle, history, Clear-all, persistence and export are unchanged. The host is passed through TeachingSurface without changing scene coordinates. The row reserves the same height with and without a selected object while Select is active, avoiding canvas shifts during selection/deletion. Its buttons are 60 CSS px high. Portal pointer events remain stopped so interacting with contextual actions cannot begin a canvas gesture.

Correction-only manifest (relative to the existing uncommitted WB-2B.2 implementation):

- Modified `src/components/whiteboard/WhiteboardPro.tsx`: bottom-toolbar host.
- Modified `src/components/whiteboard/whiteboard-pro.css`: toolbar wrapping, contextual-row sizing and explicit text line heights.
- Modified `src/components/workspace/TeachingSurface.tsx`: forwards the host.
- Modified `src/components/workspace/DrawingCanvas.tsx`: portals existing actions into that host.
- Created `tests/e2e/selection-toolbar.spec.ts`: four focused regression cases.
- Updated this document.

Pre-correction file hashes confirm all other existing WB-2B.2 files remain unchanged. In particular, this correction changes no backend implementation, contracts, document schema, synchronization, dependencies, published content or drawing/transform algorithms.

The four new tests check all corner handle centers with browser hit testing, actual northwest/northeast/southeast/southwest resizing, the former rotation target, stable canvas bounds, Undo/Redo, keyboard rotation, touch completion/cancellation, Escape, disabled actions during gestures, page switching and reload. All three viewport tests check touch-target sizing and absence of viewport scrolling/clipping.

Independent fresh-profile Chrome interaction checks passed 33 scenario/viewport checks with no console or uncaught errors. They covered all five shape types, movement, supported resizing/rotation, cancellation and outside release, one action per completed edit, Clear-all, page reorder/deletion/restoration, refresh, Recent Boards, server recovery and API validation. Actual 2400×1350 PNGs were downloaded: selected and deselected exports were byte-identical, and visual inspection showed board content/background without selection controls. Full frontend E2E also passed existing Chemistry, Physics and drawing regressions.

Recorded correction-run issues: the first browser launch reached ERR_CONNECTION_REFUSED because local services were stopped; the existing services were started before reproduction. The first run of the new tests had three failures and one pass: selection help increased the footer by 2 px and moved the canvas. Explicit line heights corrected that layout defect without weakening assertions. The focused rerun passed all four, followed by the full 102-test frontend suite. After a pause, the prior API process was unavailable and PostgreSQL was stopped; the existing service was restarted and API E2E rerun with a saved log. A sandboxed Get-NetTCPConnection inspection was denied access to CIM; this was an environment inspection limitation, not an application failure.

The reserved contextual row reduces canvas height while Select is active. Existing limits remain: some edge-handle hit areas can be partly clipped by scene bounds, very small shapes can have overlapping handles, and Undo history is not restored after reload. The toolbar no longer overlays any canvas area. Mouse, keyboard and Chrome-simulated touch were tested; physical Android panels/styluses were not.

Correction evidence (outside the repository):

- [Before: toolbar intercepts northwest resize](<C:/Users/Jerry/.codex/visualizations/2026/09/18/01a0b307-d2be-7b92-9304-e08675a144a0/wb-2b-2-p2-01/toolbar-overlap-1920.png>)
- [After: corner resize at 1920×1080](<C:/Users/Jerry/.codex/visualizations/2026/09/18/01a0b307-d2be-7b92-9304-e08675a144a0/wb-2b-2-p2-01/after/corner-nw-1920.png>)
- [After: rotation at 1280×720](<C:/Users/Jerry/.codex/visualizations/2026/09/18/01a0b307-d2be-7b92-9304-e08675a144a0/wb-2b-2-p2-01/after/rotation-unobstructed-1280.png>)
- [After: rotation at 1024×600](<C:/Users/Jerry/.codex/visualizations/2026/09/18/01a0b307-d2be-7b92-9304-e08675a144a0/wb-2b-2-p2-01/after/rotation-unobstructed-1024.png>)
- [Actual PNG export](<C:/Users/Jerry/.codex/visualizations/2026/09/18/01a0b307-d2be-7b92-9304-e08675a144a0/wb-2b-2-p2-01/after/export-1280.png>)
- [Browser observations](<C:/Users/Jerry/.codex/visualizations/2026/09/18/01a0b307-d2be-7b92-9304-e08675a144a0/wb-2b-2-p2-01/after/acceptance-results.json>)
- [Final API regression log](<C:/Users/Jerry/.codex/visualizations/2026/09/18/01a0b307-d2be-7b92-9304-e08675a144a0/wb-2b-2-p2-01/api-final.log>)
