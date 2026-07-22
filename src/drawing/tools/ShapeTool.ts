import type { KonvaEventObject } from "konva/lib/Node";
import type { Shape, ShapeType } from "../../types/drawing";
import { BaseTool } from "./BaseTool";

export class ShapeTool extends BaseTool {

  private selectedShape: ShapeType;

  private strokeColor: string;

  private strokeWidth: number;

  private addShape: (shape: Shape) => void;

  private updateLastShape: (
    updater: (shape: Shape) => Shape
  ) => void;

  constructor(
    selectedShape: ShapeType,
    strokeColor: string,
    strokeWidth: number,
    addShape: (shape: Shape) => void,
    updateLastShape: (
      updater: (shape: Shape) => Shape
    ) => void
  ) {
    super();

    this.selectedShape = selectedShape;
    this.strokeColor = strokeColor;
    this.strokeWidth = strokeWidth;

    this.addShape = addShape;
    this.updateLastShape = updateLastShape;
  }

  onPointerDown(
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ) {
    this.isDrawing = true;

    const pos = this.getPointerPosition(e);

    if (!pos) return;

    this.addShape({
      id: Date.now().toString(),

      type: this.selectedShape,

      x: pos.x,
      y: pos.y,

      width: 0,
      height: 0,

      stroke: this.strokeColor,
      strokeWidth: this.strokeWidth,
    });
  }

  onPointerMove(
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ) {
    if (!this.isDrawing) return;

    const pos = this.getPointerPosition(e);

    if (!pos) return;

    this.updateLastShape((shape) => ({
      ...shape,
      width: pos.x - shape.x,
      height: pos.y - shape.y,
    }));
  }

  onPointerUp() {
    this.isDrawing = false;
  }
}