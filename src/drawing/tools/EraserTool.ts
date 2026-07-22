import type { KonvaEventObject } from "konva/lib/Node";
import type { Stroke } from "../../types/drawing";
import { BaseTool } from "./BaseTool";

export class EraserTool extends BaseTool {

  private strokeWidth: number;

  private addStroke: (stroke: Stroke) => void;

  private updateLastStroke: (
    pointX: number,
    pointY: number
  ) => void;

  constructor(
    strokeWidth: number,
    addStroke: (stroke: Stroke) => void,
    updateLastStroke: (
      pointX: number,
      pointY: number
    ) => void
  ) {
    super();

    this.strokeWidth = strokeWidth;
    this.addStroke = addStroke;
    this.updateLastStroke = updateLastStroke;
  }

  setStrokeWidth(width: number) {
    this.strokeWidth = width;
  }

  onPointerDown(
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ) {
    this.isDrawing = true;

    const pos = this.getPointerPosition(e);

    if (!pos) return;

    this.addStroke({
      id: Date.now().toString(),
      tool: "eraser",
      color: "#ffffff",
      width: this.strokeWidth * 6,
      points: [pos.x, pos.y],
    });
  }

  onPointerMove(
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ) {
    if (!this.isDrawing) return;

    const pos = this.getPointerPosition(e);

    if (!pos) return;

    this.updateLastStroke(pos.x, pos.y);
  }

  onPointerUp() {
    this.isDrawing = false;
  }
}