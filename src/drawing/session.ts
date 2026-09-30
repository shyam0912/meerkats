import { createDocument, documentReducer, type DocumentOwner, type DocumentState, type DocumentAction } from "./document";
import { DEMO_SCENE_ID } from "./scene";
import { annotationKey, initialProgress, validProgress, type LessonVersion, type LessonSession, type ActivityState } from '../../contracts/lesson';

export type TeachingMode = "whiteboard" | "explore" | "annotate";
export interface DrawingSession {
  mode: TeachingMode;
  whiteboard: DocumentState;
  annotations: Record<string, DocumentState>;
  lesson?: LessonSession;
}
export type SessionAction =
  | { type: "mode"; mode: TeachingMode }
  | { type: "activity"; id: string }
  | { type: "activity-state"; id: string; state: ActivityState }
  | { type: "document"; documentId: string; action: DocumentAction };

export function createDrawingSession(owner: DocumentOwner, ids: { whiteboard: string; annotation: string }): DrawingSession {
  return {
    mode: "whiteboard",
    whiteboard: createDocument({ ...owner, target: { kind: "whiteboard" } }, ids.whiteboard),
    annotations: { [DEMO_SCENE_ID]: createDocument({
      ...owner, target: { kind: "annotation", sceneId: DEMO_SCENE_ID },
    }, ids.annotation) },
  };
}
export function activeDocument(session: DrawingSession): DocumentState {
  const activity = session.lesson?.version.activities.find(a => a.id === session.lesson?.progress.currentActivityId);
  const key = activity && session.lesson ? annotationKey({ lessonVersionId: session.lesson.version.id, activityId: activity.id, sceneId: activity.sceneId }) : DEMO_SCENE_ID;
  const document = session.mode === "whiteboard" ? session.whiteboard : session.annotations[key];
  if (!document) throw new Error("The teaching scene has no annotation document");
  return document;
}
export function sessionReducer(session: DrawingSession, action: SessionAction): DrawingSession {
  if (action.type === "mode") return { ...session, mode: action.mode };
  if (action.type === 'activity' || action.type === 'activity-state') {
    const lesson = session.lesson;
    if (!lesson || !lesson.version.activities.some(a => a.id === action.id)) return session;
    const progress = { ...lesson.progress, localRevision: lesson.progress.localRevision + 1,
      ...(action.type === 'activity' ? { currentActivityId: action.id } : { states: { ...lesson.progress.states, [action.id]: action.state } }) };
    if (!validProgress(lesson.version, progress)) return session;
    return { ...session, mode: action.type === 'activity' ? 'explore' : session.mode, lesson: { ...lesson, progress } };
  }
  // Explicit document IDs prevent stale callbacks from writing into the newly selected document.
  if (session.whiteboard.document.id === action.documentId) {
    return { ...session, whiteboard: documentReducer(session.whiteboard, action.action) };
  }
  const entry = Object.entries(session.annotations).find(([, state]) => state.document.id === action.documentId);
  if (!entry) return session;
  return { ...session, annotations: { ...session.annotations, [entry[0]]: documentReducer(entry[1], action.action) } };
}

export function createLessonSession(owner: DocumentOwner, version: LessonVersion): DrawingSession {
  return { mode: 'explore', whiteboard: createDocument({ ...owner, target: { kind: 'whiteboard' } }, crypto.randomUUID()),
    lesson: { version, progress: initialProgress(version) },
    annotations: Object.fromEntries(version.activities.map(activity => {
      const target = { kind: 'annotation' as const, sceneId: activity.sceneId, activityId: activity.id, lessonVersionId: version.id };
      return [annotationKey(target), createDocument({ ...owner, target }, crypto.randomUUID())];
    })) };
}
