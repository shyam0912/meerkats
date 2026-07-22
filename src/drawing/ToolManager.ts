import type { KonvaEventObject } from "konva/lib/Node";

import { BaseTool } from "./tools/BaseTool";
import { PenTool } from "./tools/PenTool";
import { EraserTool } from "./tools/EraserTool";
import { ShapeTool } from "./tools/ShapeTool";

import type {
  DrawingTool,
  ShapeType,
  Shape,
  Stroke,
} from "../types/drawing";

export class ToolManager {
  private activeTool: BaseTool | null = null;

  configure({
    selectedTool,
    selectedShape,
    strokeColor,
    strokeWidth,

    addStroke,
    updateLastStroke,

    addShape,
    updateLastShape,
  }: {
    selectedTool: DrawingTool;

    selectedShape: ShapeType;

    strokeColor: string;

    strokeWidth: number;

    addStroke: (stroke: Stroke) => void;

    updateLastStroke: (
      x: number,
      y: number
    ) => void;

    addShape: (shape: Shape) => void;

    updateLastShape: (
      updater: (shape: Shape) => Shape
    ) => void;
  }) {
    switch (selectedTool) {
      case "pen":
        this.activeTool = new PenTool(
          strokeColor,
          strokeWidth,
          addStroke,
          updateLastStroke
        );
        break;

      case "eraser":
        this.activeTool = new EraserTool(
          strokeWidth,
          addStroke,
          updateLastStroke
        );
        break;

      case "shape":
        this.activeTool = new ShapeTool(
          selectedShape,
          strokeColor,
          strokeWidth,
          addShape,
          updateLastShape
        );
        break;

      default:
        this.activeTool = null;
    }
  }



  onPointerDown(
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ) {
    console.log("ToolManager:", this.activeTool);

    this.activeTool?.onPointerDown(e);
  }


  onPointerMove(
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ) {
    this.activeTool?.onPointerMove(e);
  }

  onPointerUp(
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ) {
    this.activeTool?.onPointerUp(e);
  }
}