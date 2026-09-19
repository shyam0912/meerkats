import { Stage, Layer, Line, Circle } from "react-konva";
import type Konva from "konva";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import useDrawing from "../../store/useDrawing";
import { ToolManager } from "../../drawing/ToolManager";
import BackgroundLayer from "../layers/BackgroundLayer";
import AnnotationLayer from "../layers/AnnotationLayer";

export default function DrawingCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const draftLine = useRef<Konva.Line>(null);
  const draftDot = useRef<Konva.Circle>(null);
  const frame = useRef<number | null>(null);
  const [manager] = useState(() => new ToolManager());
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [inputError, setInputError] = useState("");
  const {
    document, selectedTool, strokeColor, strokeWidth,
    commitStroke, setInteracting,
  } = useDrawing();

  const paintDraft = useCallback(() => {
    frame.current = null;
    const draft = manager.draft;
    draftLine.current?.visible(false);
    draftDot.current?.visible(false);
    if (draft) {
      const common = {
        globalCompositeOperation: draft.tool === "eraser" ? "destination-out" as const : "source-over" as const,
        visible: true,
      };
      if (draft.points.length === 2) {
        draftDot.current?.setAttrs({ ...common, x: draft.points[0], y: draft.points[1],
          radius: draft.width / 2, fill: draft.color });
      } else {
        draftLine.current?.setAttrs({ ...common, points: [...draft.points],
          stroke: draft.color, strokeWidth: draft.width });
      }
    }
    draftLine.current?.getLayer()?.batchDraw();
  }, [manager]);

  const schedulePaint = () => {
    if (frame.current === null) frame.current = requestAnimationFrame(paintDraft);
  };

  const cancelInteraction = useCallback(() => {
    const pointerId = manager.pointerId;
    manager.cancel();
    const element = containerRef.current;
    if (pointerId !== null && element?.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    paintDraft();
    setInteracting(false);
  }, [manager, paintDraft, setInteracting]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      // A changing coordinate space invalidates only the transient gesture.
      cancelInteraction();
      setSize((previous) => previous.width === width && previous.height === height
        ? previous : { width, height });
    });
    observer.observe(element);
    const onVisibility = () => { if (window.document.hidden) cancelInteraction(); };
    window.addEventListener("blur", cancelInteraction);
    window.document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      window.removeEventListener("blur", cancelInteraction);
      window.document.removeEventListener("visibilitychange", onVisibility);
      cancelInteraction();
    };
  }, [cancelInteraction]);

  const point = (event: { clientX: number; clientY: number }) => {
    const bounds = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(size.width, (event.clientX - bounds.left) * size.width / bounds.width)),
      y: Math.max(0, Math.min(size.height, (event.clientY - bounds.top) * size.height / bounds.height)),
    };
  };

  const begin = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary || size.width <= 1 || size.height <= 1) return;
    if (!manager.begin(event.pointerId,
      { tool: selectedTool, color: strokeColor, width: strokeWidth }, point(event), crypto.randomUUID())) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      cancelInteraction();
      setInputError("Drawing input could not be captured. Please try again.");
      return;
    }
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    setInputError("");
    setInteracting(true);
    schedulePaint();
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (manager.pointerId !== event.pointerId) return;
    if (event.pointerType === "mouse" && event.buttons === 0) { cancelInteraction(); return; }
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const sample of samples) manager.move(event.pointerId, point(sample));
    manager.move(event.pointerId, point(event));
    schedulePaint();
  };

  const complete = (event: ReactPointerEvent<HTMLDivElement>) => {
    const stroke = manager.complete(event.pointerId, point(event));
    if (!stroke) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    paintDraft();
    commitStroke(stroke);
    setInteracting(false);
  };

  return (
    <div ref={containerRef} role="region" aria-label="Whiteboard drawing surface" tabIndex={0}
      data-document-id={document.id} data-session-id={document.owner.sessionId}
      data-ink-count={document.objects.length} data-revision={document.revision}
      className="relative w-full h-full rounded-3xl overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      style={{ touchAction: "none", userSelect: "none" }}
      onPointerDown={begin} onPointerMove={move} onPointerUp={complete}
      onPointerCancel={(event) => { if (manager.pointerId === event.pointerId) cancelInteraction(); }}
      onLostPointerCapture={(event) => { if (manager.pointerId === event.pointerId) cancelInteraction(); }}
      onKeyDown={(event) => { if (event.key === "Escape") cancelInteraction(); }}>
      <BackgroundLayer />
      <Stage width={size.width} height={size.height} className="absolute inset-0" listening={false}>
        <Layer listening={false}>
          <AnnotationLayer objects={document.objects} />
          {/* Keep eraser draft on the same layer as ink so destination-out previews correctly. */}
          <Line ref={draftLine} visible={false} tension={0.5} lineCap="round" lineJoin="round" listening={false} />
          <Circle ref={draftDot} visible={false} listening={false} />
        </Layer>
      </Stage>
      {inputError && <p role="alert" className="absolute bottom-4 left-4 bg-white p-3 text-red-700">{inputError}</p>}
    </div>
  );
}
