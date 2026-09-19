# Phase 0–1: baseline and reliable whiteboard

Implemented on `gpt6-astra-rework`. No commit, push, backend, authentication, textbook ingestion, or Phase 2 workspace redesign. Baseline HEAD and main: `133c2ad7df2f72fad746b9536b2d9283ecd872ef`.

## Implemented architecture

React owns committed documents, settings and interaction availability. A gesture-scoped ToolManager owns a mutable transient ink buffer. Konva renders committed objects plus an imperative draft on the same ink layer. This keeps destination-out eraser previews consistent with committed eraser operations.

```text
ClassroomProvider (session identity)
  → DrawingProvider keyed by sessionId
    → documentReducer (document + bounded operation history)
    → DrawingCanvas (Pointer Events adapter)
      → ToolManager (one active pointer / one stable tool)
        → PenTool or EraserTool → InkTool draft
      → Konva committed ink + frame-scheduled draft
```

The active tool is created only in begin(), and another begin cannot replace an active gesture. No configure effect depends on React callbacks. Do not restore render-time tool reconfiguration: it was the historical cause of interrupted pen strokes.

## Document and ownership

DrawingDocument contains schemaVersion 1, UUID id, owner (sessionId/classId/subjectId), local revision and ordered ink objects. Ink has id, kind, tool, color, width and flat point coordinates. Shape types remain experimental; they are not part of the active document union.

Each class/subject selection or Quick Workspace creates a new transient session and resets the document and its history. Returning from a lesson shelf to Whiteboard inside the same session preserves the board. Selecting even the same class/subject again intentionally creates a new session; the app does not retain a per-subject archive.

Class/subject fields currently use existing catalog labels. They are session scoping hints, not backend authority or final stable catalog IDs. UUID session/document IDs provide the bridge to future TeachingSession persistence.

Reloading, closing the application or starting a new context discards this in-memory board. The Draw panel states this policy. Durable saves, old-session restoration, offline storage and annotations by lesson/page are not implemented.

## Input and rendering lifecycle

- Primary pointer down: snapshot tool settings; create draft; capture pointer.
- Matching moves: append coalesced samples where available, ignore duplicate positions; schedule at most one pending draft frame.
- Matching pointer up, including release outside the surface: include final clamped position, complete gesture, release capture, commit once.
- Pointer cancel, capture loss, Escape, window blur, document hiding, resize or unmount: discard draft; no document operation.
- Additional pointers cannot replace or finish the active interaction.
- Capture failure cancels the interaction and displays an error.
- Mouse movement with no buttons while an interaction appears active cancels stale input.

The native surface has touch-action:none. One-point gestures render as circles so both pen dots and eraser taps are visible/effective. Pen and Eraser share the same lifecycle. Eraser width remains six times the pen width; erasing is ordered ink compositing, not removal of future images or text.

Only the mutable draft changes on pointer movement. It is copied for Konva at animation-frame time, and copied into document ownership on commit. Provider updates occur on begin/end, settings and completed actions, not on every move. Memoized committed InkObject components retain stable stroke references.

## History

Operations are add-ink and clear-ink. Undo applies the inverse; Redo reapplies. The new branch discards the old future. Clear stores the previous ordered ink array as its reversible payload, without copying all stroke points. Empty document Clear is a no-op and does not remove the redo branch.

History is limited to 100 operations to bound retained actions; older visible ink is not removed when the limit is reached. This is not a bound on total drawing size. No partial stroke is recorded at pointer-down. Revisions advance on commit, Undo, Redo and nonempty Clear; revisions are local and are not future server revision numbers.

The native confirmation dialog focuses Cancel, traps modal focus, supports Escape and restores prior focus where that control remains focusable. Undo can restore a confirmed Clear. Empty/active-gesture actions are disabled in the UI.

## Baseline and dependencies

- Fixed audited unused imports and replaced the incomplete drawing/provider APIs with typed implementations.
- Enabled strict TypeScript and unchecked-index checking; added a strict test configuration.
- Removed temporary drawing logs. The current src tree has no console calls.
- Added Vitest for pure document/tool tests and Playwright for real canvas pixels, capture, modal and ownership checks. No new production dependency.
- Kept dev/build/preview behavior and commands.
- Applied compatible lockfile security updates through npm audit fix --ignore-scripts, without a forced major upgrade.
- Aligned the CanvasRenderer import and physical folder capitalization with the already-tracked Git path src/components/Canvas. An intermediate type/build run reported TS1261 before the physical folder casing was aligned; final validation passes.
- Existing ShapeTool/BaseTool and legacy viewers remain available for future work but are outside the active drawing flow. Rectangle/Text controls were removed from the active palette; placeholder dock and Smart Tools actions are disabled.
- The panel body can scroll and the close target is at least 48 CSS pixels. The wider workspace layout has not been redesigned.

## Validation performed

| Exact command | Final result |
| --- | --- |
| npm run typecheck | PASS: application, Node/config and test TypeScript projects. |
| npm run lint | PASS: ESLint. |
| npm test | PASS: 14 tests, 2 files. |
| npm run test:e2e | PASS: 10 Chromium browser tests. |
| npm run build | PASS with WARNING: main JavaScript chunk 563.04 kB, gzip 174.71 kB; exceeds Vite's 500 kB warning threshold. |
| npm audit --json | PASS: fresh registry audit reports 0 vulnerabilities. This is not a comprehensive security review. |
| git diff --check | PASS: no whitespace errors; Git emits Windows LF/CRLF conversion notices. |
| npm run dev -- --host 127.0.0.1 --port 5173 --strictPort | PASS: local development server started successfully. |

Installation/setup commands executed: npm install --save-dev vitest @playwright/test; npx playwright install chromium; npm audit fix --ignore-scripts. Test packages and Chromium are development dependencies/tooling.

Some initial sandbox runs could not access the registry cache or spawn build/browser worker processes (ENOTCACHED/EPERM). The same normal commands were rerun with approved execution permissions. Those environmental failures were not treated as passing tests. The fresh online audit also superseded an incomplete cached audit result.

### Automated coverage

Vitest: first-stroke Undo/Redo, repeated history traversal, redo branching, Clear/Undo Clear/Redo Clear, empty Clear, defensive point copies, dots, document isolation, revisions, bounded history, invalid/duplicate geometry; stable active tool across repeated begin/settings attempts, cancellation, second-pointer isolation and Pen/Eraser/Pen lifecycle.

Playwright: full rendered stroke recovery, repeated history and branching; Clear Cancel/Escape/Confirm, focus, Undo/Redo Clear; dot/color/width pixel assertions; live and committed eraser compositing, Undo/Redo erase and rapid Pen/Eraser/Pen; curved input spanning a provider rerender; no draft history; native pointer capture and outside release; injected pointercancel/capture-loss events; Chromium touch input and cancellation; new-context document isolation and same-session shelf return; console/page errors and failed HTTP resources in the tested workspace flow.

Mouse and touch pixel checks run at the suite's 1280×900 viewport, device scale 1. They are not visual proof at Android panel resolution.

### Hands-on browser observations

Used the in-app browser at its approximately 864×742 viewport and operated real UI controls:

- STD 5 → Science → Workspace opened with correct class/subject.
- Click produced a black dot; consecutive drags produced continuous visible strokes.
- Setting red and width 12 produced a red dot and visibly wider line.
- Erasing the center removed that section; Undo restored it, Redo removed it again.
- Clear showed a modal with Cancel focused. Cancel preserved ink; Confirm emptied the board; Undo restored the complete composition; Redo cleared it again.
- Drawing options remained reachable with scrolling at the smaller viewport.
- Captured browser warnings/errors were empty in this flow. Automated resource checks also passed.
- Development hot reload during the import-casing correction reset the temporary session, consistent with the absence of persistence.

Outside release, rapid switching, long curved input, touch cancellation, branching and unrelated-context isolation were verified by automated browser interaction, not claimed as separate hands-on tests.

## Remaining limitations and device unknowns

No physical Android panel was available. Confirm manufacturer/model, Android and browser/WebView versions, update policy, browser vs packaged delivery, RAM/GPU, screen resolution/device pixel ratio, stylus vs finger event behavior, pointer capture, palm rejection, multitouch, OS edge gestures, native color-picker usability, dialog support, secure-context deployment and storage eviction behavior.

Current touch emulation verifies Chromium input plumbing only. Pressure, tilt, palm rejection and collaborative multi-pointer drawing are not implemented. crypto.randomUUID requires an appropriate secure browser context; use HTTPS for school deployment rather than assuming plain LAN HTTP behaves like localhost.

There is no pan/zoom/world-space model. Coordinates remain canvas-local; resizing cancels the active draft and may clip previously drawn ink on smaller surfaces. Fixed world dimensions and viewport transforms should be designed before cross-device persistence.

Konva still redraws the ink layer, including committed ink, when the draft changes. Very long strokes still copy an increasing point array per frame, and many objects/eraser masks increase redraw cost. History is bounded but document geometry is not. No panel latency, memory soak or large-document benchmark was performed; no FPS guarantee is claimed.

Eraser masks remain objects even when they overlap no visible ink; “empty” in history/UI means no stored objects, not a rasterized blankness test. Geometric no-op detection and ink compaction are deferred.

The existing right sidebar, bottom shelf and small category labels reduce usable board area and distance readability. Native color/width controls and fixed-width options panel need physical-panel validation. Legacy shelf content remains scaffolding, not verified lessons. Keyboard drawing/accessibility alternatives are not implemented.

## Preserve and next work

Preserve gesture-scoped tools, draft/document separation, ink compositing order, operation history, explicit ownership, visible dots and regression tests.

The foundation is ready for review and a controlled whiteboard demonstration. It is not yet a recoverable teaching-session product. Next is the approved Phase 2 teacher-workspace work, followed by separately authorized persistence/session and backend stages. Do not advertise saving or offline recovery until implemented and tested.

See backend-architecture.md for the proposed TypeScript modular monolith, data placement, secure identity, versioned saves and offline boundaries.

## Review manifest and Git status

23 tracked files modified; 10 new files; no files removed; no staged changes. Existing tracked diff: 742 insertions, 921 deletions (excludes new files). HEAD and main remain at the baseline commit.

### Created

- docs/backend-architecture.md
- docs/phase-0-1.md
- playwright.config.ts
- src/drawing/ToolManager.test.ts
- src/drawing/document.test.ts
- src/drawing/document.ts
- src/drawing/tools/InkTool.ts
- tests/e2e/whiteboard.spec.ts
- tsconfig.test.json
- vitest.config.ts

### Modified

- .gitignore
- README.md
- package-lock.json
- package.json
- src/components/Canvas/CanvasRenderer.tsx
- src/components/common/ConfirmDialog.tsx
- src/components/layers/AnnotationLayer.tsx
- src/components/workspace/DrawingCanvas.tsx
- src/components/workspace/FloatingPanel.tsx
- src/components/workspace/SmartTools.tsx
- src/components/workspace/ToolDock.tsx
- src/components/workspace/panels/DrawPanel.tsx
- src/drawing/ToolManager.ts
- src/drawing/tools/EraserTool.ts
- src/drawing/tools/PenTool.ts
- src/pages/Home/Home.tsx
- src/pages/Workspace/Workspace.tsx
- src/store/ClassroomProvider.tsx
- src/store/DrawingProvider.tsx
- src/store/classroom-context.ts
- src/store/drawing-context.ts
- src/types/drawing.ts
- tsconfig.app.json

The physical Canvas directory capitalization was aligned to its existing Git spelling; no tracked file move was introduced.
