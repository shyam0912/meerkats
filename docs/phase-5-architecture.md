# Phase 5 chemistry reference lesson

One `molecule-builder` registry entry is lazy-loaded. Seven ordered instances reuse it; no chemistry-specific route, backend, document engine, or database table is introduced.

## Definition and runtime

`contracts/molecule.ts` validates bounded carbon graphs (2–8 atoms, connected acyclic single bonds, valence <= 4), independent normalized layout coordinates, longest parent paths, one methyl branch, and candidate continuity. Activity configuration further limits this lesson to five carbons and C5H12. Canonical tree signatures prevent two drawings of the same topology from being presented as different isomers. Stable atom IDs are retained across the pair; unchanged bonds retain IDs, and changed connectivity gets its own bond ID.

`contracts/chemistry.ts` assigns curriculum, class, subject, chapter, topic, lesson, version, activity and scene IDs once. It includes the original molecule layouts and the source/review metadata. `catalog-content.ts` combines the neutral demo and the reference lesson for bundled development and idempotent backend seeding. The source PDF is neither bundled nor uploaded.

Runtime contains only structure ID, reveal count, candidate path ID, numbering direction, reveal flag, selected name components and focused component. Stage-aware validation rejects irrelevant fields, foreign selections, excess counts and invalid component focus. Definitions are never edited by teacher interactions. No drag/pointer state is saved.

## Workspace and durability

The existing 1200×675 TeachingSurface fits/letterboxes the DOM/SVG content and Konva annotation layer together. Chemistry's large tap controls live inside the logical activity scene; header, activity navigation, drawing and teaching-mode controls remain outside the transform. A 128-logical-pixel activity button is sized to exceed 56 CSS pixels at all three supported viewports in browser tests.

Explore gives input to content. Annotate makes the content subtree inert and transfers input to the existing drawing canvas. Whiteboard remains independent. Annotation documents remain keyed by lessonVersionId/activityId/sceneId. Ink is anchored to scene coordinates, not molecular atoms: changing a molecular arrangement intentionally leaves annotations at their original scene positions. No object-following annotation binding is claimed.

The existing progress outbox, local-first IndexedDB snapshot, pinning, idempotent save protocol, tenant checks, revisions and conflict behavior are reused unchanged. Both the API catalog and bundled development catalog can launch the lesson. A loaded local session survives API outage/reload, with the existing application-resource availability limits; this is not a full offline curriculum cache or PWA.

## Backend boundary

Only shared contract acceptance and seed content change. No SQL schema change, migration, chemistry service, API endpoint, authentication change or new dependency is needed. The lesson remains JSONB in the existing version table; bounded runtime uses the existing progress endpoint. Existing publication immutability remains enforced in PostgreSQL.

## Teacher interaction

No precision dragging is required. Path choices, numbering directions, branch reveal, name parts and structure selection are native buttons with accessible names, focus styles, pressed and disabled states. Highlighted carbon groups use a dashed outline and text, not color alone. Reset uses the existing capability-driven control. The concept reveal is teacher-directed; there is no score or automatic answer judgement.

The designed core journey requires 24 taps after opening the lesson: 4 carbon reveals, 3 path/reveal taps, 3 numbering/comparison taps, 1 branch reveal, 4 name parts, 2 arrangement/formula taps, 1 final reveal, and 6 Next taps. Teachers can use fewer comparisons or the existing outline. Launching from Home requires five taps: Start Teaching, Standard X, Chemistry, Unit 1, Start Teaching.

The smallest viewport preserves operation; it is not a substitute for distance legibility on the actual classroom panel. Secondary captions and side-by-side hydrogen subscripts need physical-device review. No Android, stylus or classroom-distance validation is asserted.
