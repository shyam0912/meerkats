# DEP-5A — Standard 2 public release preparation

Base: `fdf342e3776da437bbee7385b853bc503313a9e2`, branch `meerkats-v2`. Preparation only: no commit, push or deployment. The review artifact honestly uses `fdf342e3776d-dirty`; after separate checkpoint approval, rebuild and validate the new clean SHA before publication.

## Scope

Add the existing immutable Standard 2 Build a Plant lesson to the public catalog alongside Standard 1 Mathematics, Chemistry and Physics. Preserve Original Demo Concept — Preview / Teacher Review Pending. No SCERT alignment is claimed. No activity, drawing, storage, synchronization, backend, dependency or database changes.

The original botanical SVG and bilingual explanations are unchanged. Water/light demonstrate transport and food-making, not instant growth or wilting. Teacher academic and Malayalam review remains pending.

## Validation and compatibility

Run frontend typecheck, lint, unit tests, full E2E, standard production build and `npm run test:demo`. The latter deliberately supplies an API-enabled environment: demo mode must override it and make no application API requests. Tests require complete third-party notices, bundled Malayalam font, favicon, static SPA routes, no engineering fixture/internal paths/credentials, and local-only save messages.

Three compiled Standard 2 cases exercise assembly, inspection, water/light, Malayalam, Focus, annotation, independent Whiteboard and exact refresh recovery at 1920×1080, 1280×720 and 1024×600. Screenshots cover empty/full plant, demonstrations, settings, Malayalam and Focus. The existing Whiteboard and three other public activities remain covered.

`tests/compatibility/plant-public-upgrade.mjs` requires `OLD_DEMO_DIR` and `OLD_DEMO_MANIFEST` pointing to the verified archived live `75e62033dbbd` build. `COMPAT_OUTPUT` should be outside Vite's watched tree. It verifies every old file, then uses the same disposable browser profile and origin through old → candidate → old → candidate. All requests are fulfilled from local artifacts; no live browser records or deployment are touched.

The test creates old multi-page ink/shapes/multilingual text, backgrounds, Chemistry, Physics and counting progress. It checks exact saved content after upgrade, unchanged PNG bytes before editing, editing/reload/Recent Boards, rollback readability and new Standard 2 safe rejection. Plant raw records and an injected disposable pending retry must remain exact during rollback; returning to the candidate restores the lesson and pending payload/ID. Whiteboard v4 and IndexedDB v3 remain unchanged. Older-client rejection is data preservation, not availability of the unsupported activity.

Run browser suites sequentially with external output directories and no source edits/builds during development E2E. Archive extraction and HTML traces inside a watched Vite tree can cause full reloads. Never hide failures by weakening assertions or adding retries.

## Artifact and dry-run

Evidence, archives, SHA-256 manifests and downloaded PNGs belong outside Git. Hash all regular files recursively in `dist-demo/`, verify an independently extracted ZIP, and compare a second build's exact path/hash set using the same lockfile/toolchain. Public-demo tests cover API-disabled operation and package/font licenses. No credentials, database bindings, backend routes or environment files belong in the upload.

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e -- --workers=2 --output <external-evidence>/frontend
npm.cmd run build
npm.cmd run test:demo -- --output <external-evidence>/demo
# Set OLD_DEMO_DIR / OLD_DEMO_MANIFEST / COMPAT_OUTPUT:
node tests/compatibility/plant-public-upgrade.mjs
git diff --check
$env:CLOUDFLARE_ACCOUNT_ID='fb1836b8c1a52e48da0ce1e5f0bfb39d'
$env:WRANGLER_SEND_METRICS='false'
npm.cmd exec --yes --registry=https://registry.npmjs.org --package=wrangler@4.159.0 -- wrangler deploy --dry-run --config wrangler.jsonc
```

Target stays `project`, `https://project.meerkats-demo.workers.dev/`, Workers Free, public HTTPS, manual deployment only. No hosting settings are changed. `wrangler.jsonc` remains unchanged, static-assets-only, no bindings. Dry-run does not publish.

## Rollback after separate deployment approval

Read-only deployment inspection during DEP-5A identified current live version `0742417f-69b4-460c-bcf7-bb639d230fa5`, release `75e62033dbbd`. Its DEP-4B archive is `dist-demo-75e62033dbbd.zip`, SHA-256 `ef39450da47d25bb04c3fbdfa435cd6ee72691ccffeb04e688ab1f5a0f4d51f8`. Retain that archive and full per-file manifest; reconfirm the live version immediately before any separately approved deployment.

For a critical post-deployment regression, restore that verified Worker version through the dashboard or the approved pinned Wrangler rollback command. Do not execute rollback during preparation. Keep the origin, browser data and unsupported plant records intact. Verify Home's old identifier, Whiteboard/PNG/Recent Boards, Chemistry, Physics and Standard 1; Standard 2 should show safe recovery, not reset or corrupt the session. A later compatible release restores access. Cloudflare rollback cannot restore deleted browser storage.

After separately approved publication, if rollback is required and the recorded target is reconfirmed:

```powershell
npm.cmd exec --yes --registry=https://registry.npmjs.org --package=wrangler@4.159.0 -- wrangler rollback 0742417f-69b4-460c-bcf7-bb639d230fa5 --config wrangler.jsonc
```

## Release gates and limitations

Owner review → separately approved checkpoint → clean rebuild and checksum/archive refresh → compiled acceptance/compatibility → separately approved deployment. This candidate is not a clean production release. No physical iPad Safari, Apple Pencil or Android-panel validation is claimed. Local saves remain origin/profile-specific and can be lost through storage deletion/eviction or forced interruption before transaction completion. No backend or cloud backup is enabled. Verify signed-out CDN behavior and all deployed asset checksums only after publication approval.

## Completed validation record

| Check | Result |
| --- | --- |
| Frontend typecheck / lint | PASS / PASS |
| Unit tests | 190 passed, 26 files |
| Full frontend E2E | 146 passed, zero retries, 6.7 minutes |
| Standard production build | PASS |
| Compiled public-demo suite, including three new plant viewport cases | 15 passed, zero retries |
| Compiled archived old/new/old/new compatibility | PASS at all three viewports |
| Current public release integrity | All 22 live HTTPS files match the archived rollback manifest |
| Candidate reproducibility | All 24 rebuilt files match tested SHA-256 hashes exactly |
| Independently extracted candidate ZIP | All paths and hashes match the tested artifact |
| Public packaging and credential checks | PASS; notices, font, favicon, static-only files; no detected credential/development markers |
| Wrangler 4.159.0 dry-run | PASS, no bindings, no deployment |

Existing boards preserve page/object IDs, ink/eraser masks, five shape types, multilingual multiline text, backgrounds and page order. Pre-edit PNGs are byte-identical across upgrade; editing/reload/Recent Boards still work. Chemistry, Physics and Standard 1 progress remain exact. Older-client Standard 2 rejection and Recent Boards leave its raw record unchanged; returning to the candidate restores the same pending mutation ID/payload and lesson/board/annotation state.

Installed Chrome performed the interactions. Screenshot inspection covered empty/full plant, water/light, Malayalam settings and Focus across the requested resolutions. No unintended scrolling/clipping was observed in those cases; compiled assertions checked 56 CSS px primary controls and part targets. Compiled acceptance and compatibility monitors recorded no unexpected console errors, external requests or application API requests. Downloaded PNG inspection showed all five shapes, ink with an erased gap, grid and English/Malayalam multiline text without editor controls.

No automated suite failures or retries occurred. Expected failed-module console errors in development E2E are deliberate fallback tests and passed. A standalone packaging assertion initially used a mistyped 13-character expected SHA; the build and Home tests already used the correct 12-character Git value. Corrected the archive label/documentation and reverified from `git rev-parse --short=12 HEAD`, without application changes. Vite's existing main-chunk warning remains (about 662 kB minified). Backend/API database suites were not rerun for this catalog-only change; no backend or contract file changed.

Evidence root: `C:/Users/Jerry/.codex/visualizations/2026/09/18/01a0b307-d2be-7b92-9304-e08675a144a0/DEP-5A/`.
It contains frontend/demo logs, production screenshots, compatibility traces/raw records/downloaded PNGs, `current-live-checksums.json`, `SHA256SUMS.txt`, `tested-artifact-manifest.json`, `reproducibility.json`, `release-preparation.json` and the dry-run log.

Candidate: `dist-demo-fdf342e3776d-dirty.zip`; 24 regular files, 1,408,399 uncompressed bytes. ZIP SHA-256: `3e5a7f2574a573328b87400b815289af0c1b6e446d843e8db74485902644cfe7`. Wrangler reports 26 entries during scanning; the manifest and extracted ZIP contain 24 regular files. Do not deploy this dirty review candidate as a clean checkpoint release.

Exact source scope: four modified files (`src/activities/public-catalog.ts`, `src/activities/public-catalog.test.ts`, `tests/demo/static-demo.spec.ts`, `docs/public-demo.md`) and two new files (`tests/compatibility/plant-public-upgrade.mjs`, `docs/dep-5a-release.md`). No deletions. All changes remain unstaged; no commit, push or deployment.
