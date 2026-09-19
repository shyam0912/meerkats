import { describe, expect, it } from "vitest";
import { ToolManager } from "./ToolManager";
import { createDocument, documentReducer } from "./document";
import type { InkSettings } from "./tools/InkTool";

const settings: InkSettings = { tool: "pen", color: "#ff0000", width: 3 };
describe("gesture-scoped ToolManager", () => {
  it("keeps the active tool stable despite fresh settings and repeated begin attempts", () => {
    const manager = new ToolManager();
    manager.begin(1, settings, { x: 0, y: 0 }, "a");
    const initialDraft = manager.draft;
    for (let n = 1; n <= 100; n++) {
      expect(manager.begin(1, { tool: "eraser", color: "#00ff00", width: 20 }, { x: n, y: n }, "replacement")).toBe(false);
      manager.move(1, { x: n, y: Math.sin(n) * 20 });
      expect(manager.draft).toBe(initialDraft);
    }
    const stroke = manager.complete(1, { x: 101, y: 0 });
    expect(stroke).toMatchObject({ id: "a", tool: "pen", color: "#ff0000", width: 3 });
    expect(stroke?.points).toHaveLength(204);
    expect(manager.draft).toBeNull();
  });
  it("does not commit any draft before completion and cancellation leaves history unchanged", () => {
    const manager = new ToolManager();
    const state = createDocument({ sessionId: "s", classId: null, subjectId: null }, "d");
    manager.begin(1, settings, { x: 0, y: 0 }, "a");
    manager.move(1, { x: 10, y: 10 });
    expect(state.document.objects).toEqual([]);
    manager.cancel();
    expect(manager.complete(1, { x: 20, y: 20 })).toBeNull();
    expect(state.past).toEqual([]);
    manager.begin(2, settings, { x: 1, y: 1 }, "b");
    const committed = manager.complete(2, { x: 2, y: 2 });
    if (!committed) throw new Error("Expected completed gesture");
    expect(documentReducer(state, { type: "commit", stroke: committed }).past).toHaveLength(1);
  });
  it("ignores a second pointer's move, release and cancellation", () => {
    const manager = new ToolManager();
    manager.begin(1, settings, { x: 1, y: 1 }, "a");
    expect(manager.begin(2, settings, { x: 40, y: 40 }, "b")).toBe(false);
    manager.move(2, { x: 50, y: 50 });
    manager.cancel(2);
    expect(manager.complete(2, { x: 60, y: 60 })).toBeNull();
    expect(manager.draft?.points).toEqual([1, 1]);
    expect(manager.complete(1, { x: 1, y: 1 })?.points).toEqual([1, 1]);
  });
  it("commits Pen, Eraser and Pen through the same lifecycle", () => {
    const manager = new ToolManager();
    for (const tool of ["pen", "eraser", "pen"] as const) {
      manager.begin(1, { ...settings, tool }, { x: 1, y: 1 }, tool);
      manager.move(1, { x: 5, y: 5 });
      expect(manager.complete(1, { x: 10, y: 10 })).toMatchObject({
        tool, width: tool === "eraser" ? 18 : 3, points: [1, 1, 5, 5, 10, 10],
      });
      expect(manager.complete(1, { x: 10, y: 10 })).toBeNull();
    }
  });
});
