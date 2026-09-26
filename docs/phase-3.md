# Phase 3 — Backend foundation and durable teaching sessions

Implemented from Phase 2 checkpoint `ac4415333be9d641df8312b78180bc46872eb39f` on `gpt6-astra-rework`. No frontend directory migration, curriculum implementation or production authentication.

## Architecture and ownership

The Phase 1 drawing engine, operation history and gesture lifecycle remain unchanged. A workspace activates a per-session persistence controller. Completed document actions, teaching mode and neutral-fixture selection produce a versioned snapshot. Pointer moves and unfinished/cancelled gestures do not reach persistence.

The data path is workspace → versioned contracts → IndexedDB → optional same-origin API → PostgreSQL. HTTP never blocks a local save. The committed document is independent of the draft renderer and ToolManager. The 1200×675 scene, annotation alignment and Explore/Annotate input ownership are unchanged.

`contracts/index.ts` contains serializable Zod schemas/types only. `src/persistence/` contains serialization, a native IndexedDB repository, API client and save coordinator. `server/` is a separate npm package with configuration, database schema/migrations, session/document service, Fastify assembly, tests and scripts. No shared database models or React components cross the contracts boundary.

## Stack

| Component | Pinned version / tested runtime |
| --- | --- |
| Node.js | 24.15.0; API engines require Node 24 LTS, >=24.15.0 |
| Fastify | 5.12.5 |
| PostgreSQL | 18.4, provided locally by embedded-postgres 18.4.0-beta.17 |
| Drizzle ORM / migration kit | 0.45.3 / 0.31.11 |
| node-postgres | 8.23.0 |
| Zod | 4.6.5 in frontend and server |
| TypeScript / tsx | 6.0.2 / 4.23.15 |
| Vitest / fake-indexeddb | 5.0.1 / 6.2.5 |

The embedded PostgreSQL launcher is a development/test dependency, not an alternate application database. The API uses ordinary PostgreSQL connections. It avoids requiring Docker on this Windows machine; an existing local PostgreSQL 18 database is also supported. The launcher does not create OS users or install a Windows service. Its package wrapper has a prerelease version; exercise the lockfile on other development OSes before adopting it there.

Drizzle Kit inherits a deprecated esbuild-kit helper. A scoped esbuild 0.28.2 override removes its vulnerable old esbuild version; migration generation and API tests were rerun with the override. Do not run `npm audit fix --force`, which proposes an incompatible migration-kit downgrade. Dependency audits are point-in-time checks, not a security audit.

References used for implementation: [Fastify schema validation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/), [Drizzle migrations](https://orm.drizzle.team/docs/drizzle-kit-migrate), [embedded PostgreSQL usage and platform support](https://github.com/leinelissen/embedded-postgres).

## Development setup

From the repository root:

```sh
npm ci
npm ci --prefix server
```

Copy `server/.env.example` to `server/.env`. Replace the example database password with a generated local password. Do not commit `.env`; it is ignored. The example UUIDs are identifiers for a local fixture identity, not authentication secrets.

Required server variables:

| Variable | Meaning |
| --- | --- |
| NODE_ENV | `development` for local runs; tests use `test`. `production` is refused. |
| HOST | `127.0.0.1` only in this milestone. |
| PORT | API port, default 3001. |
| DATABASE_URL | Local PostgreSQL URL; username/password must be URL-encoded when necessary. |
| DEV_IDENTITY_ENABLED | Must explicitly be `true`. No silent default. |
| DEV_USER_ID / DEV_SCHOOL_ID | UUID identity selected by server configuration, never request headers/body. |
| ALLOWED_ORIGIN | Exact browser origin; default example `http://127.0.0.1:5173`. |

In one terminal:

```sh
cd server
npm run db:local
```

This starts PostgreSQL on the URL's loopback port (example 55432), creates `meerkats_dev` if absent, and retains data in ignored `server/.data/development`. Keep the terminal open. Ctrl+C stops PostgreSQL. Existing clusters keep their original password; changing the env file does not rotate a database password. The launcher only accepts database name `meerkats_dev`.

In a second terminal:

```sh
cd server
npm run db:migrate
npm run db:seed
npm run dev
```

The migration command uses Drizzle's versioned SQL migration runner and an advisory lock. Seed creates only the configured local development school/user/membership and is idempotent. API startup does not auto-migrate or seed. For an existing local database, provision it first and omit `db:local`.

In the root, copy `.env.example` to `.env`, set `VITE_API_ENABLED=true`, and run:

```sh
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to loopback port 3001 only when API integration is enabled. The API does not return permissive CORS headers. Keep frontend origin/ports aligned with the examples, or deliberately update the proxy and allowed origin together. Production web hosting would need a same-origin reverse proxy; production deployment is not authorized or implemented here.

Without `VITE_API_ENABLED=true`, local recovery works and no API requests are made. This preserves the original frontend development/test workflow. The current API is deliberately unusable with `NODE_ENV=production`; replace the identity boundary with OIDC before any real school deployment.

## Database and migrations

Six tables implement this milestone:

| Table | Purpose and constraints |
| --- | --- |
| schools | School UUID and display name. |
| users | Internal UUID plus unique issuer/subject identity boundary; no password fields. |
| school_memberships | Composite school/user key, active flag, constrained teacher/school_admin role. |
| teaching_sessions | Stable session UUID, school/user composite membership FK, immutable prototype class/subject context and creation time. |
| documents | Document UUID, composite school/session FK, unique target anchor per session, current server revision, current bounded JSONB snapshot, hash and update time. |
| save_receipts | Unique document/mutation pair, request/content hashes, acknowledged revision and timestamp. |

No curriculum catalog or media tables were added. `prototype:class:5` and `prototype:subject:science` are explicit stable prototype identifiers; `STD 5` and `Science` remain labels. Future catalog IDs will require a deliberate mapping, not a reinterpretation of display strings.

SQL and Drizzle metadata are checked in under `server/drizzle/`. Change the typed schema, run `npm run db:generate`, review SQL, then run `npm run db:migrate`. Do not use schema push. Tests apply the migration twice to a unique disposable database to verify repeatability/schema availability. The initial migration is additive; rollback/upgrade rehearsal against real school data is not yet established.

Snapshots are limited to 2 MiB, 10,000 ink objects and 200,000 coordinate numbers per stroke; coordinates, bounds, widths, colors and UUIDs are validated. The API body limit adds 4 KiB of envelope overhead. A session is limited to 16 server documents; the current UI uses two. Oversize/unsupported data is rejected without truncating ink or replacing a valid persisted snapshot. Current in-memory drawing can exceed those limits, at which point saving reports that it needs attention.

Current JSONB holds only the latest snapshot, not a row per point/stroke. Save receipts retain small metadata, not prior snapshot bodies. This transitional choice keeps a small local prototype self-contained. Before large lessons/media or long-running boards, migrate snapshots to immutable S3-compatible keys with hash/size metadata, upload-then-finalize semantics and orphan cleanup. The document ID/revision/save contract can remain unchanged. Retention/compaction and historical server revision recovery are future work.

## API and authorization

| Endpoint | Contract |
| --- | --- |
| GET /api/v1/health | Process health. |
| GET /api/v1/ready | Database/schema readiness; 503 on failure. |
| POST /api/v1/sessions | `{ id, context }`; create or retry the same immutable session identity/context. |
| GET /api/v1/sessions/:sessionId | Owned context and current document snapshots with server revisions. |
| PUT /api/v1/sessions/:sessionId/documents/:documentId | Versioned document save; returns a durable receipt only after commit. |

Create, retrieve and save endpoints use shared runtime request/response schemas. No raw-table CRUD or generated administration endpoints. OpenAPI publication/client generation is deferred; the endpoints above and the shared schemas are the current contract source.

School/user identity comes solely from explicit server development configuration. Every secured request checks active school membership. All session reads and writes require both that school and the owning teacher. School-admin is a future role boundary, not a bypass for session ownership. Knowing a UUID, adding a client school ID, or supplying a different identity header does not grant access. Missing or foreign-owned sessions return 404, and inactive membership returns 403.

The server checks document/session/context/anchor consistency, validates payloads, uses parameterized Drizzle SQL, rejects unexpected origins and non-JSON writes, sets no-store/nosniff, limits connection count and request/statement time, and returns generic internal errors. Logs omit payloads and redact authorization/cookie fields. There is no custom password system. Network exposure, OIDC sessions, CSRF strategy for those sessions, TLS deployment, rate limiting, tenant RLS defense-in-depth, account logout/local-data policy and a security review remain pilot prerequisites.

## Serialized documents and save protocol

```text
Document schemaVersion: 1
  id: UUID
  owner: sessionId, classId, subjectId, target
  target: whiteboard | annotation + sceneId
  bounds: 1200 × 675
  localRevision: integer
  objects: committed ink { id, kind, tool, color, width, points }

Save request
  mutationId: UUID
  baseServerRevision: integer
  document: validated versioned snapshot

Acknowledgement
  documentId, mutationId, serverRevision, contentHash, durable: true
```

Draft points, pointer capture, ToolManager instances, React state internals, modal state and undo stacks are excluded. Reload restores committed ink and starts a fresh in-memory undo history. Clear remains reversible after recovery; newly performed operations have normal per-document history. Schema versions are independent of local edit revisions and server acknowledgement revisions.

The service locks the owned session inside a transaction, checks the base revision, writes the new document head, and inserts the receipt atomically. First save requires base 0; subsequent saves increment the server revision by one. Retrying the same mutation/request returns the original receipt, even if the document has since advanced. Reusing a mutation ID with different content returns 409. Stale revisions, target conflicts and changed session context return 409 without replacing the current document. Canonical SHA-256 hashes are generated server-side.

## IndexedDB, recovery and failure behavior

Database `meerkats-teaching-v1`, version 1, has a `sessions` store keyed by session UUID. A record contains validated session identity/context, both document snapshots, teaching mode, neutral-fixture selection, local saved timestamp, a local transaction generation, and per-document server revision/acknowledged local revision/pending request metadata. This generation is a device concurrency check, not the drawing revision.

Completed/context actions coalesce for 120 ms. A device transaction commits before reporting device-save success. Before HTTP, the exact pending request and mutation ID are committed in the same record as the snapshot. Later drawings may save locally while that HTTP request is outstanding. Newer snapshots do not replace the in-flight retry payload. After its acknowledgement, the next snapshot uses the acknowledged server revision. Undo/Redo/Clear are ordinary completed local revisions; pointer movement never schedules persistence.

Startup and transient failures retry pending requests. Transient retries back off with jitter up to about 30 seconds; reconnect prompts another attempt. Permanent 4xx failures/conflicts pause server saving, preserve local data and display attention status. There is no silent conflict merge. A stale IndexedDB generation prevents one browser tab silently replacing another tab's local record. Multi-tab editing is unsupported; continue with one editor. Conflict recovery/export/choose-version UI is not implemented.

The workspace URL carries `?session=<UUID>`. A new workspace waits for its initial storage attempt before exposing the drawing surface, preventing immediate reload from referencing a not-yet-created record. Storage failure still opens drawing with an explicit failure status. On reload, validate and read that ID from IndexedDB before rendering editable state. React Strict Mode shares one startup recovery promise. Browser Back/Forward to a different session URL re-enters validated startup recovery instead of relabelling the current board. If local storage has no record and API integration is enabled, retrieve the owned server documents and create a local record before rendering. An incomplete/invalid/unsupported record produces a recovery screen and is left untouched. Server recovery restores ink and class/subject context; mode/fixture selection are device-only and reset to Whiteboard/no selection on server-only recovery.

Status text is deliberately specific:

- Unsaved / Saving on device: current state not yet acknowledged by IndexedDB.
- Saved on this device: successful device transaction; no claim about server durability.
- Saved on this device · Syncing ink: local success, API work in progress.
- Ink synced · Context saved on device: both current ink documents acknowledged; mode/selection are local only.
- Saved on this device · Server unavailable / Server needs attention: local work retained; retry or conflict/auth/validation failure.
- Needs attention: device save, local concurrent writer, recovery or supported-format failure.

Page hiding/navigation attempts a final coalesced save, but asynchronous writes are not guaranteed during abrupt browser termination. Wait for the save indicator. IndexedDB is origin/browser-specific and can be denied, cleared or evicted. No installed PWA, asset caching, persistent-storage grant, account partitioning or cross-device product guarantee is claimed. An already loaded workspace continues drawing without the API; the frontend bundle must still be available to reload the application itself.

## Validation commands

Root (leave API integration disabled for the original/default browser suite):

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
git diff --check
```

Install Chromium once if needed: `npx playwright install chromium`.

Server:

```sh
cd server
npm run typecheck
npm run lint
npm test
npm run db:generate
npm run build
```

`npm test` creates an isolated cluster in a unique OS temp directory, applies migrations twice, seeds test-only school identities, exercises real SQL/API transactions and stops/removes that cluster. It ignores any development/production DATABASE_URL. It needs permission to launch local child processes and a free loopback port; it does not skip tests if PostgreSQL cannot start. The regular development database is untouched.

For the real browser/API suite, start the development database and apply migrations/seed first. Stop manually running frontend/API servers so ports 5173 and 3001 are free. From root run:

```sh
npm run test:e2e:api
```

This command starts the API and Vite with integration enabled, tests durable acknowledgement/server-only rendering in a fresh browser context, and verifies outage → local reload → retry recovery. It creates original fixture sessions in the local development database. It does not use production infrastructure or real teacher data.

## Remaining scope and next phase

The foundation is suitable for reviewing local durability and the backend save boundary. It is not a school deployment. Next authorize identity/account boundaries, a visible reopen/recovery/export flow, conflict recovery UX, retention and backup/restore rehearsal before promising durable teacher work for pilots. Then physically test storage, touch/stylus and interruptions on the intended Android panels. Curriculum, asset engines, production OIDC, cloud deployment, PWA/APK packaging and collaboration were not started.

Before pilot deployment, use managed PostgreSQL backups/PITR, establish an actual retention policy and run restore drills. The local development cluster has no automatic backup service. Server current snapshots plus receipts do not provide historical rollback. Proposed RPO/RTO in the architecture recommendation remain unverified targets.

## Completed validation

Final checks completed on 2026-09-26. No original unit/browser test or drawing-engine source was changed to obtain these results.

| Working directory | Exact command | Final result |
| --- | --- | --- |
| Root | `npm run typecheck` | PASS |
| Root | `npm run lint` | PASS |
| Root | `npm test` | PASS: 34 tests in 5 files; 13 new persistence tests |
| Root | `npm run test:e2e` | PASS: 25 Chromium tests; 18 original regressions plus 7 new persistence/recovery tests |
| Root | `npm run test:e2e:api` | PASS: 2 additional real API/PostgreSQL browser tests |
| Root | `npm run build` | PASS; JavaScript 664.95 kB, gzip 203.75 kB; CSS 24.02 kB, gzip 5.79 kB |
| Root | `git diff --check` | PASS; Windows LF/CRLF conversion notices are not whitespace errors |
| server | `npm ci` | PASS: reproducible install; audit reported 0 vulnerabilities |
| server | `npm run typecheck` | PASS |
| server | `npm run lint` | PASS |
| server | `npm test` | PASS: 18 tests in 2 files; includes migrations applied twice to isolated PostgreSQL |
| server | `npm run db:generate` | PASS: no schema drift |
| server | `npm run db:migrate` | PASS: development database up to date |
| server | `npm run db:seed` | PASS: local fixture membership created during setup |
| server | `npm run build` | PASS |
| server | `npm start` | PASS: compiled API startup manually verified during outage/reconnect check |

The frontend build warns about a chunk over 500 kB; it was not suppressed. Playwright emits the environment's NO_COLOR/FORCE_COLOR warning. Drizzle Kit's legacy helper emits deprecation notices during install. None are claimed as a measured performance result. The database version was queried directly: PostgreSQL 18.4.

Tests exposed and verified fixes for Strict Mode duplicate first recovery writes, immediate reload before the initial device record existed, reopening a different session through browser history, malformed-request status handling, Windows temporary database cleanup and concurrent cross-school claims of a new document UUID. A development migration attempt during database startup timed out; rerunning once ready succeeded. The complete final suites above passed without skipping or weakening existing assertions.

Manual desktop Chromium interaction verified Class (STD 5) → Science → Workspace; whiteboard stroke/dot; neutral content selection; annotation; reload with both documents and selection retained; restored-ink erasing, Undo, Redo and Clear cancellation. Stopping the actual API left drawing usable, reported device-only success/server unavailable and preserved the next stroke through reload. Restarting the compiled API acknowledged queued ink, confirmed by a direct GET showing separate document revisions. No console errors/warnings were observed in the normal manual flow before the deliberate outage; expected connection/proxy errors occurred during that outage.

Automated browser tests additionally verify server-only recovery and rendering in a fresh storage context, reconnect retries, storage denial, competing local tabs, no draft persistence, all original drawing/history behaviors and the three supported viewports (1920×1080, 1280×720, 1024×600). No physical Android panel, stylus, school-network, long-session throughput or abrupt power-loss claim is made.

## Reviewable file manifest

Created (33):

```text
.env.example
contracts/index.ts
docs/phase-3.md
playwright.api.config.ts
server/.env.example
server/drizzle.config.ts
server/drizzle/0000_youthful_wrecker.sql
server/drizzle/meta/0000_snapshot.json
server/drizzle/meta/_journal.json
server/eslint.config.js
server/package-lock.json
server/package.json
server/scripts/local-db.ts
server/src/app.ts
server/src/config/env.ts
server/src/db/connection.ts
server/src/db/migrate.ts
server/src/db/schema.ts
server/src/db/seed.ts
server/src/index.ts
server/src/modules/sessions.ts
server/tests/api.test.ts
server/tests/config.test.ts
server/tsconfig.json
server/vitest.config.ts
src/persistence/api.ts
src/persistence/catalog.ts
src/persistence/controller.ts
src/persistence/database.ts
src/persistence/persistence.test.ts
src/persistence/serialization.ts
tests/api-e2e/durable-session.spec.ts
tests/e2e/persistence.spec.ts
```

Modified (14):

```text
.gitignore
README.md
docs/backend-architecture.md
eslint.config.js
package-lock.json
package.json
src/components/workspace/SessionHeader.tsx
src/pages/Workspace/Workspace.tsx
src/store/ClassroomProvider.tsx
src/store/DrawingProvider.tsx
src/store/classroom-context.ts
src/store/drawing-context.ts
tsconfig.test.json
vite.config.ts
```

Removed: none. Generated local credentials/configuration (`server/.env`), development database data, installed dependencies, build output and browser test artifacts are ignored and excluded from the reviewable implementation. No real credentials are committed. No commit, push or main-branch operation was performed.
