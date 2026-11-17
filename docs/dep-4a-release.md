# DEP-4A — Standard 1 public release preparation

Base checkpoint: `16a07570138366730bdd22ffcabb36c48324e679` on `meerkats-v2`.
This is an uncommitted release candidate. No commit, push or Cloudflare deployment is authorized by this preparation task.

## Scope and release identity

The public catalog now includes the existing immutable Standard 1 Mathematics lesson, **Same Number, Different Arrangements**, alongside Chemistry and Physics. It remains **Original Demo Concept — Preview / Teacher Review Pending**, not an official SCERT chapter. The internal engineering fixture stays excluded.

The only runtime change is the public catalog import/composition. No lesson payload, stable ID, drawing code, document contract, persistence code, backend, dependency, database or Cloudflare configuration changes are required. API access remains forcibly disabled by the existing demo build configuration. Fonts, notices, branding, browser-local saving and public access without login are unchanged.

The review artifact displays `16a075701383-dirty`. This is intentional: the catalog change has not been committed. Do not publish this candidate as a clean Git release. After owner checkpoint approval, build from the resulting clean commit, rerun compiled acceptance, verify the Home release identifier, and create a new archive and checksum manifest for those exact bytes. The dirty candidate's checksums are not transferable to the clean build.

## Compatibility acceptance

Two complementary runners cover rollback:

1. `node tests/compatibility/public-demo-upgrade.mjs` consumes the archived public build for `45388239dd8418aeb50d34c6d3cf089624d135d8`. Set `OLD_DEMO_DIR` to its extracted files and `OLD_DEMO_MANIFEST` to its approved SHA-256 manifest. The runner verifies the complete file list and every hash before launching Chrome. `COMPAT_OUTPUT` can select an evidence directory outside the repository.
2. `node tests/compatibility/counting-previous-release.mjs` archives the actual previous source and exercises the old repository save guard, including refusal to overwrite an unsupported record with a valid older-format candidate.

The compiled runner fulfills all network requests from local artifacts at the same simulated HTTPS origin, using one disposable profile per viewport. It does not contact or change the live Worker. At 1920×1080, 1280×720 and 1024×600 it creates old-version boards containing ink, eraser masks, all five shapes, English/Malayalam/mixed text, two pages and backgrounds; creates Chemistry and Physics progress; upgrades; checks exact saved data; edits/reloads/reopens through Recent Boards; and compares actual PNG downloads byte-for-byte before editing.

It then creates Standard 1 progress, inserts an isolated pending retry, switches to the old compiled client, checks safe rejection and exact raw-record preservation, exercises older Recent Boards and existing lesson recovery, and returns to the candidate. The complete lesson state and pending mutation must survive. Traces, raw records, screenshots and JSON results are retained, including on failure.

Whiteboard document v4 and IndexedDB schema v3 remain unchanged. Existing boards and lessons require no migration. The older release does not understand counting sessions: rollback preserves their records but cannot offer the counting activity until a compatible release is restored. Do not clear storage, reset sessions, rewrite pending mutation IDs, or claim that rollback retains Standard 1 functionality.

## Validation commands

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e -- --workers=1
npm.cmd run test:demo
node tests/compatibility/counting-previous-release.mjs
# Set OLD_DEMO_DIR and OLD_DEMO_MANIFEST before this command:
node tests/compatibility/public-demo-upgrade.mjs
git diff --check
```

Run builds and source edits separately from Vite development E2E tests: a Vite full-reload message can reset transient selection/history during a test. Do not suppress unexpected-navigation checks or increase timeouts to hide this. Compiled regression tests use the existing tests against `vite preview --mode demo`, without rebuilding during browser interactions.

`npm run test:demo` includes a production build with `VITE_API_ENABLED=true` supplied as a negative test. Existing assertions require zero application API/external requests, notices with complete license texts, bundled Malayalam font, no engineering fixtures/internal paths/secrets, SPA deep links and local-only save messaging. Three added compiled tests exercise Standard 1 in English/Malayalam, pointer rearrangement, counting help, touch-sized controls, annotation/Whiteboard independence and reload recovery.

## Release archive and dry-run

Keep release archives, SHA-256 manifests, traces, screenshots and downloaded PNGs outside Git. The manifest must cover every file recursively in `dist-demo/`; reject missing, additional or changed files. Rebuild once and compare the exact path/hash set to establish reproducibility on the same toolchain and lockfile. The upload remains static assets only, with no API, secret or database bindings.

Approved tooling and target:

```powershell
$env:CLOUDFLARE_ACCOUNT_ID='fb1836b8c1a52e48da0ce1e5f0bfb39d'
$env:WRANGLER_SEND_METRICS='false'
npm.cmd exec --yes --registry=https://registry.npmjs.org --package=wrangler@4.159.0 -- wrangler deployments list --config wrangler.jsonc
npm.cmd exec --yes --registry=https://registry.npmjs.org --package=wrangler@4.159.0 -- wrangler deploy --dry-run --config wrangler.jsonc
```

Worker: `project`; public origin: `https://project.meerkats-demo.workers.dev`. Keep Workers Free, managed HTTPS, public access and manual deployment. No plan, access, domain or Git-integration changes are part of this release. Dry-run success is not deployment approval.

## Rollback procedure after a separately approved deployment

The recorded current deployment is Worker version `174366d9-44ba-4b67-a08c-688ec0b9016f`, release `45388239dd84`. Reconfirm it with the read-only deployments command immediately before publishing and retain its archive and manifest.

If a critical live regression occurs, use Cloudflare Workers → project → Deployments to restore that verified version, or, with release approval, run:

```powershell
npm.cmd exec --yes --registry=https://registry.npmjs.org --package=wrangler@4.159.0 -- wrangler rollback 174366d9-44ba-4b67-a08c-688ec0b9016f --config wrangler.jsonc
```

Do not execute rollback during preparation. Keep the same hostname and browser data. Verify Home's previous release ID, existing boards/PNG/Recent Boards, Chemistry and Physics. Expect new Standard 1 URLs to show the safe recovery screen; explain that the saved work is retained and requires a counting-capable release. Restore the corrected compatible release to regain access. A server rollback does not restore browser data that the user deleted.

## Remaining release gates

- Owner review, separate Git checkpoint approval, clean rebuild/checksums and separate deployment approval.
- Signed-out live acceptance after deployment; local artifact testing cannot prove CDN/access behavior for an unpublished version.
- Physical iPad Safari, Apple Pencil and Android interactive-panel testing remains outstanding. Desktop Chrome and simulated touch are not hardware validation.
- Browser-local storage remains profile/origin-specific and vulnerable to eviction, private-session closure or manual deletion. There is no cloud synchronization or editable cloud backup.
- Academic review and Malayalam wording review remain pending; publication does not change these labels.

## DEP-4A validation record

| Check | Observed result |
| --- | --- |
| Frontend typecheck / lint | PASS / PASS |
| Unit tests | 184 passed, 25 files |
| Full frontend E2E, final uninterrupted run | 139 passed, 10.5 minutes, zero retries |
| Compiled public-demo acceptance | 12 passed, including three new Standard 1 viewport cases |
| Expanded existing tests against compiled demo | 80 passed; one development-only fault-injection URL mismatch, explained below |
| Correct compiled Chemistry fault injection | 1 passed; keyboard/reset, asset failure fallback and usable Whiteboard |
| Archived compiled old/new/old/new compatibility | All three viewports passed; every old artifact file verified before testing |
| Actual old-client repository guard | Six rejection/preservation assertions passed |
| Standard production build / demo production build | PASS / PASS |
| Wrangler 4.159.0 dry-run | PASS; target `project`, no bindings, no deployment |
| Git whitespace | PASS |

All automated browser checks used installed Google Chrome. The compiled acceptance monitor reported no unexpected console/page errors, external requests or application API requests. Screenshots were inspected at all three resolutions, including the Malayalam settings tray at 1024×600. Downloaded PNG inspection confirmed ink, the erased gap, five shapes, English/Malayalam text, line breaks and grid; no editing controls were exported.

Failures are retained rather than omitted:

1. The first full development E2E run passed 138/139. The 1280 shape-transform test received Vite's `full-reload` WebSocket message; CDP identified `@vite/client` as the navigation initiator. Revision 18 was confirmed durable before the reload and restored at revision 18 afterward. Selection reset caused the rotation-handle wait to time out. The exact watched-file trigger was not recorded; source/build work was occurring concurrently. The unchanged isolated test passed, then the complete suite passed with no source edits or builds during execution. No assertion or timeout was weakened.
2. The expanded compiled run passed 80/81. Its existing Chemistry fault-injection test blocks `/src/activities/kinds/MoleculeBuilder.tsx`, which is a development URL. The compiled build therefore loaded successfully instead of displaying the expected error. A separate compiled test blocked `/assets/MoleculeBuilder-*.js`, asserted that interception occurred, and verified the same fallback and Whiteboard behavior. The original development test remains unchanged and passed in the full frontend suite.

The candidate artifact contains 22 regular files totaling 1,385,539 bytes. Wrangler reports 24 entries during scanning; the independently verified archive/manifest contains 22 files. The existing main-JavaScript chunk-size warning remains. No backend/API E2E or database suite was rerun for this catalog-only release change; backend and synchronization contracts are unchanged, and API-disabled behavior is tested in the compiled artifact.

Evidence is kept outside the repository in the DEP-4A visualization directory: validation logs, compatibility traces/raw records, nine activity screenshots, PNG downloads, candidate ZIP and SHA-256 manifests. The archive is a review candidate, not authorization to deploy.
