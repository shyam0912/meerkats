import { createContext } from "react";
import type {
  DrawingState,
  DrawingTool,
  Shape,
  ShapeType,
  Stroke,
} from "../types/drawing";

export interface DrawingContextType extends DrawingState {
  setSelectedTool: (tool: DrawingTool) => void;

  setSelectedShape: (shape: ShapeType) => void;

  setStrokeColor: (color: string) => void;

  setStrokeWidth: (width: number) => void;

  addStroke: (stroke: Stroke) => void;

  updateLastStroke: (
    pointX: number,
    pointY: number
  ) => void;

  addShape: (shape: Shape) => void;

  updateLastShape: (
    updater: (shape: Shape) => Shape
  ) => void;

  clearCanvas: () => void;

  undo: () => void;

  redo: () => void;
}

export const DrawingContext =
  createContext<DrawingContextType | undefined>(undefined);