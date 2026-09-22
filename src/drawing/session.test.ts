import { describe, expect, it } from "vitest";
import { activeDocument, createDrawingSession, sessionReducer, type DrawingSession } from "./session";
import { DEMO_SCENE_ID } from "./scene";
import type { Stroke } from "../types/drawing";
const owner = { sessionId: "session", classId: "5", subjectId: "demo" };
const fresh = () => createDrawingSession(owner, { whiteboard: "board", annotation: "annotation" });
const ink = (id: string): Stroke => ({ id, kind: "ink", tool: "pen", color: "#000", width: 3, points: [10, 10] });
const act = (state: DrawingSession, type: "undo" | "redo" | "clear") =>
  sessionReducer(state, { type: "document", documentId: activeDocument(state).document.id, action: { type } });
const add = (state: DrawingSession, id: string) => sessionReducer(state, {
  type: "document", documentId: activeDocument(state).document.id, action: { type: "commit", stroke: ink(id) },
});
describe("session document ownership", () => {
  it("has explicit separate targets, IDs and histories", () => {
    const session = fresh();
    expect(session.whiteboard.document.owner.target).toEqual({ kind: "whiteboard" });
    expect(session.annotations[DEMO_SCENE_ID]?.document.owner.target).toEqual({ kind: "annotation", sceneId: DEMO_SCENE_ID });
    expect(session.whiteboard.document.id).not.toBe(session.annotations[DEMO_SCENE_ID]?.document.id);
  });
  it("preserves both documents with independent Undo, Redo, Clear and branching", () => {
    let state = add(fresh(), "board-a");
    state = sessionReducer(state, { type: "mode", mode: "annotate" });
    state = add(state, "annotation-a");
    state = act(state, "clear");
    expect(activeDocument(state).document.objects).toEqual([]);
    state = act(state, "undo");
    expect(activeDocument(state).document.objects.map(x => x.id)).toEqual(["annotation-a"]);
    state = sessionReducer(state, { type: "mode", mode: "whiteboard" });
    state = act(state, "undo");
    state = add(state, "board-b");
    expect(state.whiteboard.future).toEqual([]);
    state = sessionReducer(state, { type: "mode", mode: "explore" });
    expect(activeDocument(state).future).toHaveLength(1);
    state = act(state, "redo");
    expect(activeDocument(state).document.objects).toEqual([]);
    expect(state.whiteboard.document.objects.map(x => x.id)).toEqual(["board-b"]);
  });
  it("routes an explicitly addressed completion to its original document and rejects unknown IDs", () => {
    let state = fresh();
    state = sessionReducer(state, { type: "mode", mode: "annotate" });
    state = sessionReducer(state, { type: "document", documentId: "board", action: { type: "commit", stroke: ink("late") } });
    expect(state.whiteboard.document.objects).toHaveLength(1);
    expect(activeDocument(state).document.objects).toHaveLength(0);
    expect(sessionReducer(state, { type: "document", documentId: "old-session-document", action: { type: "clear" } })).toBe(state);
  });
  it("creates a fresh session without either previous document or history", () => {
    let old = add(fresh(), "board");
    old = add(sessionReducer(old, { type: "mode", mode: "annotate" }), "annotation");
    const next = createDrawingSession({ ...owner, sessionId: "new" }, { whiteboard: "new-board", annotation: "new-annotation" });
    expect(next.whiteboard.document.objects).toEqual([]);
    expect(next.annotations[DEMO_SCENE_ID]?.past).toEqual([]);
    expect(old.annotations[DEMO_SCENE_ID]?.document.objects).toHaveLength(1);
  });
});
