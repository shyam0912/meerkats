import type { KonvaEventObject } from "konva/lib/Node";
import type { Stroke } from "../../types/drawing";
import { BaseTool } from "./BaseTool";

export class PenTool extends BaseTool {

  private strokeColor: string;

  private strokeWidth: number;

  private addStroke: (stroke: Stroke) => void;

  private updateLastStroke: (
    pointX: number,
    pointY: number
  ) => void;

  constructor(
  strokeColor: string,
  strokeWidth: number,
  addStroke: (stroke: Stroke) => void,
  updateLastStroke: (x: number, y: number) => void
) {
  super();

  console.log("New PenTool created");

  this.strokeColor = strokeColor;
  this.strokeWidth = strokeWidth;
  this.addStroke = addStroke;
  this.updateLastStroke = updateLastStroke;
}

  setStrokeColor(color: string) {
    this.strokeColor = color;
  }

  setStrokeWidth(width: number) {
    this.strokeWidth = width;
  }

  onPointerDown(
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ) {

    console.log("Pen instance", this);

    this.isDrawing = true;

    const pos = this.getPointerPosition(e);

    if (!pos) return;

    this.addStroke({
      id: Date.now().toString(),
      tool: "pen",
      color: this.strokeColor,
      width: this.strokeWidth,
      points: [pos.x, pos.y],
    });
  }

  onPointerMove(
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ) {

    console.log("Move instance", this);

    if (!this.isDrawing) return;

    const pos = this.getPointerPosition(e);

    if (!pos) return;

    this.updateLastStroke(pos.x, pos.y);
  }

  onPointerUp() {
    this.isDrawing = false;
  }
}