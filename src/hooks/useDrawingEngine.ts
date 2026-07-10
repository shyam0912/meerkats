import useDrawing from "../store/useDrawing";

export default function useDrawingEngine() {
  const drawing = useDrawing();

  return {
    ...drawing,
  };
}