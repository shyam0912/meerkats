import { memo } from "react";
import { Circle, Line } from "react-konva";
import type { Stroke } from "../../types/drawing";

const InkObject = memo(function InkObject({ stroke }: { stroke: Stroke }) {
  const operation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  if (stroke.points.length === 2) {
    return <Circle x={stroke.points[0]} y={stroke.points[1]} radius={stroke.width / 2}
      fill={stroke.color} globalCompositeOperation={operation} listening={false} />;
  }
  return <Line points={stroke.points} stroke={stroke.color} strokeWidth={stroke.width}
    tension={0.5} lineCap="round" lineJoin="round"
    globalCompositeOperation={operation} listening={false} />;
});

export default function AnnotationLayer({ objects }: { objects: readonly Stroke[] }) {
  return <>{objects.map((stroke) => <InkObject key={stroke.id} stroke={stroke} />)}</>;
}
