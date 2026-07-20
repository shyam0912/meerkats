import { Line } from "react-konva";
import useDrawing from "../../store/useDrawing";

function AnnotationLayer() {
  const { strokes } = useDrawing();

  return (
    <>
      {strokes.map((stroke) => (
        <Line
          key={stroke.id}
          points={stroke.points}
          stroke={stroke.color}
          strokeWidth={stroke.width}
          tension={0.5}
          lineCap="round"
          lineJoin="round"
          globalCompositeOperation={
            stroke.tool === "eraser"
              ? "destination-out"
              : "source-over"
          }
        />
      ))}
    </>
  );
}

export default AnnotationLayer;