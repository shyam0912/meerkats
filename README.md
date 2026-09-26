# Meerkats Interactive Classroom

Teacher prototype for large interactive classroom panels. The workspace combines a reliable whiteboard and annotation over a neutral interactive diagram. Completed ink and teaching context now save to IndexedDB and restore from the workspace's session URL. An optional local Fastify/PostgreSQL backend acknowledges durable ink saves.

## Development

Use Node.js 24 LTS (tested with 24.15.0) and the checked-in lockfiles. The frontend works without a running API; its status then reports device saving only.

```sh
npm ci
npm run dev
```

Production commands remain `npm run build` and `npm run preview`.

For backend installation, local PostgreSQL, migrations, development identity, API integration and recovery limitations, see [Phase 3 setup](docs/phase-3.md). Do not expose this development-identity server to a school network or deploy it as production authentication.

## Validation

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Vitest tests document/history and tool lifecycle independently of React. Playwright tests rendered ink, pointer capture, touch emulation, cancellation, history, confirmation, and context isolation in Chromium. The browser suite starts Vite on 127.0.0.1:5173; keep that port free, or intentionally reuse this project's already-running development server. Browser binaries are development-only downloads.

## Current behavior

Class → Subject → Workspace, or Quick Workspace.

Pen, ink Eraser, color, width, Undo, Redo, and confirmed Clear are available. A click/tap produces a visible dot. Completed gestures enter history; cancelled drafts do not. Undo is bounded to the latest 100 operations.

Each class/subject selection and Quick Workspace starts a new session. Bookmark the workspace URL to reopen it on the same browser/origin. Reload restores committed whiteboard and annotation ink, class/subject context, teaching mode and fixture selection. Wait for the device-save indicator before closing; browser eviction, deletion and power loss can still lose local data. This is not an installed offline application.

Whiteboard and content annotations have separate documents and histories. Switching Whiteboard → Content → Annotate preserves both. In Explore, shapes receive interaction; in Annotate, the ink overlay owns input. Undo history is in memory and starts fresh after reload; restored ink can still be erased or cleared, and new actions can be undone. API synchronization is opt-in with `VITE_API_ENABLED=true`; only acknowledged ink is labelled synced. Production authentication and account switching are not implemented.

The teaching scene uses fixed 1200×675 logical bounds, proportionally fitted at each viewport; ink scales with the scene. Controls stay unscaled. Browser checks cover 1920×1080, 1280×720 and 1024×600. Physical Android/stylus validation remains outstanding.

Rectangle/Text are outside the active drawing flow. The old sidebar, dock and shelf viewers remain in source but are not part of the teacher workspace. The shape fixture is original demonstration content, not an assigned curriculum lesson.

## Engineering documents

- [Phase 0–1 implementation and verification](docs/phase-0-1.md)
- [Phase 2 workspace architecture and verification](docs/phase-2.md)
- [Backend architecture recommendation](docs/backend-architecture.md)
- [Phase 3 backend, durability and development setup](docs/phase-3.md)

`PROJECT_PROGRESS.md` is the historical project roadmap; use the milestone document for current verified status.
