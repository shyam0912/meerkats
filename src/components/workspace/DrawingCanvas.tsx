import { Stage, Layer, Line, Circle, Path } from "react-konva";
import type Konva from "konva";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import useDrawing from "../../store/useDrawing";
import { ToolManager } from "../../drawing/ToolManager";
import { scenePoint } from "../../drawing/scene";
import AnnotationLayer from "../layers/AnnotationLayer";
import PageBackground from '../whiteboard/PageBackground';
import { ShapeInteraction, shapePath } from '../../drawing/teachingShapes';

export default function DrawingCanvas({ enabled = true, transparent = false }: { enabled?: boolean; transparent?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draftShape = useRef<Konva.Path>(null);
  const [shapes] = useState(() => new ShapeInteraction());
  const draftLine = useRef<Konva.Line>(null);
  const draftDot = useRef<Konva.Circle>(null);
  const frame = useRef<number | null>(null);
  const [manager] = useState(() => new ToolManager());
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [inputError, setInputError] = useState("");
  const {
    document, selectedTool, strokeColor, strokeWidth, eraserWidth,
    commitStroke, commitShape, shapeType, shapeColor, shapeWidth, setInteracting, whiteboard, changePage,
  } = useDrawing();

  const paintDraft = useCallback(() => {
    frame.current = null;
    const shape = shapes.draft;
    draftShape.current?.setAttrs(shape ? { visible: true, data: shapePath(shape), stroke: shape.color, strokeWidth: shape.width } : { visible: false });
    draftShape.current?.getLayer()?.batchDraw();
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
  }, [manager, shapes]);

  const schedulePaint = () => {
    if (frame.current === null) frame.current = requestAnimationFrame(paintDraft);
  };

  const cancelInteraction = useCallback(() => {
    const pointerId = manager.pointerId ?? shapes.pointerId;
    shapes.cancel();
    manager.cancel();
    const element = containerRef.current;
    if (pointerId !== null && element?.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    paintDraft();
    setInteracting(false);
  }, [manager, shapes, paintDraft, setInteracting]);

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
  }, [cancelInteraction, enabled]);

  const point = (event: { clientX: number; clientY: number }) => {
    const bounds = containerRef.current!.getBoundingClientRect();
    return scenePoint({ x: event.clientX, y: event.clientY }, bounds, document.bounds);
  };

  const begin = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || event.button !== 0 || !event.isPrimary || size.width <= 1 || size.height <= 1) return;
    if (manager.pointerId !== null || shapes.pointerId !== null) return;
    if (selectedTool === 'shape') {
      if (transparent || !document.pageId || !shapes.begin(event.pointerId, crypto.randomUUID(), { shape: shapeType, color: shapeColor, width: shapeWidth }, point(event))) return;
    } else if (!manager.begin(event.pointerId,
      { tool: selectedTool, color: strokeColor, width: selectedTool === "eraser" ? eraserWidth / 6 : strokeWidth }, point(event), crypto.randomUUID())) return;
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
    if (shapes.pointerId === event.pointerId) {
      if (event.pointerType === 'mouse' && event.buttons === 0) { cancelInteraction(); return; }
      shapes.move(event.pointerId, point(event)); schedulePaint(); return;
    }
    if (manager.pointerId !== event.pointerId) return;
    if (event.pointerType === "mouse" && event.buttons === 0) { cancelInteraction(); return; }
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const sample of samples) manager.move(event.pointerId, point(sample));
    manager.move(event.pointerId, point(event));
    schedulePaint();
  };

  const complete = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (shapes.pointerId === event.pointerId) {
      const shape = shapes.complete(event.pointerId, point(event));
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null; paintDraft();
      if (shape) commitShape(shape);
      setInteracting(false); return;
    }
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
    <div ref={containerRef} role="region" aria-label={transparent ? "Content annotation surface" : "Whiteboard drawing surface"} tabIndex={enabled ? 0 : -1}
      data-document-id={document.id} data-session-id={document.owner.sessionId}
      data-page-id={document.pageId} data-background={document.background}
      data-shape-count={document.shapes?.length ?? 0} data-ink-count={document.objects.length} data-revision={document.revision}
      data-input-owner={enabled ? "ink" : "content"}
      className="absolute inset-0 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
      style={{ touchAction: enabled ? "none" : "auto", userSelect: "none", pointerEvents: enabled ? "auto" : "none", background: transparent ? "transparent" : "white" }}
      onPointerDown={begin} onPointerMove={move} onPointerUp={complete}
      onPointerCancel={(event) => { if (manager.pointerId === event.pointerId || shapes.pointerId === event.pointerId) cancelInteraction(); }}
      onLostPointerCapture={(event) => { if (manager.pointerId === event.pointerId || shapes.pointerId === event.pointerId) cancelInteraction(); }}
      onKeyDown={(event) => { if (event.key === "Escape") cancelInteraction(); }}>
      {!transparent && <PageBackground background={document.background} />}
      <Stage width={size.width} height={size.height} className="absolute inset-0" listening={false}>
        <Layer listening={false} scaleX={size.width / document.bounds.width} scaleY={size.height / document.bounds.height}>
          <AnnotationLayer objects={document.objects} />
          {/* Keep eraser draft on the same layer as ink so destination-out previews correctly. */}
          <Line ref={draftLine} visible={false} tension={0.5} lineCap="round" lineJoin="round" listening={false} />
          <Circle ref={draftDot} visible={false} listening={false} />
        </Layer>
        {!transparent && (selectedTool === 'shape' || Boolean(document.shapes?.length)) && <Layer listening={false} scaleX={size.width / document.bounds.width} scaleY={size.height / document.bounds.height}>
          {document.shapes?.map(shape => <Path key={shape.id} data={shapePath(shape)} stroke={shape.color} strokeWidth={shape.width} lineCap="round" lineJoin="round" listening={false} />)}
          <Path ref={draftShape} visible={false} lineCap="round" lineJoin="round" listening={false} />
        </Layer>}
      </Stage>
      {inputError && <p role="alert" className="absolute bottom-4 left-4 bg-white p-3 text-red-700">{inputError}</p>}
      {!transparent && whiteboard.error && <div role="alert" className="wb-capacity" onPointerDown={event => event.stopPropagation()}>
        <span>{whiteboard.error}</span><button className="workspace-button" disabled={manager.pointerId !== null || shapes.pointerId !== null} onClick={() => changePage({ type: 'dismiss-error' })}>Dismiss</button>
      </div>}
    </div>
  );
}
