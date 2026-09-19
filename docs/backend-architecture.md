# Backend architecture recommendation

Status: recommendation for review; no backend, database, authentication, storage service, or synchronization engine is implemented in Phase 0–1.

## 1. Decision and fit

Use a TypeScript modular monolith: supported Node.js LTS, Fastify, PostgreSQL, Drizzle ORM with node-postgres, private S3-compatible object storage, and an established OpenID Connect identity provider. Pin mutually supported versions when the backend phase begins.

Keep one API deployment with modules for identity/access, curriculum/content, teaching sessions/documents, assets, and feedback. This matches a small teacher-prototype team while keeping school ownership explicit. A second language, microservices, Kubernetes, Redis, and a generic workflow engine are unnecessary at this stage.

This is an engineering recommendation based on this repository's existing TypeScript stack and small scope, not a measured performance comparison.

| Choice | Assessment for Meerkats |
| --- | --- |
| Fastify | Recommended: explicit plugins and runtime request/response schemas without a large application framework. |
| NestJS | Viable for a larger team needing prescribed conventions; additional framework concepts and ceremony are not justified here. |
| Express | Viable but requires more assembly for validation, typed contracts, and module boundaries. |
| Drizzle + pg | Recommended: typed queries, accessible SQL, explicit transactions, reviewable migrations. Requires SQL discipline. |
| Prisma | Viable if the team strongly prefers generated model APIs; no demonstrated benefit here outweighs the additional abstraction. |
| Raw pg | Simple runtime, but more manual query/result typing and migration wiring. |

Fastify supports schema-based request validation and response serialization. Use application-controlled JSON schemas (with a compatible TypeScript type provider), never schemas supplied by lessons or users. Keep authorization/database checks in request hooks or services after input validation. [Fastify documentation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)

## 2. Database and migrations

Use managed PostgreSQL with a deliberately small connection pool. Enforce foreign keys, unique ownership constraints, immutable published versions, and tenant-aware indexes. JSONB is appropriate for bounded versioned definitions and small activity state, not as a replacement for every relationship.

Use Drizzle to generate SQL migrations and review that SQL before applying it. Apply versioned migrations once in deployment, under a lock, using a distinct migration role. Do not use schema push against production. Prefer additive expand/migrate/contract changes; test upgrades on a restored database. Backups are not a substitute for migration review. [Drizzle migration workflows](https://orm.drizzle.team/docs/migrations)

## 3. Repository evolution

Initially add `server/` beside the existing frontend, with its own package, TypeScript configuration, tests, environment validation, and build. Explicitly scope root lint/test globs when adding it. Preserve the frontend's current scripts.

Add a small `contracts/` package only when the first API endpoint has a real shared contract. Export serializable schemas/types, not database models, React components, or server secrets.

Once both deployables and shared contracts exist, perform a separate mechanical migration to:

```text
apps/web
apps/api
packages/contracts
packages/content       # only when a real content pipeline exists
```

Use npm workspaces initially; a build orchestrator is not required. Moving the current prototype solely for organization would add risk without improving this milestone.

## 4. Domain and storage model

Use UUIDs for stable entity IDs. Names, class labels, subject display strings, and routes are not identifiers. The current frontend's classId/subjectId contain prototype catalog labels; map these to stable catalog IDs when the API catalog is introduced. Keep existing session/document UUIDs stable through local save and upload.

| Concept | Proposed representation |
| --- | --- |
| School | Relational row; tenant ID, name, status, region/policy metadata. |
| User | Relational row keyed internally; unique identity-provider issuer + subject; minimal profile. |
| SchoolMembership | Relational user-school membership with status and role. Unique user/school membership. |
| Role | Small application-defined enum initially: teacher and school administrator. Platform administrator is a separate privileged scope, not an arbitrary school membership. Custom permission tables only when required. |
| Curriculum, ClassLevel, Subject | Relational catalog and curriculum/class/subject associations; avoid assuming a subject belongs to only one class. School entitlement/assignment controls shared catalog access. |
| Chapter, Topic | Relational rows under a curriculum/class/subject offering, stable IDs and explicit ordering. Use parent constraints rather than free strings. |
| Lesson | Relational identity and ownership/publishing metadata; associated with a topic. |
| LessonVersion | Immutable published row with version, schema version, content hash, bounded JSONB activity/scene definition and asset references. Drafts are editable until published. |
| TeachingSession | Relational row with school, teacher, pinned lessonVersionId (nullable for a standalone board), currentActivityId, status, timestamps. |
| WhiteboardDocument / AnnotationDocument | One documents table with kind, session ID, optional activity/scene/page anchor, schema version, head server revision, hash and snapshot object key. Do not create separate tables merely for the conceptual names. |
| DocumentRevision | Lightweight revision metadata and immutable snapshot key; retention policy. No SQL row per point or stroke. |
| ActivityState | Bounded JSONB per session/activity with version; separate row when independent updates are needed. Initial stateless activities need no row. |
| Asset | SQL metadata: owner/school or public curriculum scope, object key, hash, MIME, size, license/provenance, processing status. Binary data in object storage. |
| TeacherFeedback | Relational author/school/session/lesson-version references, rating/category/text, optional small structured responses. Attachment references only. |
| Save receipt | Relational unique document/mutation ID, request hash and acknowledged revision, retained for the documented retry window. |

Large drawings are compressed, versioned snapshot blobs in object storage with relational ownership and revision metadata. Small lesson definitions belong in JSONB while images, audio, video, PDF bytes and bulky interactive bundles belong in object storage. Set explicit payload limits and move oversized lesson definitions to immutable blobs when evidence warrants it.

Published lessons are pinned by version in teaching sessions; publishing a correction must not silently change an active or cached lesson. Annotation identity includes the immutable activity/scene/page anchor. Whiteboard ink erasing must not become deletion of images or lesson objects.

## 5. API design and save protocol

Use versioned REST under `/api/v1`, OpenAPI, runtime schemas and generated client types. Start with catalog reads, session creation/read, document reads/saves, signed asset access and teacher feedback. Prefer narrow endpoints and cursor pagination. No GraphQL or per-pointer network requests.

Separate the document format's schemaVersion, frontend local revision, server revision and lesson publication version. They solve different problems.

A proposed save:

1. Complete an ink gesture locally; persist a snapshot and pending mutation atomically in IndexedDB when local persistence is implemented.
2. Send document ID, unique mutation ID, base server revision, content hash and schema version to an authorized save endpoint.
3. Upload the exact snapshot to a server-generated immutable object key using a scoped short-lived URL.
4. Finalize: verify existence, checksum, size and payload validity; perform a conditional head-revision update and save-receipt insert in one PostgreSQL transaction.
5. Return a durable acknowledgement with the new server revision. Only then mark that mutation synced locally.

Object storage and PostgreSQL do not share an atomic transaction. Upload first, finalize the reference second; garbage-collect unreferenced uploads after a safe retention interval. A failed finalization must leave the last valid head intact.

Retrying an acknowledged mutation returns the same result; reusing a mutation ID with a different hash is rejected. A lost acknowledgement is recoverable by retrying the same request. Serialize saves per document and retain the exact in-flight payload; coalesce newer pending snapshots only after preserving their local durability.

## 6. Authentication and authorization

Use an established OIDC provider, preferably managed for the initial pilot. Select the vendor against school identity integration, region/residency, exportability, support and actual user pricing before procurement. Keycloak is an option if self-hosting is a firm school requirement; operating upgrades and backups is real work.

Use a server-managed authorization-code flow with PKCE via a maintained OIDC library. Issue short-lived server sessions through Secure, HttpOnly, SameSite cookies; apply CSRF protection and Origin checks for mutations. Keep access/refresh tokens out of localStorage. Use exact redirect URI allowlists and server-side revocation/session expiry. Do not implement password storage.

Require stronger authentication for administrators. School administrators manage only their school. Derive access from the authenticated user and active membership on every request; UUID knowledge or a client schoolId is never authorization. Follow the authorization-code and redirect protections in the [OAuth security best current practice](https://www.rfc-editor.org/rfc/rfc9700.html).

## 7. Offline and IndexedDB direction

The future data path is API/sync ↔ IndexedDB ↔ workspace. Active pointer drafts stay in memory. Completed document actions become local durable state; rendering does not wait for the network. A gesture remains one action even when many actions are saved in one snapshot.

Persist local snapshots and a bounded outbox transactionally. Display truthful states: unsaved, saved on this device, syncing, synced, needs attention. Storage quota or transaction failures must surface visibly; do not claim local saving succeeded when it failed.

Cache a selected immutable lesson version and its required asset manifest before promising offline teaching. Use Cache Storage for cacheable asset bytes and IndexedDB for documents, manifests and outbox records. Browser storage can be evicted; request persistent storage where supported, provide recovery/export policy, and test actual panels before claiming durability.

Retry transient failures with exponential backoff and jitter, on reconnect and app startup. Refresh authentication when possible; pause uploads on authentication failure while preserving local work. Permanent validation failures require visible recovery, not endless retries.

Assume one active teacher editor per session. Multiple tabs/devices and interrupted old sessions can still create stale writes: use optimistic concurrency (base revision / conditional update). On conflict, preserve both versions and offer copy/recover/choose; never silently overwrite. CRDTs and collaborative merges are out of scope.

Offline access to cached school data needs an explicit expiry/sign-out policy. Fresh sign-in requires the identity service; revocation cannot be instantly enforced on a disconnected device. Shared-panel account switching must isolate and clear or lock local data according to school policy.

Phase 1 is intentionally in-memory: none of these durability or offline guarantees exist yet.

## 8. Asset delivery

Use private S3-compatible buckets with TLS, encryption, versioning and lifecycle policies. Store server-generated object keys and metadata in PostgreSQL. Authorize every signing request; use short-lived URLs and scope credentials by environment. Publicly licensed curriculum assets can use a separate public/CDN distribution if explicitly intended.

Presigned URLs convey temporary access and are reusable until expiry, so treat them as bearer credentials and avoid logging them. Validate MIME signatures, file sizes, checksums and upload ownership; scan untrusted uploads before serving them as trusted content. Sanitize SVG/HTML and sandbox any future executable widgets. [S3 presigned URL documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)

Use immutable content-hashed assets and CDN caching. Separate original media from generated delivery variants. License/provenance metadata is required; backend design does not authorize textbook ingestion.

## 9. Deployment and operating cost

Start with static web hosting/CDN, one long-running API container, managed PostgreSQL, object storage and managed identity. Route `/api` behind the same origin where practical. Separate development, staging and production identities/buckets/databases. Use environment/secrets management, health/readiness endpoints and graceful shutdown.

Horizontal API replication can come later; durable state stays in PostgreSQL/object storage. Introduce a queue/worker only when asset processing requires it, initially within the same codebase. No microservice split.

Choose the deployment region after school requirements are known. Budget database/backup baseline, API memory/CPU, storage GB-month, video egress, request counts, identity users and monitoring. No reliable operating-cost estimate is possible until pilot schools, lesson/video sizes, concurrency and region are specified. Measure representative load and bound database pools; “school-scale” is not a demonstrated capacity claim.

## 10. Security

Enforce tenant-scoped queries and composite relationships to prevent cross-school references. Use least-privilege application/database roles. PostgreSQL row security can add defense in depth; its owner/bypass behavior must be understood and tested. With pooling, set tenant context transaction-locally and use a non-owner application role. RLS does not replace endpoint authorization. [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

Validate request sizes and document point counts; rate-limit sensitive and expensive endpoints. Use safe database parameters, CSP, output encoding, restricted CORS, upload isolation, dependency monitoring, and log redaction. Avoid logging document content/tokens. Record privileged access and publishing actions. Test cross-school access, stale-save conflicts, duplicate retries and corrupted payloads.

Do not collect student personal data for an initial teacher-only pilot without an approved purpose and retention policy. Determine school agreements, data residency and retention requirements before a live rollout.

## 11. Backup and recovery

Enable managed PostgreSQL automated backups and PITR, encrypted object storage with version retention, and protected configuration/identity-provider recovery procedures. PostgreSQL PITR depends on base backups and continuous WAL availability. [PostgreSQL recovery documentation](https://www.postgresql.org/docs/current/continuous-archiving.html)

Proposed pilot targets to validate with the selected provider: RPO ≤15 minutes and RTO ≤4 hours. These are proposed objectives, not achieved guarantees. Retention must cover school recovery and deletion policies; object retention must outlive database recovery windows.

Run a restore drill before pilot launch and periodically thereafter. Verify memberships, pinned lesson versions, session heads and every referenced snapshot/asset can be recovered together. Retain immutable objects long enough for older database restores; tolerate and later remove orphan uploads. Backup success logs alone do not demonstrate recoverability.

## 12. Implementation phases and start point

| Stage | Scope / completion gate |
| --- | --- |
| B0: Foundation | Server skeleton, environment validation, contracts, migrations, staging deployment, database integration tests and school-isolation conventions. |
| B1: Identity | OIDC, sessions, school membership/roles and tested cross-school denial. |
| B2: Content and assets | Stable catalog IDs, immutable lesson publishing, asset metadata/access and upload verification. No unapproved textbook ingestion. |
| B3: Sessions and saves | Teaching sessions, document snapshots, optimistic concurrency, idempotent save receipts, feedback and restore drill. |
| B4: Offline integration | IndexedDB durability/outbox, cached lesson manifests, retry/conflict/recovery UX and shared-panel account handling. |
| B5: Pilot readiness | Device tests, migration/recovery rehearsal, security checks, realistic load and cost measurements. |

These are scope estimates, not delivery-date promises. Staffing, provider choice and pilot requirements are not yet known.

Begin B0/B1 after Phase 0–1 review in a separately authorized stage, alongside or immediately after Phase 2 workspace work. Agree the save/identity contracts before local persistence and content authoring harden. Complete authenticated session/document saving before promising teacher work can be recovered across devices. The next frontend phase remains the approved Phase 2 workspace work; it has not started.
