import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { demoCatalog, demoVersion, DEMO } from '../../contracts/demo';
import { activitySchema, annotationKey, catalogSchema, initialProgress, lessonDefinitionSchema, lessonVersionSchema } from '../../contracts/lesson';
import { activeDocument, createLessonSession, sessionReducer } from '../drawing/session';
import { deserializeSession, serializeSession, snapshotSchema } from '../persistence/serialization';
import { newRecord, SessionRepository } from '../persistence/database';
import { PersistenceController } from '../persistence/controller';
import { SaveError, type SessionApi } from '../persistence/api';
import { capabilities, lookupActivity } from './registry';
import ActivityHost from './ActivityHost';
import type { ActivityProps } from './registry';

function fixture() {
  const identity = { id: crypto.randomUUID(), lessonVersionId: DEMO.version, context: { classId: DEMO.class, subjectId: DEMO.subject, classLabel: 'Demo class', subjectLabel: 'Visual exploration' } };
  const session = createLessonSession({ sessionId: identity.id, classId: DEMO.class, subjectId: DEMO.subject }, demoVersion);
  return { identity, session };
}
describe('catalog and immutable lesson definitions', () => {
  it('keeps IDs stable across presentation edits and validates hierarchy', () => {
    const changed = catalogSchema.parse({ ...demoCatalog, nodes: demoCatalog.nodes.map(n => ({ ...n, title: 'Renamed' })) });
    expect(changed.nodes.map(n => n.id)).toEqual(demoCatalog.nodes.map(n => n.id));
    expect(lessonDefinitionSchema.safeParse({ ...demoCatalog.lessons[0], classLevelId: 'Demo class' }).success).toBe(false);
    expect(catalogSchema.safeParse({ ...demoCatalog, nodes: demoCatalog.nodes.slice(1) }).success).toBe(false);
  });
  it('rejects unsupported versions, duplicate activities and malformed discriminated configuration', () => {
    expect(lessonVersionSchema.safeParse({ ...demoVersion, schemaVersion: 2 }).success).toBe(false);
    expect(lessonVersionSchema.safeParse({ ...demoVersion, activities: [demoVersion.activities[0], demoVersion.activities[0]] }).success).toBe(false);
    expect(activitySchema.safeParse({ ...demoVersion.activities[0], kind: 'simulation' }).success).toBe(false);
    expect(activitySchema.safeParse({ ...demoVersion.activities[2], config: { items: [] } }).success).toBe(false);
  });
  it('looks up explicit lazy implementations and only truthful capabilities', () => {
    for (const a of demoVersion.activities) expect(lookupActivity(a.kind)?.component).toBeDefined();
    expect(lookupActivity('toString')).toBeUndefined(); expect(lookupActivity('unknown')).toBeUndefined();
    expect(capabilities(demoVersion.activities[0]).canReveal).toBe(false);
    expect(capabilities(demoVersion.activities[2]).canReveal).toBe(true);
  });
  it('renders an unknown or malformed activity fallback rather than throwing', () => {
    const props = { activity: { ...demoVersion.activities[0], kind: 'future-kind' }, state: { kind: 'explain' }, onChange: () => {} } as unknown as ActivityProps;
    expect(renderToString(createElement(ActivityHost, props))).toContain('Activity unavailable');
    expect(renderToString(createElement(ActivityHost, { ...props, activity: { ...demoVersion.activities[0], config: {} } as unknown as ActivityProps['activity'] }))).toContain('Whiteboard');
  });
  it('uses definition order without position-based identity and pins the exact version', () => {
    const { session } = fixture();
    const reordered = lessonVersionSchema.parse({ ...demoVersion, id: crypto.randomUUID(), version: 2, activities: [...demoVersion.activities].reverse() });
    expect(initialProgress(reordered).currentActivityId).toBe(demoVersion.activities[2]!.id);
    expect(session.lesson?.version.id).toBe(DEMO.version);
    expect(session.lesson?.progress.currentActivityId).toBe(demoVersion.activities[0]!.id);
  });
});
describe('lesson document and runtime ownership', () => {
  it('anchors annotation to version/activity/scene independently of title and position', () => {
    const a = demoVersion.activities[0]!; const b = demoVersion.activities[1]!;
    expect(annotationKey({ lessonVersionId: DEMO.version, activityId: a.id, sceneId: a.sceneId })).not.toBe(annotationKey({ lessonVersionId: DEMO.version, activityId: b.id, sceneId: a.sceneId }));
    expect(annotationKey({ lessonVersionId: crypto.randomUUID(), activityId: a.id, sceneId: a.sceneId })).not.toBe(annotationKey({ lessonVersionId: DEMO.version, activityId: a.id, sceneId: a.sceneId }));
  });
  it('keeps per-activity ink and undo independent through navigation and Whiteboard', () => {
    let { session } = fixture(); const first = activeDocument(session).document.id;
    const stroke = { id: crypto.randomUUID(), kind: 'ink' as const, tool: 'pen' as const, color: '#000000', width: 4, points: [20, 30] };
    session = sessionReducer(session, { type: 'document', documentId: first, action: { type: 'commit', stroke } });
    session = sessionReducer(session, { type: 'activity', id: demoVersion.activities[1]!.id });
    expect(activeDocument(session).document.objects).toHaveLength(0);
    session = sessionReducer(session, { type: 'mode', mode: 'whiteboard' });
    session = sessionReducer(session, { type: 'document', documentId: session.whiteboard.document.id, action: { type: 'undo' } });
    session = sessionReducer(session, { type: 'activity', id: demoVersion.activities[0]!.id });
    expect(activeDocument(session).document.id).toBe(first); expect(activeDocument(session).document.objects).toHaveLength(1);
  });
  it('serializes current activity and bounded runtime without mutating definitions', async () => {
    let { session } = fixture(); const { identity } = { identity: { id: session.whiteboard.document.owner.sessionId, lessonVersionId: DEMO.version, context: { classId: DEMO.class, subjectId: DEMO.subject, classLabel: 'Demo class', subjectLabel: 'Visual exploration' } } };
    const before = JSON.stringify(demoVersion); const reveal = demoVersion.activities[2]!;
    session = sessionReducer(session, { type: 'activity', id: reveal.id });
    session = sessionReducer(session, { type: 'activity-state', id: reveal.id, state: { kind: 'reveal', revealed: 2 } });
    const snapshot = serializeSession(session, identity, null); const repo = new SessionRepository(crypto.randomUUID());
    await repo.save(newRecord(snapshot)); const loaded = await repo.load(identity.id);
    expect(deserializeSession(loaded!.snapshot).lesson).toEqual(session.lesson);
    expect(JSON.stringify(demoVersion)).toBe(before);
    expect(sessionReducer(session, { type: 'activity-state', id: reveal.id, state: { kind: 'reveal', revealed: 99 } })).toBe(session);
    expect(snapshotSchema.safeParse({ ...snapshot, identity: { ...identity, lessonVersionId: crypto.randomUUID() } }).success).toBe(false);
  });
  it('persists exact progress retry payload and recovers after a lost acknowledgement', async () => {
    const { session, identity } = fixture(); const snapshot = serializeSession(session, identity, null); const repo = new SessionRepository(crypto.randomUUID());
    const remote: SessionApi = { create: vi.fn(async i => i), get: vi.fn(), save: vi.fn(async (_id, input) => ({ documentId: input.document.id, mutationId: input.mutationId,
      serverRevision: input.baseServerRevision + 1, contentHash: 'a'.repeat(64), durable: true as const })),
      saveProgress: vi.fn(async (id, input) => {
        expect((await repo.load(id))?.progressSync?.pending).toEqual(input);
        return { mutationId: input.mutationId, serverRevision: input.baseServerRevision + 1, durable: true as const };
      }) };
    vi.mocked(remote.saveProgress!).mockRejectedValueOnce(new Error('Lost response'));
    const first = new PersistenceController(snapshot, () => {}, repo, remote);
    first.update(snapshot); await first.flush(); await first.sync(); first.stop();
    const stored = await repo.load(identity.id); expect(stored?.progressSync?.pending).toBeDefined();
    const next = new PersistenceController(snapshot, () => {}, repo, remote, stored);
    next.update(snapshot); await next.flush(); await next.sync(); next.stop();
    expect(vi.mocked(remote.saveProgress!).mock.calls[1]?.[1]).toEqual(stored!.progressSync!.pending);
    expect((await repo.load(identity.id))?.progressSync?.pending).toBeUndefined();
  });
  it('retains locally durable progress when backend rejects a stale revision', async () => {
    const { session, identity } = fixture(); const snapshot = serializeSession(session, identity, null); const repo = new SessionRepository(crypto.randomUUID());
    const restored = newRecord(snapshot);
    restored.sync = Object.fromEntries([snapshot.whiteboard, ...Object.values(snapshot.annotations)].map(d => [d.id, { serverRevision: 1, acknowledgedLocalRevision: 0 }]));
    const remote: SessionApi = { create: vi.fn(async i => i), get: vi.fn(), save: vi.fn(), saveProgress: vi.fn().mockRejectedValue(new SaveError(409)) };
    const notify = vi.fn(); const controller = new PersistenceController(snapshot, notify, repo, remote, restored);
    controller.update(snapshot); await controller.flush(); await controller.sync(); await controller.sync(); controller.stop();
    expect(remote.saveProgress).toHaveBeenCalledTimes(1);
    expect((await repo.load(identity.id))?.snapshot.lesson).toEqual(snapshot.lesson);
    expect(notify).toHaveBeenLastCalledWith('Saved on this device · Server needs attention');
  });
});
