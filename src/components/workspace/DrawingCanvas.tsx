import { Stage, Layer } from "react-konva";

function DrawingCanvas() {
  return (
    <div className="flex-1 bg-white rounded-3xl overflow-hidden">
      <Stage
        width={1200}
        height={700}
      >
        <Layer />
      </Stage>
    </div>
  );
}

export default DrawingCanvas;