import { createContext } from "react";
import type {
  DrawingState,
  DrawingTool,
  Stroke,
} from "../types/drawing";

export interface DrawingContextType extends DrawingState {
  setSelectedTool: (tool: DrawingTool) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;

  setStrokes: React.Dispatch<
    React.SetStateAction<Stroke[]>
  >;
}

export const DrawingContext =
  createContext<DrawingContextType | undefined>(undefined);