# Public Meerkats demo

Teachers and school partners can open Classroom or Whiteboard without signing in. Cloudflare serves only the contents of `dist-demo/`. The intended address is `https://meerkats-demo.<account-subdomain>.workers.dev`. Wrangler prints the actual HTTPS URL on deployment. Keep that origin stable so returning teachers can reopen their boards.

## Hosting and cost

Use Workers Free and its included workers.dev hostname. The configuration serves static files with SPA fallback and has no Worker script, service bindings or custom routes. Version preview URLs are disabled. Cloudflare provides HTTPS for the workers.dev address. [workers.dev routing](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/) · [SPA navigation](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)

Expected hosting cost for this configuration is **$0/month**. Cloudflare lists static asset requests as free and unlimited, with no extra asset storage charge. Workers Free permits 20,000 files per version and 25 MiB per file. Drawing, local saves and PNG generation happen on the visitor’s device. At each release, check the artifact against the file limits and confirm the account plan. Adding a Worker script, paid services, large media or a purchased domain would require a new cost review. [Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) · [Platform limits](https://developers.cloudflare.com/workers/platform/limits/#static-assets)

## Prepare the release

1. Use a clean checkout of the approved Git SHA and the root lockfile. The reference toolchain is Node 24.15.0 and npm 11.12.1. On a fresh release workstation run `npm ci --include=dev`. Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run test:e2e`. For installed Chrome, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable.
2. Run `npm run test:demo`. It builds and tests the production artifact with an API-enabled environment as a negative test. Demo mode forces `VITE_API_ENABLED=false`, ignores dotenv files and prevents automatic client environment-variable exposure. For a standalone build use `npm run build:demo`. For local inspection run `npm run preview -- --mode demo --host 127.0.0.1 --port 4174 --strictPort`.
3. After checkpoint approval, build from the resulting commit with an empty `git status --porcelain`. Verify the **Demo Version** on Home equals `git rev-parse --short=12 HEAD` without a `-dirty` suffix. Rebuild with the same toolchain and lockfile and compare the relative paths and SHA-256 checksums of every output file. Archive the tested bytes with the full Git SHA for rollback.

## Public artifact review

The upload contains the SPA, compiled JS/CSS, the active favicon, `THIRD-PARTY-NOTICES.txt`, and the Malayalam font with its OFL. The demo test fetches the notices from the built site and compares license texts with the installed packages. Keep the notices with the artifact; re-audit changes to the bundled packages, generated helpers and embedded credits when upgrading dependencies.

Vite derives the JS inventory from the emitted chunks, including lazy activities and transitive packages. The audited packages are its-fine, Konva, React, React DOM, React Konva, React Reconciler, React Router, Scheduler and Zod. Each supplies an MIT license. The release also includes MIT notices for Tailwind CSS, Vite and Rolldown helpers and credits for embedded code including Konva's StackBlur. The font's full license and copyright remain in `fonts/OFL-NotoSansMalayalam.txt`.

The public catalog includes only the Chemistry and Physics previews. It retains the published lesson, activity and scene IDs, source titles, editions, page references and teacher-review status. The engineering fixture and Chemistry authoring note belong to the development catalog. The favicon reuses the Home symbol in Meerkats deep teal.

### Lesson rights and attribution

| Public experience | Source and material present |
| --- | --- |
| From carbon chains to isomers | SCERT Kerala, Standard X Chemistry, Part I, English Medium, first edition 2025, pp. 7–10 and 25–26. The unit heading and chemical names correspond to the textbook. Seven interactive steps use pentane and 2-methylbutane to explore chains, numbering, naming and isomerism. Meerkats renders the two bond graphs from atom and bond data. |
| Lenses | SCERT Kerala, Standard X Physics, Part I, first edition 2025, Chapter 2, pp. 27–40. The chapter name, optics terms and standard ray constructions correspond to the reference. Meerkats computes the rays, arrows and image readout from the ideal thin-lens model as the teacher moves the object. |

Review of the cited pages, lesson data and renderers found no embedded textbook scans, copied pictures, tables or reproduced explanatory passages. Both textbook references are credited to SCERT Kerala / Department of General Education, Government of Kerala. The owner should record the public-distribution basis and any required attribution for the actual worked examples and presentations before publishing. Both experiences remain **Preview / Teacher Review Pending**. Technical publication pins a version for session recovery.

## Publish manually after approval

1. Select the project’s Cloudflare Workers Free account and configure its free workers.dev subdomain. Use a dedicated `meerkats-demo` Worker name. At first release, confirm the name is unused. For later releases, confirm it identifies this demo. Leave Git integration and automatic builds disconnected. Visitors need neither a login nor an email invitation. If an account-wide policy prevents public access, choose an appropriate demo account or scope the policy change to this demo.
2. Using an approved, pinned Wrangler CLI on the operator workstation, confirm `wrangler --version` and `wrangler whoami`. Keep operator credentials outside the frontend. From the repository root with the tested artifact in place, run `wrangler deploy --config wrangler.jsonc`. This command publishes immediately. Record the HTTPS URL, Worker version ID, release SHA, and previous known-good version.
3. In a signed-out browser, open the printed URL and a direct `/catalog` link. Check the release and local-storage notice, load Chemistry and Physics, and try two lines of mixed Malayalam/English board text, Duplicate and PNG export. After “Saved on this device,” refresh the workspace URL and reopen the same board through Recent Boards. Verify a fresh profile has no access to the first profile’s board. Check the network panel for successful JS/CSS/font loads and zero application API calls. A JSON request to `/api/v1/health` must not reach a development service. A browser navigation can receive the SPA shell for unmatched paths.
4. Check Windows Chrome/Edge, iPad Safari (rotation, input and PNG download/share), and Android touch browsers before advertising device support. Physical Android 14 panels need a separate trial. Share the verified workers.dev URL. For feedback, ask for the release ID, device, browser and reproduction steps through the project’s existing contact channel.

## Local data and rollback

IndexedDB stores editable boards in the same profile on the same site. Recent Boards is visible to other people using that profile. Use sample data on shared devices. A workspace link identifies a local session and does not transfer it to another person or browser. Private browsing, storage eviction or clearing site data can remove boards. PNG preserves a picture of a page. The demo offers no editable cloud backup or cross-device sync. An initial visit and uncached lesson assets require connectivity.

For a regression, choose the recorded compatible Worker version under Workers → Deployments and roll it back, or manually redeploy the archived known-good files. Keep the hostname and check that the older build can read current local document versions before sending users back. Verify the Home release ID, an existing disposable board, PNG export and both lessons. A rollback changes what the browser loads and does not restore erased IndexedDB records. For an accidental public disclosure, disable the demo route, revoke exposed credentials if applicable and replace the artifact before re-enabling it. Downloaded copies cannot be recalled. [Worker rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
