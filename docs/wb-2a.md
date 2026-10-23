# WB-2A: pages, migration and backgrounds

Whiteboard Pro stores one version-2 document per existing teaching session. Its document ID, session ID, owner and 1200 × 675 logical bounds remain unchanged. The ordered `pages` array contains stable page IDs, a background and committed ink. `activePageId` and recoverable `deletedPages` are saved with the board. Annotation documents retain version 1 and their existing scene ownership.

## Rendering and history

The active page is projected into the existing drawing surface; there is no second drawing engine. Pointer drafts remain outside committed state. Callbacks capture both document and page IDs, and changing a page remounts the drawing surface so cleanup cancels unfinished input. Page controls are disabled during a gesture. Pen, eraser masks, pointer capture, outside release and logical scene fitting retain their existing behavior.

Ink Undo/Redo/Clear belong to each page. Reordering does not change the active page's identity. Page structure and backgrounds are deliberately outside ink history. Deletion requires confirmation, cannot delete the final live page, and moves the complete page into a recoverable list. Restoring selects that page and appends it to the live order. In-memory ink history survives page switching and deletion/restoration, but is not persisted across reload.

White, lined, dotted and square-grid paper render beneath the ink layer. Erasing removes ink rather than paper. PNG export captures only the current page, including its background. The on-demand navigator uses small PNG previews generated sequentially; temporary Konva stages and blob URLs are released. No permanent thumbnail sidebar is introduced. The navigator is exposed in standalone Whiteboard Pro; existing Classroom whiteboards retain their existing controls and continue using the same session-owned board model.

## Migration and retry safety

1. IndexedDB upgrades from version 1 to 2, adding `migrationBackups`. Existing connections close on version change. Old clients explicitly requesting database version 1 can no longer write it.
2. A v1 Whiteboard becomes one white page. Its first page ID deterministically equals the existing board ID; all ink and ownership are retained. The local document revision increments once.
3. The original complete local record and the migrated record are written in one transaction. The backup includes original annotations, generation and pending saves. A failed backup or save aborts the transaction. The original backup is never replaced by subsequent edits.
4. Pending mutation IDs, revisions and payloads remain unchanged. The existing synchronization controller retries an outstanding v1 mutation before creating a fresh mutation for v2. Server conflicts retain both the local v2 work and the exact pending payload.
5. The API continues accepting v1 for existing clients, but rejects a new v1 write over an already-v2 document, even if the caller knows its latest server revision. Exact historical retries still return their original acknowledgement.
6. Remote v1 recovery first stores the original snapshot locally, then follows the same backup/migration path.

The navigator can download the original v1 record as JSON or copy its original ink into a new page without replacing current work. This is a browser-local migration backup, not a cloud backup or a generic import system. Clearing browser storage removes it. If a v1 document is so close to 2 MiB that the additional v2 envelope exceeds the limit, recovery stops and the original stored record remains unchanged; this edge case needs assisted recovery rather than automatic ink removal.

## Limits and rollout

- Maximum 20 pages including recoverable deleted pages; no permanent purge is provided in WB-2A.
- Maximum 2 MiB UTF-8 serialized Whiteboard document, including deleted pages; maximum 10,000 ink actions per page.
- Capacity is checked before accepting a completed action. A rejected action leaves the previous document and history intact and displays an explicit message.
- Snapshot synchronization remains document-wide, with existing generation checks, durable pending mutations, idempotent receipts and optimistic concurrency. There is no page-level merge or multi-writer synchronization.
- Deploy the compatible API before exposing the v2 frontend. Do not roll an API that only understands v1 back over stored v2 data. No SQL schema migration or dependency change is required.
- Physical Android panels, stylus pressure and palm rejection remain unverified. Browser tests cover mouse and Chromium touch emulation at the supported display sizes.

Regression coverage includes migration backups/rollback/capacity/conflicts, immutable pending retries, older-client write protection, page-specific history, page limits, reorder/delete/restore, background export, IndexedDB reload, fresh-browser API recovery, and the existing Classroom, Physics and Chemistry suites.

## Exact file manifest

Created (9):

- `docs/wb-2a.md`
- `src/components/whiteboard/PageBackground.tsx`
- `src/components/whiteboard/PageNavigator.tsx`
- `src/drawing/background.ts`
- `src/drawing/whiteboard.ts`
- `src/drawing/whiteboard.test.ts`
- `src/persistence/migration.test.ts`
- `tests/e2e/whiteboard-pages.spec.ts`
- `tests/api-e2e/whiteboard-pages.spec.ts`

Modified (20):

- `contracts/index.ts`
- `server/src/modules/sessions.ts`
- `server/tests/api.test.ts`
- `src/components/whiteboard/WhiteboardPro.tsx`
- `src/components/whiteboard/whiteboard-pro.css`
- `src/components/workspace/DrawingCanvas.tsx`
- `src/components/workspace/DrawingToolbar.tsx`
- `src/components/workspace/TeachingSurface.tsx`
- `src/drawing/document.ts`
- `src/drawing/exportBoard.ts`
- `src/drawing/session.ts`
- `src/drawing/session.test.ts`
- `src/persistence/database.ts`
- `src/persistence/persistence.test.ts`
- `src/persistence/recentBoards.test.ts`
- `src/persistence/serialization.ts`
- `src/store/ClassroomProvider.tsx`
- `src/store/DrawingProvider.tsx`
- `src/store/drawing-context.ts`
- `tests/api-e2e/durable-session.spec.ts`

Removed: none. Package manifests/locks, SQL schema/migrations, published lesson contracts, ToolManager and drawing tools are unchanged.

## Final validation and review

Validated on 22 October 2026:

| Location | Command | Result |
| --- | --- | --- |
| Root | `npm run typecheck` | PASS |
| Root | `npm run lint` | PASS |
| Root | `npm test` | PASS: 110 tests in 13 files |
| Root | `npm run test:e2e -- --workers=4` | PASS: 82 tests |
| Root | `npm run test:e2e:api` | PASS: 15 tests |
| Root | `npm run build` | PASS; main bundle 710.45 kB, gzip 216.54 kB; Vite large-chunk warning |
| Root | `git diff --check` | PASS |
| Server | `npm run typecheck` | PASS |
| Server | `npm run lint` | PASS |
| Server | `npm test` | PASS: 31 tests in 2 files |
| Server | `npm run build` | PASS |
| Server | `npm run db:generate` | PASS: no schema changes |

Added 12 frontend unit tests, 8 frontend E2E tests, 1 API E2E test and 2 backend tests. Existing test assertions were adapted to the v2 page location where necessary; no existing test was removed or skipped.

An earlier API E2E run passed 13 tests and then reported server-unavailable/connection-refused failures in Physics and multipage recovery. The final complete run above passed unchanged after services were restarted; the earlier service interruption's precise cause was not established. Initial new cancellation tests incorrectly injected synthetic pointer-down events that could not obtain browser capture; they were corrected to use actual mouse input and Chromium touch injection, retaining their cancellation assertions.

Manual in-app-browser review covered drawing on separate lined/grid pages, previews and page controls at 1920×1080, 1280×720 and 1024×600. Automated checks cover the fuller behavioral matrix, including deletion/restoration, reload, export pixels, API recovery and cancellation. Physical-panel validation has not been performed. Screenshots are supplied outside the repository.

The review diff contains 20 modified files, 9 new files and no deletions. It remains unstaged and uncommitted on `meerkats-v2` at `2f600f79469af3171050451af9bee980a0f885ee`; no push was performed.

## Reliability follow-up (23 October 2026)

The immediate-refresh window was the shared 120 ms local-save debounce followed by asynchronous IndexedDB transactions. A pagehide callback cannot force the browser to await a write. Coalescing replaces intermediate scheduled snapshots with the latest state; no evidence implicated outbox payload rewriting or migration. The same controller handles v1 documents. Page selection also queues a snapshot and shares the unload window.

The provider now registers committed snapshots in a layout effect, before the updated board is painted. A beforeunload guard offers the browser's Stay choice while local durability is pending or failed, and starts a best-effort flush. Hidden-page transitions also flush. These operations remain asynchronous; the serialized transaction queue, generation checks, immutable pending requests and revision conflicts are unchanged. The syncing-status branch now checks latest local durability before claiming Saved on this device.

Limitations: choosing Leave anyway, browser termination, power loss, or a browser suppressing beforeunload can still lose work not yet committed to IndexedDB. Wait for Saved on this device or a synced status. Browser dialog wording is browser-controlled. This is not synchronous/blocking persistence. Undo history remains memory-only.

Capacity validation uses isolated fixtures of 2,096,000 and exactly 2,097,152 UTF-8 JSON bytes, each containing one bounded stroke (fewer than 180,000 coordinates). Browser mouse input attempts an additional stroke; the UI must reject it, show the capacity error, retain the existing board and recover it unchanged after refresh. Repository tests verify an oversized write cannot replace the valid record or its exact pending API mutation. Rejected gestures are explicitly not applied, not stored in a hidden recovery buffer; all previously accepted ink remains available for export/clear. No existing user board is used for boundary testing.

The optional PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH setting allows the existing installed Chrome executable to run both suites without installing or upgrading packages. Default Playwright-managed browser behavior is unchanged when unset.

Reliability-specific files: src/persistence/controller.ts; src/store/DrawingProvider.tsx; playwright.config.ts; playwright.api.config.ts; tests/e2e/discovery.spec.ts; docs/wb-2a.md. Added: src/persistence/reliability.test.ts; tests/helpers/capacity.ts; tests/e2e/whiteboard-reliability.spec.ts. No runtime dependencies, backend implementation, database schema, or contracts were changed by this follow-up.

Existing discovery recovery assertions are preserved. Its immediate reload now explicitly handles the intentional beforeunload Stay dialog, waits for device durability if prompted, and then verifies the same lesson and session after reload. The new immediate-Redo test follows the same user path; a cancelled navigation has no load event, so its navigation wait is bounded separately from the recovery assertions.

Final reliability validation: frontend typecheck/lint PASS, 114 unit tests PASS, 85 frontend E2E PASS (two workers), 15 API E2E PASS, production build PASS (existing >500 kB chunk warning). Backend typecheck/lint PASS, 31 tests PASS, build PASS. git diff --check PASS with Git LF/CRLF notices. Four unit tests and three browser tests were added.

Earlier runs are not hidden: sandbox-only Vitest temporary-file ENOENT and PostgreSQL WAL permission failures prevented execution; reruns outside that sandbox passed. New test development exposed a duplicate error locator, mock literal-type error, capacity-test timeout and cancelled-navigation load wait; these were corrected without removing assertions. The full pre-final browser run recorded an unrelated invalid-catalog navigation ERR_ABORTED and an immediate-refresh harness timeout. A focused rerun passed the invalid route but encountered the new unload guard in the existing lesson-reload test. After explicit Stay/durability handling, the final complete 85-test run passed with retries disabled. No physical-panel validation was performed.
