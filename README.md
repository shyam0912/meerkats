# Meerkats Interactive Classroom

Teacher prototype for large interactive classroom panels. The current milestone implements a reliable, temporary whiteboard; it does not yet provide saved teaching sessions.

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

Each class/subject selection and Quick Workspace starts a new session and board. Refreshing the page discards the in-memory session. Returning from an existing lesson shelf to Whiteboard within the same session preserves the board. There is no saving, backend, authentication, or offline recovery yet.

Rectangle/Text are outside the active drawing flow. Legacy content and shelf viewers remain prototype scaffolding, not a completed lesson engine.

## Engineering documents

- [Phase 0–1 implementation and verification](docs/phase-0-1.md)
- [Backend architecture recommendation](docs/backend-architecture.md)

`PROJECT_PROGRESS.md` is the historical project roadmap; use the milestone document for current verified status.
