export type DrawingTool =
  | "pen"
  | "eraser"
  | "line"
  | "rectangle"
  | "circle"
  | "arrow"
  | "text";

export interface Stroke {
  id: string;
  tool: "pen" | "eraser";
  color: string;
  width: number;
  points: number[];
}

export interface DrawingState {
  selectedTool: DrawingTool;
  strokeColor: string;
  strokeWidth: number;

  strokes: Stroke[];
}