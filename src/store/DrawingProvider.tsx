import { useState, type ReactNode } from "react";
import { DrawingContext } from "./drawing-context";
import type { 
  DrawingTool, 
  DrawingState, 
  Stroke 
} from "../types/drawing";

interface Props {
  children: ReactNode;
}

export default function DrawingProvider({ children }: Props) {
  const [selectedTool, setSelectedTool] =
    useState<DrawingTool>("pen");

  const [strokeColor, setStrokeColor] =
    useState("#000000");

  const [strokeWidth, setStrokeWidth] =
    useState(3);

  const [strokes, setStrokes] =
    useState<Stroke[]>([]);

  return (
    <DrawingContext.Provider
      value={{
        selectedTool,
        strokeColor,
        strokeWidth,

        setSelectedTool,
        setStrokeColor,
        setStrokeWidth,

        strokes,
        setStrokes,
      }}
    >
      {children}
    </DrawingContext.Provider>
  );
}