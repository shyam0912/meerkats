# IC-3 — Build a Plant

Development-only Standard 2 Environmental Studies activity. Original Demo Concept — Preview / Teacher Review Pending. Not an official SCERT chapter. Existing public catalog and Cloudflare deployment are unchanged.

## Implementation

- Dedicated lazy `plant-builder` SVG/DOM renderer beneath the existing Konva annotation layer.
- Five stable ordered part identities: roots, stem, two interchangeable leaves, flower. Fixed slots, unique occupancy and bounded snap radius. Parts can be placed in any order.
- Mouse/touch dragging, tap part then target, and keyboard placement. Invalid drops preserve the prior arrangement. Captured gestures hold their starting state/callback and keep transient pointer movement outside session persistence.
- Escape, pointer cancellation/lost capture, window blur, hidden document, resizing and unmount discard drafts. Other pointers cannot start a second gesture.
- Part explanations, bilingual labels, Show whole plant, Return to tray and confirmed Reset. Controls are outside the teaching canvas; Focus and Whiteboard reuse existing infrastructure.
- Water and light are explanatory states, not growth simulation. Water transport is shown only with connected roots/stem; branches reach present leaves. Darkness stops light cues without instant wilting or death. No score, compulsory sequence or timers.
- Original botanical SVG paths; existing locally bundled Noto Sans Malayalam. No additional dependencies.

## Contracts and compatibility

`contracts/plant.ts` adds strict bounded config/state; `contracts/lesson.ts` extends the activity and progress unions. State stores exactly five part IDs/slots, optional inspected part ID, language, label visibility, water/light conditions and an optional demonstration (`water`/`light`). No pointer coordinates, animation timer, history or event log is persisted. Initial/full state fits below 2 KiB.

Existing lesson envelopes, Whiteboard document versions 1–4, annotation identity, IndexedDB version, mutation/revision contracts and database schema are unchanged. Existing immutable lesson versions are untouched. The new lesson has separate fixed IDs.

This extension is not readable by older clients. `tests/compatibility/plant-previous-release.mjs` archives and runs checkpoint `75e62033dbbd0cee0a2e53587be4dfbbfdd27abf` against the same disposable browser profile/origin. It verifies unsupported-session rejection, exact raw-record retention, old-client overwrite rejection, non-destructive discovery, current-client recovery and unchanged pending mutation payload/ID. Never downgrade a plant record to another activity kind.

Optional API operation requires the updated shared validators and the new immutable catalog entry. Tests use isolated UTF-8 PostgreSQL; the existing WIN1252 development database is not migrated or modified. No SQL migration is needed.

Public catalog source is unchanged and still includes only the already-approved Counting, Physics and Chemistry previews. The new renderer can be present as an unreachable lazy chunk in local demo builds; this milestone does not publish the new lesson or deploy any build.

## Recovery and scope

Committed activity changes use existing save scheduling, IndexedDB transaction acknowledgement, unload protection and exact pending retries. Wait for `Saved on this device`; forced termination before durable transaction completion cannot be guaranteed. Selection of a part and teaching settings are committed educational state; drag previews and tap-placement arming are transient.

Drawing Undo/Redo remains drawing-only. Plant assembly can be repositioned, returned to the tray or reset; no activity Undo stack is introduced. Reset preserves language/label preference and does not clear annotations or Whiteboard ink. Annotation remains fixed to scene coordinates and does not follow moving plant parts. Existing Recent Boards is for standalone boards; classroom sessions recover through their session URL.

## Academic review

The diagram is a generic flowering-plant model, not every plant and not a verified Kerala SCERT chapter. Roots absorb water/anchor; stem supports/transports; leaves use light, water and air to make food; flower helps seed formation. English/Malayalam wording and age suitability remain subject to teacher review.

Reference checks used in design: Oregon State University Extension, *Vegetative plant parts* (https://extension.oregonstate.edu/catalog/em-9904-vegetative-plant-parts); RHS, *How plants use light to grow* (https://www.rhs.org.uk/advice/understanding-plants/how-plants-use-light-to-grow); RHS school gardening, *Watering plants* (https://www.rhs.org.uk/education-learning/school-gardening/resources/planet-friendly/watering-plants). Illustrations were authored as original SVG, not copied from these sources.

## Acceptance evidence

See `logs/ic3-evidence/` (ignored local evidence, not release assets) for screenshots, browser observations, traces and isolated API acceptance runner. Browser review uses installed Google Chrome and disposable contexts at 1920×1080, 1280×720 and 1024×600. Touch input is browser emulation, not physical iPad, Apple Pencil or Android-panel validation.

Local review: http://127.0.0.1:5174/catalog → Standard 2 → Environmental Studies → Original Demo Concepts → Build a Plant → Start teaching.

## Final validation

- Frontend: `npm run typecheck` PASS; `npm run lint` PASS; `npm test` PASS (189 tests / 26 files); `npm run build` PASS.
- Full frontend browser suite: `npm run test:e2e -- --workers=2 --output <external IC-3 evidence directory>/frontend` PASS (146 tests, zero retries).
- After the final secondary caption-position adjustment, the seven plant browser tests passed again with unchanged assertions/timeouts.
- API: `npm run test:e2e:api -- --output <external IC-3 evidence directory>/api` PASS (24 tests). An isolated UTF-8 PostgreSQL launcher supplies ephemeral identity/database environment values. Existing development database unchanged.
- Backend (server directory): `npm run typecheck`, `npm run lint`, `npm test` (36 tests), and `npm run build` all PASS.
- Compiled demo: `npm run test:demo -- --output <external IC-3 evidence directory>/demo-final` PASS (12 tests); its configured web server executed `npm run build:demo` successfully. Public catalog, notices, fonts, SPA navigation and API-disabled behavior passed.
- Previous release: `node tests/compatibility/plant-previous-release.mjs` PASS against actual checkpoint 75e62033dbbd0cee0a2e53587be4dfbbfdd27abf, on the same disposable origin/profile. Raw record, pending retry, whiteboard and annotations preserved exactly.
- `git diff --check` PASS. No staged files, commits, pushes or deployment.

New coverage: five unit cases, seven frontend browser cases, two API browser cases and one backend integration case. Existing discovery assertions now explicitly recognize the authored Standard 2 development preview and retain Planned assertions for Standards 3–9. Public-catalog assertions explicitly exclude Plant.

### Recorded failures and corrections during validation

1. The first unit run had two outdated catalog expectations (Standard 2 still Planned / only three school lessons). Updated those expectations to the approved new development catalog, adding explicit Standard 2 identity verification. No assertion was weakened to mask an application failure.
2. The initial compatibility harness could not reach its local Vite server inside the sandbox. Running installed Chrome/local Vite with permitted host access passed.
3. The first full frontend run reported three 30-second overlap-test timeouts and a Whiteboard duplicate/export interruption. Trace evidence proved Vite reloaded pages when an archived prior-release index.html was copied into the watched project. A diagnostic run also exposed Vite reloads from HTML trace resources written under logs. The final complete run used an external output directory, with no concurrent builds/archiving, and passed all 146 tests with original timeouts and zero retries. No Whiteboard source or assertions were changed.
4. Two isolated API launcher attempts failed at Windows shell invocation before tests ran. Direct npm Node-entry-point invocation and an external temporary UTF-8 cluster resolved the launcher issue; all 24 API cases then passed.
5. A copied previous-client checkout under logs caused ESLint to discover a second TSConfig root. Moved that audit checkout outside the repository; unchanged lint configuration then passed. The original failure traces are retained.
6. Screenshot review corrected water-path visibility and label overlaps; a regression also covers inspecting the already selected part after a demonstration. Final targeted plant tests passed after the last visual adjustment.

The main production JS bundle still triggers Vite's greater-than-500-kB warning (about 662 kB minified). Plant itself is lazy-loaded at about 16.1 kB JS / 5.4 kB gzip plus 2.6 kB CSS. No physical performance claim is made.

## Evidence and review

Final screenshots: `logs/ic3-evidence/browser/{1920,1280,1024}-{empty,completed,water,sunlight,malayalam,focus}.png`.
Independent browser observations and traces are in that directory. Checks include no page scrolling, primary controls at least 56 CSS px tall, reduced-motion behavior, mouse placement, annotation ownership, Malayalam reload recovery, no uncaught/console errors and no application API requests in the device-local review environment.

Final automated browser outputs are outside Vite's watched tree at:
`C:/Users/Jerry/.codex/visualizations/2026/09/18/01a0b307-d2be-7b92-9304-e08675a144a0/ic3-qa/`.
Keep compatibility archive extraction and browser suites sequential; do not copy HTML evidence into a running Vite project.

Remaining limitations: teacher review of academic/Malayalam wording; no verified SCERT alignment; no physical Safari/Apple Pencil/Android-panel test; no growth simulation or plant-assembly Undo stack; annotations remain fixed to the scene; forced termination before confirmed IndexedDB saving remains subject to browser limitations. The public catalog excludes this activity pending separate release approval.

## Exact changed-file manifest

11 modified, 10 created, 0 removed. All unstaged.

| Change | File |
|---|---|
| Modified | `contracts/catalog-content.ts` |
| Modified | `contracts/lesson.ts` |
| Modified | `server/tests/api.test.ts` |
| Modified | `src/activities/public-catalog.test.ts` |
| Modified | `src/activities/registry.ts` |
| Modified | `src/components/workspace/TeacherControls.tsx` |
| Modified | `src/pages/Catalog/Catalog.tsx` |
| Modified | `src/pages/Catalog/schoolPilot.test.ts` |
| Modified | `src/pages/Catalog/schoolPilot.ts` |
| Modified | `src/pages/Workspace/Workspace.tsx` |
| Modified | `tests/e2e/discovery.spec.ts` |
| Created | `contracts/plant-content.ts` |
| Created | `contracts/plant.ts` |
| Created | `docs/ic-3-plant.md` |
| Created | `src/activities/kinds/PlantBuilder.tsx` |
| Created | `src/activities/kinds/plant-builder.css` |
| Created | `src/activities/plant.test.ts` |
| Created | `tests/api-e2e/plant-session.spec.ts` |
| Created | `tests/compatibility/plant-previous-release.mjs` |
| Created | `tests/e2e/plant.spec.ts` |
| Created | `tests/helpers/plant.ts` |
