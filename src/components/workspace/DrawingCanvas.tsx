import { Stage, Layer, Line, Circle, Path } from "react-konva";
import type Konva from "konva";
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import useDrawing from "../../store/useDrawing";
import { ToolManager } from "../../drawing/ToolManager";
import { scenePoint } from "../../drawing/scene";
import AnnotationLayer from "../layers/AnnotationLayer";
import PageBackground from '../whiteboard/PageBackground';
import { ShapeInteraction, shapePath } from '../../drawing/teachingShapes';
import { pickHandle, pickShape, resizeShape, rotateShape, ShapeEditInteraction, shapeHandles, translateShape, type ShapeHandle } from '../../drawing/shapeEditing';
import ShapeSelection, { type ShapeSelectionRef } from '../whiteboard/ShapeSelection';

export default function DrawingCanvas({ enabled = true, transparent = false, selectionActionsHost }: {
  enabled?: boolean; transparent?: boolean; selectionActionsHost?: HTMLDivElement | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draftShape = useRef<Konva.Path>(null);
  const [shapes] = useState(() => new ShapeInteraction());
  const [editing] = useState(() => new ShapeEditInteraction());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectionView = useRef<ShapeSelectionRef>(null);
  const shapeNodes = useRef(new Map<string, Konva.Path>());
  const editingNode = useRef<{ node: Konva.Path; data: string } | null>(null);
  const draftLine = useRef<Konva.Line>(null);
  const draftDot = useRef<Konva.Circle>(null);
  const frame = useRef<number | null>(null);
  const [manager] = useState(() => new ToolManager());
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [inputError, setInputError] = useState("");
  const {
    document, selectedTool, strokeColor, strokeWidth, eraserWidth,
    commitStroke, commitShape, editShape, deleteShape, shapeType, shapeColor, shapeWidth, setInteracting, whiteboard, changePage,
  } = useDrawing();
  const selected = selectedTool === 'select' ? document.shapes?.find(s => s.id === selectedId) : undefined;
  if (selectedId && !selected) setSelectedId(null);
  const scale = size.width / document.bounds.width;

  const paintDraft = useCallback(() => {
    frame.current = null;
    if (editingNode.current) editingNode.current.node.data(editingNode.current.data);
    editingNode.current = null;
    if (editing.draft) {
      const node = shapeNodes.current.get(editing.draft.id);
      if (node) { editingNode.current = { node, data: node.data() }; node.data(shapePath(editing.draft)); }
    }
    selectionView.current?.preview(editing.draft);
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
  }, [manager, shapes, editing]);

  const schedulePaint = () => {
    if (frame.current === null) frame.current = requestAnimationFrame(paintDraft);
  };

  const cancelInteraction = useCallback(() => {
    const pointerId = manager.pointerId ?? shapes.pointerId ?? editing.pointerId;
    editing.cancel();
    shapes.cancel();
    manager.cancel();
    const element = containerRef.current;
    if (pointerId !== null && element?.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    paintDraft();
    setInteracting(false);
  }, [manager, shapes, editing, paintDraft, setInteracting]);

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
    if (manager.pointerId !== null || shapes.pointerId !== null || editing.pointerId !== null) return;
    if (selectedTool === 'select') {
      if (transparent || !document.pageId) return;
      const p = point(event);
      const handle = selected ? pickHandle(selected, p, scale) : undefined;
      const hit = handle ? selected : pickShape(document.shapes ?? [], p, 12 / scale);
      setSelectedId(hit?.id ?? null);
      event.currentTarget.focus({ preventScroll: true });
      event.preventDefault();
      if (!hit || !editing.begin(event.pointerId, hit, handle ?? 'move', p)) return;
    } else if (selectedTool === 'shape') {
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
    if (editing.pointerId === event.pointerId) {
      if (event.pointerType === 'mouse' && event.buttons === 0) { cancelInteraction(); return; }
      editing.move(event.pointerId, point(event)); schedulePaint(); return;
    }
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
    if (editing.pointerId === event.pointerId) {
      const shape = editing.complete(event.pointerId, point(event));
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null; paintDraft();
      if (shape) editShape(shape);
      setInteracting(false); return;
    }
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

  const interacting = () => manager.pointerId !== null || shapes.pointerId !== null || editing.pointerId !== null;
  const removeSelected = () => {
    if (!selected || interacting()) return;
    deleteShape(selected.id); setSelectedId(null); containerRef.current?.focus();
  };
  const handleKey = (handle: ShapeHandle, event: KeyboardEvent<SVGCircleElement>) => {
    if (!selected || interacting() || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 1 : 10;
    const p = shapeHandles(selected, scale).find(h => h.kind === handle)!.point;
    const next = handle === 'rotate' ? rotateShape(selected, (event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 1) * step * Math.PI / 180)
      : resizeShape(selected, handle, { x: p.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0), y: p.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) });
    if (next) editShape(next);
  };
  return (
    <div ref={containerRef} role="region" aria-label={transparent ? "Content annotation surface" : "Whiteboard drawing surface"} tabIndex={enabled ? 0 : -1}
      data-document-id={document.id} data-session-id={document.owner.sessionId}
      data-page-id={document.pageId} data-background={document.background}
      data-selected-shape={selected?.id ?? ''}
      data-shape-count={document.shapes?.length ?? 0} data-ink-count={document.objects.length} data-revision={document.revision}
      data-input-owner={enabled ? "ink" : "content"}
      className="absolute inset-0 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
      style={{ touchAction: enabled ? "none" : "auto", userSelect: "none", pointerEvents: enabled ? "auto" : "none", background: transparent ? "transparent" : "white" }}
      onPointerDown={begin} onPointerMove={move} onPointerUp={complete}
      onPointerCancel={(event) => { if (manager.pointerId === event.pointerId || shapes.pointerId === event.pointerId || editing.pointerId === event.pointerId) cancelInteraction(); }}
      onLostPointerCapture={(event) => { if (manager.pointerId === event.pointerId || shapes.pointerId === event.pointerId || editing.pointerId === event.pointerId) cancelInteraction(); }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); cancelInteraction(); setSelectedId(null); }
        if (event.target !== event.currentTarget || interacting() || !selected) return;
        if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelected(); }
        if (event.key.startsWith('Arrow')) {
          event.preventDefault(); const step = event.shiftKey ? 1 : 10;
          const next = translateShape(selected, { x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
            y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0 });
          if (next) editShape(next);
        }
      }}>
      {!transparent && <PageBackground background={document.background} />}
      <Stage width={size.width} height={size.height} className="absolute inset-0" listening={false}>
        <Layer listening={false} scaleX={size.width / document.bounds.width} scaleY={size.height / document.bounds.height}>
          <AnnotationLayer objects={document.objects} />
          {/* Keep eraser draft on the same layer as ink so destination-out previews correctly. */}
          <Line ref={draftLine} visible={false} tension={0.5} lineCap="round" lineJoin="round" listening={false} />
          <Circle ref={draftDot} visible={false} listening={false} />
        </Layer>
        {!transparent && (selectedTool === 'shape' || Boolean(document.shapes?.length)) && <Layer listening={false} scaleX={size.width / document.bounds.width} scaleY={size.height / document.bounds.height}>
          {document.shapes?.map(shape => <Path key={shape.id} ref={node => { if (node) shapeNodes.current.set(shape.id, node); else shapeNodes.current.delete(shape.id); }} data={shapePath(shape)} stroke={shape.color} strokeWidth={shape.width} lineCap="round" lineJoin="round" listening={false} />)}
          <Path ref={draftShape} visible={false} lineCap="round" lineJoin="round" listening={false} />
        </Layer>}
      </Stage>
      {selected && <ShapeSelection key={selected.id} ref={selectionView} shape={selected} scale={scale} onHandleKey={handleKey} />}
      {/* Keep selection local to this page; only its actions render outside the drawable scene. */}
      {!transparent && selectedTool === 'select' && selectionActionsHost && createPortal(<div className="wb-selection-actions" role="group" aria-label="Selected object actions" onPointerDown={event => event.stopPropagation()}>
        <button className="workspace-button" disabled={!document.shapes?.length || interacting()} onClick={() => {
          const list = document.shapes ?? []; const index = list.findIndex(s => s.id === selectedId);
          setSelectedId(list[(index + 1) % list.length]?.id ?? null); containerRef.current?.focus();
        }}>Next shape</button>
        {selected ? <><button className="workspace-button" disabled={interacting()} onClick={removeSelected}>Delete shape</button>
          <span>{selected.shape} selected <small>Drag to move · Handles resize / rotate<br />Arrow keys move · Tab to handles · Delete removes</small></span></>
          : <span>Tap a shape to select it</span>}
      </div>, selectionActionsHost)}
      {inputError && <p role="alert" className="absolute bottom-4 left-4 bg-white p-3 text-red-700">{inputError}</p>}
      {!transparent && whiteboard.error && <div role="alert" className="wb-capacity" onPointerDown={event => event.stopPropagation()}>
        <span>{whiteboard.error}</span><button className="workspace-button" disabled={interacting()} onClick={() => changePage({ type: 'dismiss-error' })}>Dismiss</button>
      </div>}
    </div>
  );
}
