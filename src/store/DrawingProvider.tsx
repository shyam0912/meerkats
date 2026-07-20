import { useState, type ReactNode } from "react";
import { DrawingContext } from "./drawing-context";
import type {
  DrawingTool,
  Stroke,
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

  // History
  const [history, setHistory] =
    useState<Stroke[][]>([]);

  const [historyIndex, setHistoryIndex] =
    useState(-1);

  const saveHistory = (nextStrokes: Stroke[]) => {
    const newHistory = history.slice(0, historyIndex + 1);

    newHistory.push(nextStrokes);

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const addStroke = (stroke: Stroke) => {
    setStrokes((prev) => {
      const next = [...prev, stroke];
      saveHistory(next);
      return next;
    });
  };

  const updateLastStroke = (
    pointX: number,
    pointY: number
  ) => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;

      const copy = [...prev];

      const lastStroke = {
        ...copy[copy.length - 1],
      };

      lastStroke.points = [
        ...lastStroke.points,
        pointX,
        pointY,
      ];

      copy[copy.length - 1] = lastStroke;

      return copy;
    });
  };

  const undo = () => {
    if (historyIndex <= 0) return;

    const newIndex = historyIndex - 1;

    setHistoryIndex(newIndex);
    setStrokes(history[newIndex]);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;

    const newIndex = historyIndex + 1;

    setHistoryIndex(newIndex);
    setStrokes(history[newIndex]);
  };

  const clearCanvas = () => {
    setStrokes([]);
    saveHistory([]);
  };

  return (
    <DrawingContext.Provider
      value={{
        selectedTool,
        strokeColor,
        strokeWidth,

        strokes,

        setSelectedTool,
        setStrokeColor,
        setStrokeWidth,

        addStroke,
        updateLastStroke,

        undo,
        redo,
        clearCanvas,
      }}
    >
      {children}
    </DrawingContext.Provider>
  );
}