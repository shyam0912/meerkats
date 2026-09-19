import type { Stroke } from "../../types/drawing";

export interface Point { x: number; y: number }
export interface InkSettings { tool: "pen" | "eraser"; color: string; width: number }

/** One instance per gesture. This buffer is transient, never document/history state. */
export class InkTool {
  readonly draft: Stroke;
  constructor(id: string, point: Point, tool: Stroke["tool"], color: string, width: number) {
    this.draft = { id, kind: "ink", tool, color, width, points: [point.x, point.y] };
  }
  move(point: Point) {
    const points = this.draft.points;
    if (points.at(-2) !== point.x || points.at(-1) !== point.y) points.push(point.x, point.y);
  }
  complete(): Stroke { return { ...this.draft, points: [...this.draft.points] }; }
}
