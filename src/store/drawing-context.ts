import { createContext } from "react";
import type { DrawingDocument } from "../drawing/document";
import type { DrawingTool, Stroke } from "../types/drawing";

export interface DrawingContextType {
  document: DrawingDocument;
  selectedTool: DrawingTool;
  strokeColor: string;
  strokeWidth: number;
  isInteracting: boolean;
  canUndo: boolean;
  canRedo: boolean;
  setSelectedTool: (tool: DrawingTool) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setInteracting: (value: boolean) => void;
  commitStroke: (stroke: Stroke) => void;
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
}
export const DrawingContext = createContext<DrawingContextType | undefined>(undefined);
