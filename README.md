# Meerkats Interactive Classroom

Teacher prototype for large interactive classroom panels. The current milestone provides a unified teaching workspace with a reliable whiteboard and annotation over a neutral interactive diagram. Sessions are temporary and are not saved.

## Development

Use a Node.js version supported by the installed Vite version and the checked-in lockfile.

```sh
npm ci
npm run dev
```

Production commands remain `npm run build` and `npm run preview`.

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

Each class/subject selection and Quick Workspace starts a new session. Refreshing the page discards the in-memory session. Whiteboard and content annotations have separate documents and histories. Switching Whiteboard → Content → Annotate preserves both. In Explore, shapes receive interaction; in Annotate, the ink overlay owns input. There is no saving, backend, authentication, or offline recovery yet.

The teaching scene uses fixed 1200×675 logical bounds, proportionally fitted at each viewport; ink scales with the scene. Controls stay unscaled. Browser checks cover 1920×1080, 1280×720 and 1024×600. Physical Android/stylus validation remains outstanding.

Rectangle/Text are outside the active drawing flow. The old sidebar, dock and shelf viewers remain in source but are not part of the teacher workspace. The shape fixture is original demonstration content, not an assigned curriculum lesson.

## Engineering documents

- [Phase 0–1 implementation and verification](docs/phase-0-1.md)
- [Phase 2 workspace architecture and verification](docs/phase-2.md)
- [Backend architecture recommendation](docs/backend-architecture.md)

`PROJECT_PROGRESS.md` is the historical project roadmap; use the milestone document for current verified status.
