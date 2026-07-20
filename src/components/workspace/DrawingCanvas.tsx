import { Stage, Layer } from "react-konva";
import { useEffect, useRef, useState } from "react";

import useDrawing from "../../store/useDrawing";
import type { Stroke } from "../../types/drawing";
import type { KonvaEventObject } from "konva/lib/Node";

import BackgroundLayer from "../layers/BackgroundLayer";
import AnnotationLayer from "../layers/AnnotationLayer";

function DrawingCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    strokes,
    setStrokes,
    selectedTool,
    strokeColor,
    strokeWidth,
  } = useDrawing();

  const isDrawing = useRef(false);

  const [size, setSize] = useState({
    width: 1200,
    height: 700,
  });

  useEffect(() => {
    function resize() {
      if (!containerRef.current) return;

      setSize({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
      });
    }

    resize();

    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);

  const handleMouseDown = (
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ) => {
    if (selectedTool !== "pen" && selectedTool !== "eraser") return;

    isDrawing.current = true;

    const stage = e.target.getStage();

    if (!stage) return;

    const pos = stage.getPointerPosition();


    if (!pos) return;

    const newStroke: Stroke = {
      id: Date.now().toString(),
      tool: selectedTool,
      color: selectedTool === "eraser" ? "#ffffff" : strokeColor,
      width:
        selectedTool === "eraser"
          ? strokeWidth * 6
          : strokeWidth,
      points: [pos.x, pos.y],
    };

    setStrokes((prev) => [...prev, newStroke]);
  };

  const handleMouseMove = (
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ) => {
    if (!isDrawing.current) return;

    const stage = e.target.getStage();

    if (!stage) return;

    const point = stage.getPointerPosition();


    if (!point) return;

    setStrokes((prev) => {
      if (prev.length === 0) return prev;

      const copy = [...prev];
      const lastStroke = { ...copy[copy.length - 1] };

      lastStroke.points = [
        ...lastStroke.points,
        point.x,
        point.y,
      ];

      copy[copy.length - 1] = lastStroke;

      return copy;
    });
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full rounded-3xl overflow-hidden"
    >
      {/* Background Layer */}
      <BackgroundLayer />

      {/* Annotation Layer */}
      <Stage
        width={size.width}
        height={size.height}
        className="absolute inset-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      >
        <Layer>
          <AnnotationLayer />
        </Layer>
      </Stage>
    </div>
  );
}

export default DrawingCanvas;