# Phase 4 — Curriculum catalog and lesson/activity engine

Implementation date: 2026-09-29. Starting checkpoint: `1c0f9be94f161bd9852699252cbdcf5c9dbbbb3c` on `gpt6-astra-rework`. This milestone remains an uncommitted working-tree diff.

## A–E. Architecture, catalog and typed definitions

The teacher journey is now Start Teaching → Class → Subject → Chapter → Topic/Lesson → Start Teaching → Workspace. Topic and lesson share one screen. The original class-specific standalone boards remain explicitly labelled “Class workspaces”; Quick Workspace and its prior recovery format are preserved.

The neutral catalog contains exactly one curriculum, class, subject, chapter, topic and lesson, with three activities. It claims no Kerala/SCERT curriculum coverage. Assigned UUID constants are independent of labels and positions. A catalog node has an ID, typed kind, parent ID, title and explicit order. Runtime validation verifies the hierarchy, unique IDs and the complete lesson path.

`LessonDefinition` is the catalog identity/path, title, order and currently published version reference. `LessonVersion` has its own ID, lesson ID, publication number, schema version, title, objectives, provenance, review status, bounded asset references and an ordered array of validated activities. A version supports 1–12 activities. Array order determines navigation, never annotation identity.

`ActivityDefinition` is a strict discriminated Zod union, with ID, kind, title, scene ID, annotation policy, guidance and kind-specific configuration. Explain/explore accept 1–3 typed visual items. Reveal accepts 1–6 prompts. There is no arbitrary `any` configuration, lesson HTML or executable content from the API.

## F–K. Registry, host, activities and navigation

An explicit activity registry maps explain, explore and reveal to separate `React.lazy` modules and supported capabilities. This is an internal registry, not a plugin system. `ActivityHost` validates before rendering, uses Suspense while loading and contains an error boundary. It does not own session persistence.

- Explain: original static labelled shapes, with annotation available.
- Explore: selectable shapes and descriptions; selection belongs to the session.
- Reveal: progressive original prompts; reveal count belongs to the session.

TeacherControls consults capabilities and annotation policy. Reveal and Reset appear only for supported kinds, are disabled at their bounds, and are available in Content mode. Reset changes activity runtime state, not annotations. Whiteboard remains available independently. Previous/Next and an activity position appear only for multi-activity lessons. The on-demand ActivityNavigator uses a native modal dialog, Close/Escape, initial focus and focus return. It is not a permanent sidebar.

## L–O. Whiteboard, annotations, runtime and persistence

The Phase 1 pointer engine, draft rendering, pen, ink eraser, history, dots, pointer capture and cancellation paths are unchanged. TeachingSurface still fits a 1200×675 scene; DOM activity content sits under the same Konva annotation layer. Explore passes input to content. Annotate makes content inert and gives drawing exclusive input ownership.

The standalone whiteboard has one stable document UUID per session. Each lesson activity receives a separate annotation UUID and immutable target tuple:

`lessonVersionId / activityId / sceneId`

The annotation-map key encodes that tuple. Backend validation checks it against the session's pinned definition. Navigation explicitly targets document IDs; Undo/Redo/Clear remain document-specific. Going to Whiteboard preserves the current activity and all its state. Activity navigation intentionally returns to Content/Explore.

Session runtime stores a current activity ID, local progress revision and bounded per-activity state. Explain is stateless; explore stores a nullable item UUID; reveal stores a count within the definition's prompt count. Reducer updates never mutate the lesson definition. No new global activity store or duplicate drawing engine was added.

The existing version-1 local snapshot is extended with optional validated lesson/version/progress data. Legacy snapshots and exact document retry payloads remain readable. A loaded immutable lesson definition is stored with its session, so local restoration does not fetch catalog data. Existing IndexedDB generation checks continue preventing silent multi-tab overwrites. Undo history remains in memory and resets on reload, as in Phase 3; committed ink and runtime recover.

Drawing saves retain the existing API and outbox semantics. Progress has a separate durable exact-payload outbox: mutation UUID, base server revision and bounded progress snapshot. Its receipt is stored before removing the pending retry. The controller serializes transactions, coalesces newer progress, retries transient outages and stops on conflicts. It reports “Lesson and ink synced” only after both are acknowledged. Old standalone sessions retain their existing status text. Current workspace mode is locally durable; fresh-device restoration starts a lesson in Content mode at the remotely saved activity.

## P–R. Backend, immutable versions and provenance

The existing Fastify/Drizzle modular monolith remains in `server/`. The additive migration adds four tables:

| Table/change | Purpose |
| --- | --- |
| `catalog_nodes` | Relational catalog identity, parent links, kind, title and ordering. Five catalog concepts share this one small tree table. |
| `lessons` | Stable lesson identity, relational topic link, validated catalog metadata JSONB. |
| `lesson_versions` | Lesson FK, unique publication number and bounded validated definition JSONB. |
| `progress_receipts` | Session/mutation identity, request hash and acknowledged revision. |
| `teaching_sessions` additions | Nullable lesson version FK, bounded progress JSONB and server progress revision. Existing sessions remain unpinned. |

Custom PostgreSQL triggers reject UPDATE/DELETE of published version rows and changes to an existing session's lesson pin. These triggers are intentionally included in the SQL migration; real database tests verify them because Drizzle snapshot drift checks alone do not inspect trigger behavior. Internal publication validates definitions before insertion. No publishing/admin API was added. Seeding is repeatable and never updates an existing published version.

New secured routes:

- `GET /api/v1/catalog`
- `GET /api/v1/lesson-versions/:id`
- `PUT /api/v1/sessions/:sessionId/progress`

Session create/read additionally supports a pinned version and progress. Progress writes use a session row lock, optimistic concurrency and idempotent receipts. Reusing a mutation with a different payload or using a stale revision is rejected. Cross-school/teacher session access remains denied. The original demo catalog is intentionally shared read-only among active school members; there is no school-private catalog or entitlement system in this milestone. Every catalog request still checks active membership. Development identity remains loopback-only; production OIDC is not implemented.

Provenance fields cover source type/title, optional edition, page references, review status and notes. The fixture states “original-demo” and “engineering-demo”; no textbook pages, media, or curriculum claims were introduced.

## S–V. Routing, splitting, fallback and offline limits

`/catalog` is a lazy route; its parent query parameter contains a stable catalog ID. Chapter/topic/lesson browsing does not create a teaching session. Launch fetches and validates the specific published version before creating a new session. The existing `/workspace?session=<uuid>` recovery URL remains authoritative. Workspace and TeachingSurface consume definitions, not individual lesson implementations.

Measured production output (decimal kB from Vite):

| Asset | Before Phase 4 | After Phase 4 |
| --- | ---: | ---: |
| Main JS | 664.95 / gzip 203.75 | 677.83 / gzip 207.18 |
| CSS | 24.02 / gzip 5.79 | 26.32 / gzip 6.32 |
| Explain | — | 0.19 / gzip 0.17 |
| Explore | — | 0.32 / gzip 0.23 |
| Reveal | — | 0.72 / gzip 0.38 |
| Shared visuals | — | 1.34 / gzip 0.69 |
| Bundled demo data | — | 2.88 / gzip 1.03 |
| Catalog UI | — | 3.05 / gzip 1.33 |

Splitting establishes a boundary for future activity growth; it does not reduce the core bundle in this phase. The >500 kB main-chunk warning remains visible. No warning threshold was raised.

Unknown/malformed activity props render ContentFallback. A failed lazy module is contained by ActivityBoundary, leaving navigation, Whiteboard and Back usable. Whole malformed lesson versions are rejected at catalog loading/publication/recovery boundaries rather than partially trusted. Catalog/load errors explain that no session was started; existing work is untouched. No enabled placeholder actions are introduced.

The loaded definition, progress, completed ink and pending saves remain available locally during API loss. This was tested with both request interception and a physically stopped local API process. The frontend application/code still must be available: there is no service worker, offline app shell, durable activity-JavaScript cache, full catalog cache or asset downloader. A fresh device needs the API. Storage eviction, quota failure and unsynced loss of the device remain limitations. Conflicts preserve local data and show attention status; no conflict-resolution UI or collaborative merge is claimed.

## Z–AD. Dependencies and automated validation

No dependencies added, removed or upgraded. `server/npm ci` reinstalled the existing lockfile; it reported 0 vulnerabilities. No production authentication, curriculum, PDF/video, simulation, scoring, AI, PWA/APK, collaboration or analytics work was done.

New frontend unit coverage: 10 tests for hierarchy/IDs, definition/schema validation, registry/capabilities, unknown/malformed fallback, ordering/pinning, annotation keys, document independence, runtime serialization, exact progress retries, and stale-revision retention. New browser coverage: 7 tests for full journey/reload, outline/reset, per-activity Clear/Undo, failed-module recovery and three supported viewports. New API E2E coverage: 1 test for backend catalog, fresh-device lesson recovery, API outage and reconnection. New backend coverage: 9 real PostgreSQL tests for catalog/version reads, membership, malformed publication, SQL immutability, pinning, context, progress concurrency/idempotency, cross-school denial and annotation anchors. All earlier assertions remain intact.

| Directory | Exact command | Result |
| --- | --- | --- |
| root | `npm run typecheck` | PASS |
| root | `npm run lint` | PASS |
| root | `npm test` | PASS — 44 tests, 6 files (34 existing + 10 new) |
| root | `npm run test:e2e` | PASS — 32 tests (25 existing + 7 new) |
| root | `npm run test:e2e:api` | PASS — 3 tests (2 existing + 1 new) |
| root | `npm run build` | PASS, retained size warning |
| root | `git diff --check` | PASS |
| server | `npm ci` | PASS, 0 vulnerabilities reported |
| server | `npm run typecheck` | PASS |
| server | `npm run lint` | PASS |
| server | `npm test` | PASS — 27 tests, 2 files (18 existing + 9 new) |
| server | `npm run db:generate` | PASS — no remaining schema changes after generating the additive migration |
| server | `npm run db:migrate` | PASS on existing local development database |
| server | `npm run db:seed` | PASS |
| server | `npm run build` | PASS |
| server | `npm start` | PASS — compiled server; health/readiness both HTTP 200 |

An initial typecheck found a literal-type error in new test mocks; corrected before the successful full run. The first sandboxed migration-generation attempt reported native process `EPERM`; rerunning with authorized process permissions succeeded. The deliberate failed-module test logs the expected React boundary error; deliberate API outage logs expected connection errors. Normal lesson browser tests reported no page errors. Existing Windows line-ending notices, Playwright color-environment warnings and Drizzle helper deprecation warnings remain non-blocking.

## AE–AI. Direct browser results, accessibility, performance and limits

Direct in-app-browser checks used the compiled backend and live API-enabled Vite frontend. Verified class → subject → chapter → combined topic/lesson → launch; annotate activity one; select a triangle on activity two; annotate activity two; return to activity one's original ink; draw on Whiteboard; return to the lesson; reload to activity two with its selection and ink; stop the API; move to reveal and reveal a prompt; reload during the outage; reveal the next prompt; confirm recovered Whiteboard ink; restart API and observe “Lesson and ink synced”. Normal browser console was empty before intentional outage. API health/readiness and catalog/session requests returned successful responses. This is desktop verification, not physical panel testing.

Automated viewport assertions passed at 1920×1080, 1280×720 and 1024×600: all essential drawing/navigation controls fit, primary heights are at least 56 CSS px, the fitted scene remains useful (>280 px high in these lesson tests), and previously drawn ink remains aligned. Direct visual inspection at 1280×720 and 1024×600 confirmed the compact controls and dominant central scene. Screenshot artifacts are written under ignored `test-results/`.

Accessible control names, pressed/current/disabled states, keyboard activation, visible focus, native dialog containment, Escape and focus return are present. Content is inert during annotation. Text is real DOM text and SVG graphics are original. This is not a complete assistive-technology audit. Classroom distance readability, finger/stylus accuracy, palm rejection, panel browser storage and actual Android performance require device testing.

No pointer-move persistence or new broad per-pointer state updates were introduced. Only committed drawing changes or bounded activity/navigation actions schedule device saves. Definitions are copied into session snapshots for reliable pinning/recovery; with the bounded demo this is small, but large future lessons should share immutable cached version records rather than repeatedly clone large definitions. No load, memory or long-session benchmark is claimed. The core React/Konva bundle still needs a separately justified loading review before major content growth.

Other limitations: one original demo lesson; supported kinds only; at most 12 activities; no authoring or publication-management UI; no private-catalog entitlement model; no asset pipeline; no production identity; no merge UI; no durable Undo history; no service-worker offline startup. Schema versions are rejected when unsupported. Future version migrations and richer content layouts need explicit work and review.

## AL. Recommendation before curriculum-content work

Review this diff and checkpoint only after approval. Before authoring curriculum, validate the teacher journey on a physical target panel, agree stable curriculum mapping and provenance/review rules, select a legally usable source, and run a small teacher evaluation using the neutral fixture. Add real content through validated version data and registered kinds; do not rewrite Workspace or add unapproved textbook examples. Production identity and deployment readiness require a separately authorized scope before a school pilot with private data. No next-phase or curriculum work was started.

## W–Y / AJ–AK. File inventory and Git

No files removed. No commit or push. `main` remains at `133c2ad7df2f72fad746b9536b2d9283ecd872ef`; current branch remains `gpt6-astra-rework`, with HEAD still at the approved Phase 3 checkpoint. File inventory follows below.

Created (19):

- `contracts/demo.ts`
- `contracts/lesson.ts`
- `docs/phase-4.md`
- `server/drizzle/0001_even_white_queen.sql`
- `server/drizzle/meta/0001_snapshot.json`
- `server/src/modules/catalog.ts`
- `src/activities/ActivityHost.tsx`
- `src/activities/ActivityNavigator.tsx`
- `src/activities/ContentFallback.tsx`
- `src/activities/catalog.ts`
- `src/activities/kinds/Explain.tsx`
- `src/activities/kinds/Explore.tsx`
- `src/activities/kinds/Reveal.tsx`
- `src/activities/kinds/VisualItems.tsx`
- `src/activities/lesson.test.ts`
- `src/activities/registry.ts`
- `src/pages/Catalog/Catalog.tsx`
- `tests/api-e2e/lesson-session.spec.ts`
- `tests/e2e/lesson-engine.spec.ts`

Modified (24):

- `README.md`
- `contracts/index.ts`
- `server/drizzle/meta/_journal.json`
- `server/src/app.ts`
- `server/src/db/schema.ts`
- `server/src/db/seed.ts`
- `server/src/modules/sessions.ts`
- `server/tests/api.test.ts`
- `src/components/workspace/SessionHeader.tsx`
- `src/components/workspace/TeacherControls.tsx`
- `src/components/workspace/TeachingSurface.tsx`
- `src/drawing/document.ts`
- `src/drawing/session.ts`
- `src/index.css`
- `src/pages/Home/Home.tsx`
- `src/persistence/api.ts`
- `src/persistence/controller.ts`
- `src/persistence/database.ts`
- `src/persistence/serialization.ts`
- `src/routes/AppRoutes.tsx`
- `src/store/ClassroomProvider.tsx`
- `src/store/DrawingProvider.tsx`
- `src/store/classroom-context.ts`
- `src/store/drawing-context.ts`

Diff summary: 43 files in scope — 19 created, 24 modified, 0 removed. All implementation changes are unstaged; HEAD and upstream remain at the Phase 3 checkpoint. No project dependency manifests or lockfiles changed.
