# DEP-6A — Standard 3 public release preparation

Base: `6404937811a2e8763b35c915dc18ca461393a2be`, branch `meerkats-v2`. Preparation only: no commit, push or deployment. The candidate must honestly display `6404937811a2-dirty`. A clean publication artifact requires a separately approved checkpoint, rebuild and acceptance run.

## Scope and attribution

Include the existing immutable Interactive Fractions lesson in public discovery: Classroom → Standard 3 → Mathematics → Original Demo Concepts → Interactive Fractions → Start teaching. Retain Standard 1, Standard 2, Chemistry, Physics and Whiteboard Pro. The engineering fixture remains excluded.

Keep Original Demo Concept — Preview / Teacher Review Pending. This is not a verified Kerala SCERT chapter. The original bar graphics, bilingual labels, mathematical rules and lesson identity remain unchanged. Academic and Malayalam terminology review is still pending. No activity implementation, drawing engine, document v4, IndexedDB version, synchronization contract, backend, database or dependency changes are part of this release preparation.

## Validation

Use the existing installed Chrome and locked dependencies. Keep browser suites sequential, with outputs outside Vite's watched project tree. Do not edit source or rebuild while the development E2E suite is running.

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
$env:CI='true'
$env:VITE_API_ENABLED='false'
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e -- --workers=2 --output <external-evidence>/frontend
npm.cmd run build
npm.cmd run test:demo -- --output <external-evidence>/demo
# test:demo builds dist-demo with a deliberately API-enabled environment;
# demo mode must override it and produce no application API requests.
git diff --check
```

Compiled acceptance covers three viewports (1920×1080, 1280×720, 1024×600), discovery, equal wholes, half/quarter equivalence, drag/tap/keyboard placement, invalid/cancelled drops, labels/guides, reset confirmation, Malayalam, Focus, annotation isolation, independent Whiteboard and exact refresh/session-URL recovery. Existing demo cases cover PNG export, Recent Boards, fonts, notices, branding, SPA routing and all four previous activities.

## Upgrade and rollback rehearsal

`tests/compatibility/fractions-public-upgrade.mjs` requires `OLD_DEMO_DIR` and `OLD_DEMO_MANIFEST` for the archived live `5b3808165989` artifact. Set `COMPAT_OUTPUT` to a fresh external evidence directory. The script verifies every old asset and uses a disposable persistent Chrome profile per viewport at the actual HTTPS origin. All requests are fulfilled from local artifacts: no deployment or real user storage is touched.

The sequence is old → candidate → old → candidate. It creates multi-page ink, all five shapes, English/Malayalam text, backgrounds and all four existing Classroom sessions on the old build. It checks exact saved content, unchanged PNG bytes before editing, editing/reload/Recent Boards and existing lessons through upgrade and rollback. Candidate fraction sessions include bilingual placements and annotation. Disposable pending progress and Whiteboard mutations are injected while the session is unmounted; the older client must reject the unsupported session and preserve the complete raw record. Returning to the candidate must recover exact lesson, annotation, Whiteboard and pending mutation identities/payloads. No browser data is cleared.

```powershell
# Point these to the verified DEP-5B release archive extraction and manifest:
$env:OLD_DEMO_DIR='<verified-old-artifact>'
$env:OLD_DEMO_MANIFEST='<verified-old-SHA256SUMS.txt>'
$env:COMPAT_OUTPUT='<external-evidence>/compatibility'
node tests/compatibility/fractions-public-upgrade.mjs
```

## Artifacts and Cloudflare dry-run

Retain the existing live archive `dist-demo-5b3808165989.zip`, SHA-256 `98dac562635f8fe483713f1310f207e9326a75942f273fb28b442c196047fb95`, and its 24-file manifest. Current rollback Worker version: `452d119e-e49e-4ea1-a8cd-787d7432cbf7`. Reconfirm this read-only before publication.

Record every candidate asset SHA-256, archive the exact tested `dist-demo/`, verify extracted ZIP contents against the manifest, and compare a second build with identical sources, lockfile and toolchain. Keep artifacts and profiles outside Git. Preserve third-party notices, font license, favicon and API-disabled build configuration.

```powershell
$env:CLOUDFLARE_ACCOUNT_ID='fb1836b8c1a52e48da0ce1e5f0bfb39d'
$env:WRANGLER_SEND_METRICS='false'
npm.cmd exec --yes --registry=https://registry.npmjs.org --package=wrangler@4.159.0 -- wrangler whoami
npm.cmd exec --yes --registry=https://registry.npmjs.org --package=wrangler@4.159.0 -- wrangler deployments list --config wrangler.jsonc
npm.cmd exec --yes --registry=https://registry.npmjs.org --package=wrangler@4.159.0 -- wrangler deploy --dry-run --config wrangler.jsonc
```

Target remains Worker `project`, `https://project.meerkats-demo.workers.dev/`, Workers Free, public access without login, static assets only and manual deployment. No Git connection, bindings, access policy or routing changes are authorized.

After separate checkpoint and deployment approval, rebuild the clean SHA, repeat compiled acceptance/compatibility, verify its manifest, then use the pinned Wrangler deploy command without `--dry-run`. That publication is not authorized by DEP-6A.

For a critical post-publication regression, reconfirm and restore version `452d119e-e49e-4ea1-a8cd-787d7432cbf7` with pinned Wrangler `rollback <version> --config wrangler.jsonc`. Do not execute rollback during this preparation. Keep the origin and unsupported fraction records intact; verify old Home identifier, Whiteboard/PNG/Recent Boards and all four supported lessons. Old clients preserve fraction data but cannot operate that activity. Cloudflare rollback cannot recover deleted browser-local storage.

## Limitations

Physical iPad Safari, Apple Pencil and Android panel acceptance remains outstanding. Desktop Chrome touch emulation is not hardware validation. Local-only saving does not provide cloud backup or cross-device recovery. A dirty review artifact is not the final clean release.
