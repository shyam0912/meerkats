import { useContext } from "react";
import { DrawingContext } from "./drawing-context";

export default function useDrawing() {
  const context = useContext(DrawingContext);
  

  if (!context) {
    throw new Error(
      "useDrawing must be used inside DrawingProvider"
    );
  }

  return context;
}