export type DrawingTool =
  | "pen"
  | "eraser"
  | "shape"
  | "text";

export type ShapeType =
  | "rectangle"
  | "circle"
  | "line"
  | "arrow";

export interface Stroke {
  id: string;
  tool: "pen" | "eraser";
  color: string;
  width: number;
  points: number[];
}

export interface Shape {
  id: string;

  type: ShapeType;

  x: number;
  y: number;

  width: number;
  height: number;

  stroke: string;
  strokeWidth: number;

  fill?: string;
}

export interface DrawingState {
  selectedTool: DrawingTool;

  selectedShape: ShapeType;

  strokeColor: string;
  strokeWidth: number;

  strokes: Stroke[];
  shapes: Shape[];
}