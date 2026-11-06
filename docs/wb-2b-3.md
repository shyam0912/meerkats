# WB-2B.3 — editable English and Malayalam text

Starting checkpoint: `26fb6050e3e30471a0251c374537ebb0951bc9be`, branch `meerkats-v2`. No commit or push.

## Architecture decisions

Whiteboards upgrade to document version 4 only when the first text creation is committed. Each live or recoverably deleted page then has a `texts` array alongside existing ink and shapes. A text object has a stable UUID, exact Unicode string, logical origin and measured size, colour, font size and an explicit font identity. It contains no serialized Konva nodes or DOM markup. Annotation documents remain version 1; existing v1–v3 whiteboards retain their formats until text is added. Page, session, document and annotation identities are unchanged.

Version 4 is necessary because older readers cannot preserve editable text. New frontend and API shared contracts must be deployed together. Older strict readers reject v4; existing IndexedDB generation/version guards prevent replacing unreadable/newer snapshots. API revision and document-version checks reject new downgrade writes. Exact old pending mutations retain their original payload and mutation ID and are retried before the newer snapshot is sent under a new ID. Undoing the first text object does not downgrade the document. No SQL migration or IndexedDB version change is needed.

Creation, editing, movement and deletion use the existing page-local document history. Each Apply or completed move produces one action; unchanged edits and cancelled drafts produce none. Clear captures ink, eraser masks, shapes and text in one reversible action. Page deletion/restoration retains text. The 2 MiB aggregate serialized-document and 10,000-object per-page limits include text before accepting an action. A rejected edit remains in the editor for correction or copying.

## Editing and rendering

The Text tool opens a native textarea in a bottom tray outside the drawable canvas. It supports multiline input, colour and font-size selection, Apply and Cancel. Existing text can be opened with the Text tool or Select → Edit text. Completed text moves with pointer capture or arrow keys; Delete/Backspace or Delete text removes it. Next text reaches occluded text. Text is drawn above shapes and ink; the ink eraser does not remove text.

Composition events keep Apply disabled until composition ends, and Escape does not cancel active IME composition. Valid content is not normalized, trimmed, truncated or split into code units. Null characters and unpaired surrogates are rejected because PostgreSQL JSONB cannot preserve them as valid text. Explicit line breaks are retained; automatic wrapping is intentionally absent. Text must fit within 1200×675, at 16–96 logical px, no more than 4,096 Unicode code points / 24 explicit lines. Those are upper limits; scene fit can impose a smaller practical limit.

The bundled Noto Sans Malayalam font is loaded before measurement, rendering or PNG export. Whole explicit lines are shaped by the browser's native canvas `fillText`, avoiding Konva.Text's per-character wrapping. Board, thumbnails and export use the same drawing helper. Missing font loading prevents text commit and produces a visible error; saved content is not rewritten. English/Malayalam is the supported scope, not arbitrary script coverage.

Font provenance: Google Fonts `ofl/notosansmalayalam`, https://github.com/google/fonts/tree/main/ofl/notosansmalayalam . The original font is distributed with its SIL Open Font License. Local SHA-256: `312e0e7c3cc15fa09eb42a8f749eeb246b593ed420e3c81aafe8d910c3a6fb56`; 504,204 bytes. No npm dependency was added.

Text drafts remain outside the committed provider document. Pointer movement updates a canvas-local draft on animation frames; it creates no history or persistence writes. Existing ink ToolManager/pen/eraser code is unchanged. While typing, drawing/navigation/page/history controls are disabled; the status says `Text draft · Apply to save`. Beforeunload offers a browser warning for an unfinished edit. Drafts are not crash-recoverable, and browsers may bypass unload warnings on forced exits. Only applied text is durable. Undo history remains memory-only after reload.

Selection actions remain in the bottom toolbar, preserving P2-01. The export notification now occupies normal layout space instead of intercepting Undo at small viewports. No permanent sidebar or new floating selection controls were added.

## PostgreSQL encoding finding and deployment boundary

The Windows embedded PostgreSQL default initialized disposable tests and the existing development database as WIN1252. An actual Malayalam save failed with `character with byte sequence ... in encoding UTF8 has no equivalent in encoding WIN1252`. This is a database encoding problem, not a JSON schema migration.

New test/development clusters explicitly initialize with `--encoding=UTF8`. The local launcher warns about an existing non-UTF8 development database and leaves its data untouched. The existing development database was inspected and is WIN1252; it has NOT been converted, replaced, reseeded or used for multilingual API QA. Full API browser validation uses a separate disposable UTF8 cluster with the existing migrations and seed.

Before using the existing development database for Malayalam synchronization: take and verify a backup, restore into a separate UTF8 database, verify all session/document IDs, revisions, receipts, published lessons and row counts, run recovery/API checks, then explicitly approve switching the connection. Keep the old database as rollback evidence. Do not edit PostgreSQL encoding system catalogs or merely change client_encoding. No such migration or connection change was performed here. Local IndexedDB text durability works independently; server synchronization against the old WIN1252 database remains a known limitation.

## Test coverage and evidence

Added eight frontend unit cases, five frontend E2E cases, one API E2E case and one real-PostgreSQL backend case. Coverage includes exact Unicode, multiline edits, IME composition gating, cancel/no-op history, creation/edit/move/delete Undo/Redo, capacity rejection, page reorder/deletion/restoration, Clear-all, reload/Recent Boards, pending payload identity, unsupported versions, downgrade rejection and fresh-browser API recovery.

Independent browser QA used installed Google Chrome 156.0.8078.48 through the existing Playwright package, with fresh disposable profiles at 1920×1080, 1280×720 and 1024×600. It exercised native text entry, colour/size, stable edit IDs, reload guard, Escape and simulated touch cancellation/movement, Undo/Redo, editable recovery, page previews and actual downloads. Selected/unselected exports were byte-identical, proving selection controls were absent. Downloaded PNG glyphs and line breaks were visually inspected. Normal browser checks recorded no console/uncaught errors; a deliberate font request failure correctly blocked commit. This is not a physical Android keyboard, stylus or panel test, nor a teacher linguistic sign-off on every possible Malayalam sequence.

Evidence directory (outside source tree): `C:/Users/Jerry/.codex/visualizations/2026/09/18/01a0b307-d2be-7b92-9304-e08675a144a0/wb-2b-3`.

- `manual-results.json` and `manual.cjs`: independent browser actions/results.
- `manual-board-{1920,1280,1024}.png`: completed text and selection.
- `manual-editor-{1920,1280,1024}.png`: native editor and touch controls.
- `manual-thumbnail-{1920,1280,1024}.png`: page previews.
- `manual-export-{1920,1280,1024}.png`: actual PNG downloads.
- `manual-font-error.png`: intentional font-load failure.
- `frontend-e2e.log`: initial full run (106 passed, one intermittent existing shape-selection failure at 1280). The unchanged isolated test subsequently passed. Cause not established; not hidden as a clean initial run.

Initial new-test failures also identified and corrected export-message overlap at 1024 and an invalid new-test attempt to click disabled Undo. Existing tests were not weakened. The initial backend run had 33 pass/1 fail before the UTF8 fixture correction. One accidental sandbox diagnostic run encountered Vitest temporary-module ENOENT before executing tests; it was not an application-test result.

## Changed-file manifest

Modified:

- contracts/index.ts
- server/scripts/local-db.ts
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
- src/store/DrawingProvider.tsx
- src/store/drawing-context.ts

Created:

- docs/wb-2b-3.md
- public/fonts/NotoSansMalayalam.ttf
- public/fonts/OFL-NotoSansMalayalam.txt
- src/components/whiteboard/TextEditor.tsx
- src/drawing/teachingText.ts
- src/drawing/teachingText.test.ts
- src/persistence/text.test.ts
- tests/e2e/whiteboard-text.spec.ts
- tests/api-e2e/whiteboard-text.spec.ts

No files removed. No package/lockfile, SQL schema/migration, lesson, Classroom catalog or Lab implementation changes. Backend service implementation is unchanged; the shared document contract, UTF8 local launcher and backend regression test are the necessary server-facing changes.

## Final validation ledger

- Frontend `npm run typecheck`: PASS.
- Frontend `npm run lint`: PASS.
- Frontend `npm test`: PASS, 154 tests in 20 files (8 new cases).
- Frontend `npm run build`: PASS, 266 modules; main JavaScript 741.01 kB / 224.74 kB gzip. Existing >500 kB chunk warning remains. Bundled font adds 504,204 bytes, loaded on text use.
- Backend `npm run typecheck`: PASS.
- Backend `npm run lint`: PASS.
- Backend `npm test`: PASS, 34 tests in 2 files (1 new case), isolated UTF8 PostgreSQL.
- Backend `npm run build`: PASS.

Full browser-suite results and final Git checks are recorded after completion below.
- Final full frontend `npm run test:e2e -- --workers=2`: PASS, 107 tests (5 new), no skips, 5.8 minutes. The earlier 106/107 run and unchanged isolated rerun remain reported above.
- API test-launcher environment note: its first external launcher invocation failed before tests because Windows ESM imports require a file URL. Corrected only the external evidence runner; no application/test assertions changed.
- Final `npm run test:e2e:api`: PASS, 19 tests (1 new), no skips, 1.7 minutes. Existing migrations/seed applied only to the isolated UTF8 QA database. It was stopped and removed after the run; the development database was untouched.
- `git diff --check`: PASS (Git reports its existing LF-to-CRLF working-copy notices, not whitespace errors).
- Final branch/HEAD remain `meerkats-v2` / `26fb6050e3e30471a0251c374537ebb0951bc9be`. Working tree: 14 modified, 9 new, 0 deleted, none staged. No commits or pushes.
- Protected local refs remain `main` = `133c2ad7df2f72fad746b9536b2d9283ecd872ef`, `gpt6-astra-rework` = `9474adcf559b8e2dc5417d9052115fcc537eb3ed`.

## QA-TEXT-01 targeted correction

Independent QA found that overlapping text could steal input from a visible selected-shape resize handle. Pointer-down had tested text first and suppressed shape-handle picking. The correction is confined to DrawingCanvas hit-testing: selected-shape handles first, then the selected object's hit-tested body, then ordinary front-to-back text/shape selection, then empty-canvas deselection. The existing pointer capture, draft completion/cancellation, tool lifecycle, reducers, schemas and persistence are unchanged.

A selected object retains manipulation ownership through overlaps. Use Escape/empty space to deselect, or Next text/Next shape to choose an occluded object. The Text tool still opens text directly for editing. No floating controls or UI redesign were introduced.

Four permanent Playwright regressions were added in tests/e2e/text-shape-priority.spec.ts. They cover the original reproduction at all three viewports, all rectangle/triangle corner and rotation handles under a large text object, an additional overlapping shape, selected-body movement, ordinary text selection/edit access, single-action Undo/Redo, unchanged non-target objects, Escape, pointer cancellation, simulated touch, reload and actual selection-free PNG comparison.

The new test was run before the correction and failed on unchanged rectangle geometry, reproducing the defect. After correction, all four tests passed. An initial expanded-test run stopped on exact floating-point coordinate comparisons differing by less than 0.00002 logical units; only those new geometric assertions were corrected to subpixel tolerance. Existing tests were not weakened or skipped.

Correction-specific repository changes: src/components/workspace/DrawingCanvas.tsx; tests/e2e/text-shape-priority.spec.ts (new); this document. All prior WB-2B.3 files are preserved. Independent before/after evidence is outside the repo in C:/Users/Jerry/.codex/visualizations/2026/09/18/01a0b307-d2be-7b92-9304-e08675a144a0/qa-text-01-fix .

### Correction validation and acceptance

- Frontend typecheck, lint and build: PASS. Unit tests: 154 passed in 20 files. Build retains the existing large-chunk warning (main JavaScript 741.06 kB / 224.78 kB gzip).
- Backend typecheck, lint and build: PASS. Backend tests: 34 passed in 2 files.
- Full frontend E2E: final isolated run 111 passed (four new tests), no skips or retries. The first full run was 110 passed / 1 failed: an existing 1280 toolbar test timed out on disabled Undo after an unexpected document reload. Its trace shows a second document navigation and Vite/React initialization mid-test. The reload trigger remains unconfirmed; no application code or existing assertions were changed to obtain the subsequent pass.
- API E2E: final diagnostic run 19 passed. First run: 7 passed / 12 failed, comprising a discovery loading-state timeout followed by 11 connection-refused failures on the Vite port. Diagnostic rerun passed without code/test changes; the original server-exit trigger remains unconfirmed. Both runs used disposable UTF8 PostgreSQL clusters, stopped and removed afterward. The existing development database was untouched.
- Independent installed-Chrome browser checks: original overlap reproduction passes at 1920x1080, 1280x720 and 1024x600, with changed rectangle geometry, unchanged text and retained shape selection. Simulated touch cancellation passes at all three. Broad text/shape/ink/Clear/page/reload/Recent Boards/export workflows passed at 1920 and 1024 initially. The initial 1280 workflow recovered only four of five texts following an unexpected state reset; that failure is retained. An isolated 1280 rerun completed all checks, with no console errors, failed requests or document overflow. This is not proof of the earlier reset's root cause.
- Actual downloaded PNGs were inspected. Text, Malayalam glyphs, line breaks, shapes, ink and grid render without editing UI. Selected and unselected exports are byte-identical. Corrected overlap screenshots were visually reviewed at all supported resolutions.
- No physical Android panel, stylus or native Android IME validation is claimed. Development-server reload/exit intermittency remains a testing-environment limitation requiring monitoring. The pre-existing WIN1252 database still requires a separately approved UTF8 migration for multilingual server use.
- Correction-only manifest: DrawingCanvas.tsx, this document, and new text-shape-priority.spec.ts. Before/after hashes confirm every other pre-existing WB-2B.3 file is unchanged. Combined working tree: 14 modified, 10 new, 0 deleted. Nothing staged, committed or pushed; starting HEAD and protected local branches unchanged.
