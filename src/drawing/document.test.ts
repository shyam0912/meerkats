import { describe, expect, it } from "vitest";
import { createDocument, documentReducer, HISTORY_LIMIT, type DocumentState } from "./document";
import type { Stroke } from "../types/drawing";

const owner = { sessionId: "session-a", classId: "class-5", subjectId: "science" };
const ink = (id: string, tool: Stroke["tool"] = "pen"): Stroke =>
  ({ id, kind: "ink", tool, color: "#000000", width: 3, points: [1, 2, 30, 40] });
const empty = () => createDocument(owner, "doc-a");
const add = (state: DocumentState, id: string) => documentReducer(state, { type: "commit", stroke: ink(id) });
const ids = (state: DocumentState) => state.document.objects.map((object) => object.id);

describe("committed document/history", () => {
  it("undoes the first complete stroke to EMPTY and redoes all its points", () => {
    const a = add(empty(), "a");
    const undone = documentReducer(a, { type: "undo" });
    expect(ids(undone)).toEqual([]);
    expect(documentReducer(undone, { type: "redo" }).document.objects).toEqual([ink("a")]);
  });
  it("repeated Undo and Redo traverse A, B, C in order", () => {
    let state = ["a", "b", "c"].reduce(add, empty());
    for (const expected of [["a", "b"], ["a"], []]) {
      state = documentReducer(state, { type: "undo" });
      expect(ids(state)).toEqual(expected);
    }
    expect(documentReducer(state, { type: "undo" })).toBe(state);
    for (const expected of [["a"], ["a", "b"], ["a", "b", "c"]]) {
      state = documentReducer(state, { type: "redo" });
      expect(ids(state)).toEqual(expected);
    }
    expect(documentReducer(state, { type: "redo" })).toBe(state);
  });
  it("discards the obsolete Redo branch after A B C / undo / undo / D", () => {
    let state = ["a", "b", "c"].reduce(add, empty());
    state = documentReducer(documentReducer(state, { type: "undo" }), { type: "undo" });
    state = add(state, "d");
    expect(ids(state)).toEqual(["a", "d"]);
    expect(state.future).toEqual([]);
    expect(documentReducer(state, { type: "redo" })).toBe(state);
  });
  it("Clear is one reversible operation and preserves eraser order", () => {
    const a = add(empty(), "a");
    const before = documentReducer(a, { type: "commit", stroke: ink("eraser", "eraser") });
    const cleared = documentReducer(before, { type: "clear" });
    expect(ids(cleared)).toEqual([]);
    expect(cleared.past.length).toBe(3);
    const restored = documentReducer(cleared, { type: "undo" });
    expect(restored.document.objects).toEqual(before.document.objects);
    expect(ids(documentReducer(restored, { type: "redo" }))).toEqual([]);
  });
  it("empty Clear is a no-op, including when a Redo branch exists", () => {
    const state = empty();
    expect(documentReducer(state, { type: "clear" })).toBe(state);
    const undone = documentReducer(add(state, "a"), { type: "undo" });
    expect(documentReducer(undone, { type: "clear" })).toBe(undone);
  });
  it("copies input buffers and accepts a single-point dot", () => {
    const stroke = { ...ink("dot"), points: [2, 3] };
    const state = documentReducer(empty(), { type: "commit", stroke });
    stroke.points.push(90, 90);
    expect(state.document.objects[0]?.points).toEqual([2, 3]);
  });
  it("isolates document state, ownership and history", () => {
    const a = add(empty(), "a");
    const b = createDocument({ sessionId: "session-b", classId: "class-1", subjectId: "math" }, "doc-b");
    expect(ids(b)).toEqual([]);
    expect(b.past).toEqual([]);
    expect(b.document.id).not.toBe(a.document.id);
    expect(documentReducer(b, { type: "undo" })).toBe(b);
    expect(ids(a)).toEqual(["a"]);
  });
  it("increments revision on changes, including Undo and Redo", () => {
    let state = add(empty(), "a");
    state = documentReducer(state, { type: "undo" });
    state = documentReducer(state, { type: "redo" });
    expect(state.document.revision).toBe(3);
  });
  it("bounds history without deleting old visible ink", () => {
    let state = empty();
    for (let n = 0; n < HISTORY_LIMIT + 5; n++) state = add(state, String(n));
    expect(state.past).toHaveLength(HISTORY_LIMIT);
    for (let n = 0; n < HISTORY_LIMIT; n++) state = documentReducer(state, { type: "undo" });
    expect(state.document.objects).toHaveLength(5);
  });
  it("rejects malformed geometry and duplicate IDs without altering history", () => {
    const state = add(empty(), "a");
    for (const stroke of [ink("a"), { ...ink("bad"), points: [NaN, 1] },
      { ...ink("odd"), points: [1, 2, 3] }, { ...ink("width"), width: -1 }]) {
      expect(documentReducer(state, { type: "commit", stroke })).toBe(state);
    }
  });
});
