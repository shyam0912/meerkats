# IC-2 — Same Number, Different Arrangements

Implementation baseline: `meerkats-v2`, `45388239dd8418aeb50d34c6d3cf089624d135d8`.
Status: owner review pending. No commit, push or deployment is part of this milestone.

## Teaching experience

Development catalog path: Classroom → Standard 1 → Mathematics → Original Demo Concepts → Same Number, Different Arrangements → Start teaching.

This is an **Original Demo Concept — Preview / Teacher Review Pending**, not an official SCERT chapter. Existing published Chemistry and Physics versions and identifiers are unchanged. The public catalog still includes only Chemistry and Physics.

Teachers choose 1–10 counters, rearrange them freely, show/hide the total, optionally count together one counter at a time, and reset the arrangement. No scoring, sound, timed animation, compulsory Next/Reveal sequence or new activity framework is introduced.

Counting assistance is optional: enable it in More, then press Next counter to highlight and number one additional counter. Count again restarts assistance without changing the arrangement. Changing quantity starts an orderly new arrangement. Reset preserves quantity, language and display preferences. Counter IDs come from the immutable ten-ID pool rather than being recreated on movement/reset.

English and Malayalam activity labels use the existing bundled Noto Sans Malayalam font. Malayalam wording and the learning design still need teacher review. Teacher chrome and some keyboard instructions remain English.

## Contracts and compatibility

- New strict activity kind: `counting-board`, configuration model `quantity-conservation-v1`.
- Configuration: exactly ten unique UUIDs and initial quantity five.
- State: quantity, matching ordered counter IDs and logical positions, show-count preference, language, optional counting assistance and bounded counted prefix.
- Finite bounded positions and a minimum centre separation of 100 logical units prevent complete obstruction. Counter diameter is 120: slight overlap is permitted. Invalid destinations preserve the last valid preview; other counters are never automatically displaced.
- A completed reposition changes only the selected counter, not quantity or identity. Lines, circles and scattered patterns are possible without selecting canned layouts.
- Whiteboard document v4, annotation v1, lesson/session envelopes, IndexedDB version, SQL schema and mutation envelopes are unchanged.
- Existing records require no counting migration. New lesson/session/activity/scene identities are distinct and stable.
- New API-enabled sessions require an API compiled with the updated shared contract and the new immutable catalog records. The development database was not seeded or migrated by this task; API tests use isolated UTF-8 databases.

The older client cannot interpret the new activity. It must fail recovery without changing stored records. `tests/compatibility/counting-previous-release.mjs` archives the actual baseline with `git archive` (no checkout), starts old/new clients, and alternates them behind the same local origin in one disposable Chrome profile. It checks old-client recovery rejection, exact raw-record preservation, refusal to overwrite with an old-format candidate, non-destructive recent-record inspection, new-client recovery and exact pending-mutation preservation. Generated archives, logs and traces are ignored under `test-results`.

Run that compatibility check after other browser suites:

```powershell
node tests/compatibility/counting-previous-release.mjs
```

No automatic downgrade/flattening is provided. Reopening a counting session with an older release requires returning to a compatible client; the old UI's recovery message is generic. Activity model changes in future require another compatibility review.

## Input, annotation and saving

- Pointer capture owns one primary pointer and snapshots its starting state/callback.
- Pointer previews remain component-local. Completed changes use the existing activity-progress reducer/persistence controller. No whole-document serialization is introduced on pointer movement.
- Mouse/touch drag, tap counter then destination, and Enter → arrow keys → Enter placement are supported. Escape cancels keyboard/pointer placement.
- Cancellation covers pointercancel, lost capture, resize, blur, visibility loss and unmount. Secondary pointers do not create new interactions.
- Explore/Annotate ownership is passed explicitly. Switching ownership remounts the counting interaction and discards drafts; annotation keeps the saved scene visible and inert. Existing drawing lifecycle is unchanged.
- Teacher controls render in the existing footer through a portal. Trays are dismissible; no permanent sidebar or floating counter toolbar is added.
- Annotation stays in scene coordinates; it does not follow counters. Reset never clears ink. Whiteboard history remains separate from activity progress; no persistent activity Undo stack is promised.
- Existing save states, generation protection, pending payloads, revisions and conflict handling are retained. Forced termination before confirmed local saving still cannot guarantee memory-only work.

The standard-selection availability label is shortened to “Preview →”: adding a preview to the first row exposed wrapping/vertical overflow at 1024×600. No touch targets or existing assertions were reduced to fix this.

## Validation and evidence

Permanent additions: six unit tests, eight frontend E2E tests, two API E2E tests, one backend API test, and the previous-release browser compatibility runner. Existing school-catalog expectations now require Standard 1's authored preview and preserve Planned checks for Standards 2–9. Public-catalog tests explicitly exclude the new development activity.

Validation commands:

```text
npm run typecheck
npm run lint
npm test
npm run test:e2e -- --workers=1
npm run test:e2e:api
npm run build
npm run test:demo                 # includes npm run build:demo
node tests/compatibility/counting-previous-release.mjs
git diff --check

# server/
npm run typecheck
npm run lint
npm test
npm run build
```

The API browser runner prepares an isolated UTF-8 PostgreSQL cluster, applies existing migrations and seeds test records there, passes disposable identity/database environment values to the existing suite, then stops the cluster. It never migrates the WIN1252 development database. No dependencies were installed.

Final validation results:

| Check | Result |
| --- | --- |
| Frontend typecheck / lint | PASS / PASS |
| Frontend unit tests | 183 passed, 25 files |
| Full frontend E2E, one worker, zero retries | 139 passed, 10.2 minutes |
| API E2E, isolated UTF-8 database, diagnostic run | 22 passed, 1.4 minutes |
| Backend typecheck / lint | PASS / PASS |
| Backend tests | 35 passed, 2 files |
| Standard frontend production build | PASS |
| Backend production build | PASS |
| Public-demo production build and acceptance | PASS; 9 tests passed |
| Previous-client compatibility runner | PASS; six preservation/rejection assertions |
| Git whitespace check | PASS |

The standard build's lazy CountingBoard JavaScript is 10.35 kB (3.68 kB gzip), with 2.40 kB CSS. The existing main-chunk warning remains (659.41 kB minified). These are build measurements, not physical-device performance claims.

Failures retained during development:

1. The restricted sandbox could not reach its localhost Vite server. The owned server was stopped and tests ran with approved localhost/process permissions.
2. Initial counting tests exposed a real mouse-up bug: zero-button `pointerup` was treated as lost input. The correction distinguishes release from unexpected zero-button pointer movement.
3. New reload checks initially inspected the DOM before lazy activity rendering. They now wait for a visible counter before comparing exact IDs/positions. One new tap assertion was corrected for physical-pixel to logical-coordinate rounding (two logical units maximum).
4. The first full frontend run exposed discovery overflow at 1024×600 and a 30-second timeout late in an existing selected-shape overlap/PNG workflow. Its trace retained revision 52 and populated shapes/text at the export stage. Tests and timeouts were not weakened.
5. The first API launcher attempt used the wrong working directory for existing migration files; only the external runner was corrected. The first complete API run passed 21/22 tests; its final existing text-recovery test encountered `ERR_CONNECTION_REFUSED` from the local Vite origin. A diagnostic rerun passed 22/22 unchanged tests. The earlier server-exit trigger is unconfirmed.

The final serial run passed the previously timed-out 1024 overlap/export test in 20.2 seconds without changing its assertions or timeout. Both completed external API harness processes retained runtime handles after logging database shutdown; only those verified owned processes were closed, and their stopped disposable database directories were removed. Test logs/traces were retained. No retries were enabled inside the suites.

Independent production-build Chrome checks used fresh profiles at 1920×1080, 1280×720 and 1024×600. They exercised actual pointer-created circular arrangements, optional counting, English/Malayalam labels, Focus, annotation/Whiteboard switching and confirmed-save reload. All preserved IDs/positions and reported zero page/console errors and zero application API requests. Screenshots and diagnostic evidence are stored outside the repository under the task's `ic2` visualization directory.

## Remaining limits

- No physical iPad, Apple Pencil or Android-panel testing has occurred; automated touch emulation is not hardware validation.
- No recent-classroom-session browser was added. Existing session URLs restore lessons; standalone Recent Boards behavior is unchanged.
- No offline application-cache/PWA guarantee, accounts, cloud deployment, new export engine or another classroom activity is included.
- The existing large main JavaScript chunk warning remains. The activity is lazy-loaded and has at most ten counters; no frame-rate claim is made for physical panels.
- Current public-demo access and Cloudflare deployment are unchanged. A future release requires separate approval and compatibility review.

## Changed-file manifest

Modified (12):

```text
contracts/catalog-content.ts
contracts/lesson.ts
server/tests/api.test.ts
src/activities/public-catalog.test.ts
src/activities/registry.ts
src/components/workspace/TeacherControls.tsx
src/components/workspace/TeachingSurface.tsx
src/pages/Catalog/Catalog.tsx
src/pages/Catalog/schoolPilot.test.ts
src/pages/Catalog/schoolPilot.ts
src/pages/Workspace/Workspace.tsx
tests/e2e/discovery.spec.ts
```

Created (10):

```text
contracts/counting-content.ts
contracts/counting.ts
docs/ic-2-counting.md
src/activities/counting.test.ts
src/activities/kinds/CountingBoard.tsx
src/activities/kinds/counting-board.css
tests/api-e2e/counting-session.spec.ts
tests/compatibility/counting-previous-release.mjs
tests/e2e/counting.spec.ts
tests/helpers/counting.ts
```

Removed: none. All implementation changes remain unstaged. No package/lockfile, database schema, backend-service, drawing-engine, persistence-controller, published Chemistry/Physics, public-catalog or Cloudflare configuration files were changed.
