# Phase 2 — Teacher Workspace + Annotation Composition

Review milestone based on checkpoint 9e218c4 on gpt6-astra-rework. No backend, persistence, authentication, textbook content, activity engine, infinite canvas, packaging or Phase 3 work is included. No dependencies were added.

## Architecture and teacher flow

Class → Subject → Teaching Workspace (or Quick Workspace).

Workspace composes SessionHeader, TeachingSurface and TeacherControls. The header shows the actual class/subject or Quick workspace, the current surface context, and “Temporary session · Not saved”. It does not invent a topic or report a successful save.

The permanent ToolDock, FloatingPanel, SmartTools and LessonShelf are removed from the active workspace composition. Their source and the old viewers remain for later cleanup; they have not been rewritten or deleted.

Whiteboard, Content / Explore, and Annotate are direct bottom controls. Pen, Eraser, Ink settings, Undo, Redo and Clear are visible when drawing is relevant. There are no enabled placeholder actions, fake lesson navigation controls or fullscreen button. Primary controls have at least 56 CSS px height and 60 px minimum width, with meaningful names, pressed/disabled states and focus rings.

Ink settings is a native modal dialog containing labelled color/width inputs. Escape closes it and focus returns to the trigger. The existing Clear dialog is reused with document-specific wording and reversible clearing. Selected-tool feedback remains visible when settings are closed. A hover-contrast issue found during browser review was corrected.

## Surface composition

TeachingSurface measures the available scene area and proportionally fits a scene frame. Within that frame:

1. A DOM layer hosts the interactive original SVG/HTML shape fixture.
2. DrawingCanvas overlays transparent Konva ink.
3. Committed ink and the transient draft share one Konva ink layer, preserving live destination-out eraser compositing.

Content does not enter Konva. Erasing affects ink, not the underlying SVG or DOM. The whiteboard uses the same DrawingCanvas with a white background; there is no duplicate drawing engine.

In Explore, pointer-events:none on the annotation surface passes input to content, and the drawing surface is removed from sequential keyboard focus. In Annotate, the overlay captures drawing input and the underlying content subtree is inert, preventing pointer and keyboard activation. Switching mode changes both boundaries together. The current mode is indicated in both the bottom selection and the surface label.

Mode/tool/history controls are disabled during a gesture. Escape, cancellation, capture loss, unmount and resize still discard drafts. The tool remains stable across provider rerenders. Document changes key the canvas instance to discard transient interactions while preserving committed state in the session provider.

## Scene coordinates

Both whiteboard and the neutral scene use logical bounds 1200×675, stored in DrawingDocument.bounds. The fixture ID is neutral-shapes-v1. Content and ink share these bounds.

Fit scale = min(available width / 1200, available height / 675).

The DOM scene uses a transform from its top-left origin. Konva uses the fitted canvas size with an equivalent logical layer scale. Pointer client positions are converted from the fitted scene rectangle into logical coordinates and clamped to its bounds.

Resize changes the presentation only; committed points are not rewritten. Whole-scene proportional fitting and letterboxing prevent clipping/drift. The standalone board uses the same fixed page behavior; there is no infinite canvas or pan/zoom. Toolbars are never transformed. Width values are scene units, so existing ink and its width scale together.

A resize during an unfinished gesture cancels that draft, leaving history unchanged. This avoids mixing two viewport transforms within one interaction. Fractional browser pixel rounding may produce subpixel raster differences; tests check alignment to the same SVG feature, not screenshot identity.

## Session and document ownership

The session provider now owns a DrawingSession:

- mode: whiteboard, explore or annotate;
- whiteboard: one document and its bounded operation history;
- annotations: document/history entries keyed by stable scene ID.

Each document has a UUID and an owner target (whiteboard or annotation with sceneId). Existing session/class/subject ownership is retained. Prototype class/subject labels are still not final backend catalog IDs.

Actions include the intended document ID. A delayed callback cannot accidentally target whichever document later became active. Unknown/old document IDs are rejected. Existing documentReducer and ToolManager behavior are reused.

Whiteboard ↔ Content ↔ Annotate does not create a new session. Each document preserves its own Undo/Redo branch and Clear history. The fixture's selected element survives these mode switches. New class/subject/Quick Workspace selection creates a new session and resets both documents and fixture state.

All state remains in memory. Reload and a new teaching context discard it. There is no browser storage authority or claimed synchronization. Before persistence, define validated serialization/migration contracts for the now-explicit bounds and owner target; schemaVersion remains 1 because no saved Phase 1 documents exist in this prototype.

## Neutral fixture

Shape studio contains three large selectable elements: circle, triangle and square. Selecting an element highlights it and displays a short description; selecting it again clears selection. Geometry remains fixed when selected, allowing clear annotation alignment checks.

The graphics are original SVG primitives. The fixture is explicitly labelled as a demo with no assigned curriculum. It is a composition/input test, not textbook ingestion or a general activity engine.

## Regression and new tests

The original 14 Phase 1 unit tests are retained unchanged. All 10 Phase 1 browser tests remain, including their history/pixel/pointer assertions. Only UI navigation was adapted: Draw → Ink settings, Exit → Back, old Diagram shelf → Content, and direct toolbar tool selection replaces opening a tool panel.

Seven new unit tests cover:
- distinct document targets/IDs/history;
- independent Undo/Redo/Clear and branching;
- explicit document routing and rejection of stale IDs;
- fresh-session reset;
- proportional fitting;
- coordinate invariance across sizes;
- clamped outside coordinates.

Eight new browser cases cover:
- Explore pointer/keyboard input and Annotate blocking;
- independent state, Undo/Redo and Clear through mode switches;
- rendered annotation alignment with an SVG feature through all supported sizes;
- resize cancellation and the next successful gesture;
- reset of both documents and fixture state in a new session;
- three viewport cases asserting control availability, dimensions, clipping, surface area, no placeholder buttons, and settings Escape/focus behavior.

An initial new test wrongly treated Playwright role-query presence as proof of keyboard accessibility. It was replaced with actual focus and keyboard activation checks for the inert content. The application input boundary was already working.

An initial concurrent lint run encountered Playwright replacing test-results during directory traversal. ESLint now ignores generated test-results and playwright-report directories, just as Git already did. No source/test assertions were excluded.

## Hands-on browser verification

Used the in-app Chromium browser and actual UI actions:
- STD 5 → Science → Workspace showed the correct context.
- Whiteboard stroke/dot, Pen/Eraser, Undo/Redo and confirmed Clear worked.
- Undo Clear restored the whiteboard.
- Content opened Shape studio; selecting Circle updated its highlight/detail.
- Annotate allowed drawing across Circle while leaving its selection unchanged.
- Returning to Explore retained the annotation and allowed Triangle selection.
- Whiteboard restored its separate ink. A new stroke could be drawn and undone independently.
- Returning to Content preserved both the annotation and Triangle selection.
- Resizing 1280×720 → 1024×600 → 1920×1080 kept the annotation crossing the same feature.
- Essential controls were visible at the smallest requested viewport; modal and cancellation behavior additionally passed automated tests.
- Captured browser warning/error logs were empty during this flow. The Phase 1 automated workspace console/resource test also passes.

A development hot reload during implementation reset the temporary session, consistent with the absence of persistence. Physical Android panels or styluses were not available and are not claimed as tested.

## Supported viewport observations

| Viewport | Teaching region height | Fitted scene, approximately | Result |
| --- | --- | --- | --- |
| 1920×1080 | 908 px | 1508×848 px | Full controls; proportional scene; annotation aligned |
| 1280×720 | 548 px | 868×488 px | Full controls; proportional scene; annotation aligned |
| 1024×600 | 444 px | 697×392 px | Full controls ≥56 px high; scene useful; no clipping |

The teaching region includes deliberate letterboxing. Its height occupies about 74–84% of these viewports; the fitted 16:9 page occupies less area. Below 950 px width the bottom controls can wrap; phone layout is not a supported target.

## Performance, accessibility and limitations

Pointer moves still update a local draft and schedule Konva painting, not provider/document/history state. Only the active document is rendered. The neutral DOM fixture is small; no third-party assets or packages were added. Konva layer redraw and growing long-stroke point buffers remain; no panel FPS, large-document or memory-soak claim is made.

The content is keyboard selectable in Explore and inert in Annotate. Mode/tool buttons expose pressed state; unavailable actions are disabled. Native dialogs provide modality, Escape handling and initial focus. Color/width are labelled. As in Phase 1, after confirmed Clear the formerly focused Clear control is disabled, so focus may return to the page rather than that control.

This is not a full accessibility certification. Distance readability, color-picker usability, palm rejection, pen pressure, browser/WebView versions, high-DPI performance and OS gestures still require real panel validation. Canvas drawing has no keyboard drawing alternative.

Only one neutral scene is implemented. Scene lookup is explicit and intentionally small, not a generalized activity registry. Content state is workspace-local and is not a serialized ActivityState model yet. No lesson/page versioning or saved-session recovery exists.

## Before Phase 3

Review the teacher flow on a physical target panel. Preserve document-target routing, gesture stability, shared scene bounds and independent history.

Then agree stable catalog IDs, scene/version identity, validated document serialization, local-save semantics and the API contract from backend-architecture.md before implementing durable sessions. Recoverability and truthful save status should precede any claim that teachers can rely on saved work. Phase 3 has not started.

## Final validation

| Command | Result |
| --- | --- |
| npm run typecheck | PASS |
| npm run lint | PASS, no warnings |
| npm test | PASS: 21 tests in 4 files (14 retained, 7 new) |
| npm run test:e2e | PASS: 18 tests (10 retained, 8 new) |
| npm run build | PASS: JavaScript 560.86 kB / 174.13 kB gzip; CSS 24.02 kB / 5.79 kB gzip |
| git diff --check | PASS; Git emitted only LF/CRLF conversion notices |

Browser runner output included environment NO_COLOR/FORCE_COLOR notices. These were runner messages, not application-console failures. The JavaScript payload remains substantial; no code-splitting change was made in this milestone.

## File and Git manifest

9 tracked files modified, 11 new files, no files deleted. Tracked diff: 131 insertions and 128 deletions, excluding new files. No staging, commit, push or branch change. HEAD remains 9e218c40e93b138b26a47c45a2772cc034543afc on gpt6-astra-rework. main remains 133c2ad7df2f72fad746b9536b2d9283ecd872ef.

Created:

- docs/phase-2.md
- src/components/workspace/DrawingToolbar.tsx
- src/components/workspace/NeutralScene.tsx
- src/components/workspace/SessionHeader.tsx
- src/components/workspace/TeacherControls.tsx
- src/components/workspace/TeachingSurface.tsx
- src/drawing/scene.test.ts
- src/drawing/scene.ts
- src/drawing/session.test.ts
- src/drawing/session.ts
- tests/e2e/teaching-workspace.spec.ts

Modified:

- README.md
- eslint.config.js
- src/components/workspace/DrawingCanvas.tsx
- src/drawing/document.ts
- src/index.css
- src/pages/Workspace/Workspace.tsx
- src/store/DrawingProvider.tsx
- src/store/drawing-context.ts
- tests/e2e/whiteboard.spec.ts
