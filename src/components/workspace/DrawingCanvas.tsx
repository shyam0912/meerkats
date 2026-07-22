import { Stage, Layer } from "react-konva";
import { useEffect, useRef, useState } from "react";

import useDrawing from "../../store/useDrawing";
import type { KonvaEventObject } from "konva/lib/Node";

import { ToolManager } from "../../drawing/ToolManager";

import BackgroundLayer from "../layers/BackgroundLayer";
import AnnotationLayer from "../layers/AnnotationLayer";

function DrawingCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  const toolManager = useRef(new ToolManager());

  const {
    selectedTool,
    selectedShape,

    strokeColor,
    strokeWidth,

    addStroke,
    updateLastStroke,

    addShape,
    updateLastShape,
  } = useDrawing();

  const isDrawing = useRef(false);

  const [size, setSize] = useState({
    width: 1200,
    height: 700,
  });

  const handleMouseUp = (
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ) => {
    if (selectedTool === "pen") {
      toolManager.current.onPointerUp(e);
      return;
    }

    isDrawing.current = false;
  };

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

    toolManager.current.configure({
      selectedTool,
      selectedShape,

      strokeColor,
      strokeWidth,

      addStroke,
      updateLastStroke,

      addShape,
      updateLastShape,
    });

    if (selectedTool === "pen") {
      toolManager.current.onPointerDown(e);
      return;
    }

    if (selectedTool !== "eraser") {
      return;
    }

    isDrawing.current = true;

    const stage = e.target.getStage();

    if (!stage) return;

    const pos = stage.getPointerPosition();

    if (!pos) return;

    addStroke({
      id: Date.now().toString(),
      tool: selectedTool,
      color:
        selectedTool === "eraser"
          ? "#ffffff"
          : strokeColor,
      width:
        selectedTool === "eraser"
          ? strokeWidth * 6
          : strokeWidth,
      points: [pos.x, pos.y],
    });
  };

  const handleMouseMove = (
    e: KonvaEventObject<MouseEvent | TouchEvent>
  ) => {

    if (selectedTool === "pen") {
      toolManager.current.onPointerMove(e);
      return;
    }

    if (!isDrawing.current) return;


    const stage = e.target.getStage();

    if (!stage) return;

    const point = stage.getPointerPosition();

    if (!point) return;

    updateLastStroke(
      point.x,
      point.y
    );
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