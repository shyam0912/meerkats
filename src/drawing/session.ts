import { createDocument, documentReducer, type DocumentOwner, type DocumentState, type DocumentAction } from "./document";
import { DEMO_SCENE_ID } from "./scene";

export type TeachingMode = "whiteboard" | "explore" | "annotate";
export interface DrawingSession {
  mode: TeachingMode;
  whiteboard: DocumentState;
  annotations: Record<string, DocumentState>;
}
export type SessionAction =
  | { type: "mode"; mode: TeachingMode }
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
  const document = session.mode === "whiteboard" ? session.whiteboard : session.annotations[DEMO_SCENE_ID];
  if (!document) throw new Error("The teaching scene has no annotation document");
  return document;
}
export function sessionReducer(session: DrawingSession, action: SessionAction): DrawingSession {
  if (action.type === "mode") return { ...session, mode: action.mode };
  // Explicit document IDs prevent stale callbacks from writing into the newly selected document.
  if (session.whiteboard.document.id === action.documentId) {
    return { ...session, whiteboard: documentReducer(session.whiteboard, action.action) };
  }
  const entry = Object.entries(session.annotations).find(([, state]) => state.document.id === action.documentId);
  if (!entry) return session;
  return { ...session, annotations: { ...session.annotations, [entry[0]]: documentReducer(entry[1], action.action) } };
}
