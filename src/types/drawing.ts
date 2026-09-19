export type DrawingTool = "pen" | "eraser";

export type ShapeType =
  | "rectangle"
  | "circle"
  | "line"
  | "arrow";

export interface Stroke {
  id: string;
  kind: "ink";
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

// Shape definitions remain experimental; only ink is in the active document model.
