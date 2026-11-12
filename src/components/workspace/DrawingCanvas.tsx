import { Stage, Layer, Line, Circle, Path, Shape } from "react-konva";
import type Konva from "konva";
import { createPortal } from 'react-dom';
import TextEditor from '../whiteboard/TextEditor';
import type { TeachingText } from '../../../contracts';
import { drawTeachingText, ensureBoardFont, hitText, moveText, TextMoveInteraction } from '../../drawing/teachingText';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import useDrawing from "../../store/useDrawing";
import { ToolManager } from "../../drawing/ToolManager";
import { scenePoint } from "../../drawing/scene";
import { MAX_SELECTION, MultiObjectInteraction, duplicateObjects, enclosedObjects, moveObjects, selectionBounds, type EditableObject, type Bounds } from '../../drawing/objectSelection';
import { duplicateObject } from '../../drawing/duplicateObject';
import AnnotationLayer from "../layers/AnnotationLayer";
import PageBackground from '../whiteboard/PageBackground';
import { ShapeInteraction, shapePath } from '../../drawing/teachingShapes';
import { hitShape, pickHandle, pickShape, resizeShape, rotateShape, ShapeEditInteraction, shapeHandles, translateShape, type ShapeHandle } from '../../drawing/shapeEditing';
import ShapeSelection, { type ShapeSelectionRef } from '../whiteboard/ShapeSelection';

export default function DrawingCanvas({ enabled = true, transparent = false, selectionActionsHost }: {
  enabled?: boolean; transparent?: boolean; selectionActionsHost?: HTMLDivElement | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draftShape = useRef<Konva.Path>(null);
  const [shapes] = useState(() => new ShapeInteraction());
  const [editing] = useState(() => new ShapeEditInteraction());
  const [textMoving] = useState(() => new TextMoveInteraction());
  const [textDraft, setTextDraft] = useState<TeachingText | null>(null);
  const [textEditor, setTextEditor] = useState<{ text: TeachingText; creating: boolean } | null>(null);
  const [fontReady, setFontReady] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [multiple, setMultiple] = useState(false);
  const [multi] = useState(() => new MultiObjectInteraction());
  const [multiPreview, setMultiPreview] = useState<{ objects: readonly EditableObject[] | null; box: Bounds | null }>({ objects: null, box: null });
  const multiNodes = useRef<{ node: Konva.Path; data: string }[]>([]);
  const selectionTap = useRef<{ id?: string; start: { x: number; y: number }; additive: boolean } | null>(null);
  const cycle = useRef({ shape: '', text: '' });
  const [requestedBatch, setRequestedBatch] = useState<string[] | null>(null);
  const selectedId = selectedIds.length === 1 ? selectedIds[0]! : null;
  const selectOne = (id: string | null) => setSelectedIds(id ? [id] : []);
  const [requestedCopy, setRequestedCopy] = useState<string | null>(null);
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
    batchObjects, document, selectedTool, strokeColor, strokeWidth, eraserWidth,
    saveText, deleteText, setTextEditing, setSelectedTool, commitStroke, commitObject, editShape, deleteShape, shapeType, shapeColor, shapeWidth, setInteracting, whiteboard, changePage,
  } = useDrawing();
  const editable: EditableObject[] = [...(document.shapes ?? []), ...(document.texts ?? [])];
  const selectedObjects = selectedTool === 'select' ? editable.filter(o => selectedIds.includes(o.id)) : [];
  if (selectedIds.some(id => !selectedObjects.some(o => o.id === id))) setSelectedIds(selectedObjects.map(o => o.id));
  if (requestedBatch) {
    if (requestedBatch.every(id => editable.some(o => o.id === id))) setSelectedIds(requestedBatch);
    setRequestedBatch(null);
  }
  const updateSelection = (ids: string[]) => {
    if (ids.length > MAX_SELECTION) { setInputError('Select up to 100 objects at a time. Your previous selection is unchanged.'); return; }
    setInputError(''); setSelectedIds(ids);
  };
  const toggleObject = (id: string) => updateSelection(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  const selected = selectedTool === 'select' ? document.shapes?.find(s => s.id === selectedId) : undefined;
  const selectedText = selectedTool === 'select' ? document.texts?.find(t => t.id === selectedId) : undefined;
  if (selectedId && !selected && !selectedText) selectOne(null);
  if (requestedCopy) {
    // The reducer can reject a copy at capacity. Select only an accepted object.
    if (document.shapes?.some(s => s.id === requestedCopy) || document.texts?.some(t => t.id === requestedCopy)) selectOne(requestedCopy);
    setRequestedCopy(null);
  }
  const scale = size.width / document.bounds.width;

  const needsFont = Boolean(document.texts?.length) || selectedTool === 'text';
  useEffect(() => {
    if (!needsFont) return;
    let active = true;
    void ensureBoardFont().then(() => { if (active) setFontReady(true); })
      .catch(() => { if (active) setInputError('Text font unavailable. Your text is preserved; reload to retry rendering.'); });
    return () => { active = false; };
  }, [needsFont]);
  useEffect(() => () => setTextEditing(false), [setTextEditing]);
  const closeTextEditor = () => { setTextEditor(null); setTextEditing(false); containerRef.current?.focus(); };
  const openTextEditor = (text: TeachingText, creating: boolean) => { setTextEditor({ text, creating }); setTextEditing(true); };

  const paintDraft = useCallback(() => {
    frame.current = null;
    setTextDraft(textMoving.draft);
    const restoringMulti = multiNodes.current.length > 0;
    for (const { node, data } of multiNodes.current) node.data(data);
    multiNodes.current = [];
    for (const object of multi.draft ?? []) if (object.kind === 'shape') {
      const node = shapeNodes.current.get(object.id);
      if (node) { multiNodes.current.push({ node, data: node.data() }); node.data(shapePath(object)); }
    }
    setMultiPreview(previous => previous.objects === multi.draft && previous.box === multi.box
      ? previous : { objects: multi.draft, box: multi.box });
    if (multi.draft || restoringMulti) shapeNodes.current.values().next().value?.getLayer()?.batchDraw();
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
  }, [manager, shapes, editing, textMoving, multi]);

  const schedulePaint = () => {
    if (frame.current === null) frame.current = requestAnimationFrame(paintDraft);
  };

  const cancelInteraction = useCallback(() => {
    const pointerId = manager.pointerId ?? shapes.pointerId ?? editing.pointerId ?? textMoving.pointerId ?? multi.pointerId;
    multi.cancel(); selectionTap.current = null;
    textMoving.cancel();
    editing.cancel();
    shapes.cancel();
    manager.cancel();
    const element = containerRef.current;
    if (pointerId !== null && element?.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    paintDraft();
    setInteracting(false);
  }, [manager, shapes, editing, textMoving, multi, paintDraft, setInteracting]);

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
    if (textEditor || !enabled || event.button !== 0 || !event.isPrimary || size.width <= 1 || size.height <= 1) return;
    if (manager.pointerId !== null || shapes.pointerId !== null || editing.pointerId !== null || textMoving.pointerId !== null || multi.pointerId !== null) return;
    if (selectedTool === 'text') {
      if (transparent || !document.pageId) return;
      event.preventDefault();
      const p = point(event); const existing = document.texts?.findLast(t => hitText(t, p));
      openTextEditor(existing ?? { id: crypto.randomUUID(), kind: 'text', text: '', font: 'noto-sans-malayalam', fontSize: 32,
        color: strokeColor, origin: p, size: { width: 1, height: 1 } }, !existing);
      return;
    }
    if (selectedTool === 'select') {
      if (transparent || !document.pageId) return;
      const p = point(event);
      // Visible handles own input before object bodies. Keep the active selection
      // manipulable through overlaps; Escape/Next object allows selection switching.
      const handle = selected && !multiple && !event.shiftKey ? pickHandle(selected, p, scale) : undefined;
      const selectedShapeHit = !multiple && !event.shiftKey && selected && hitShape(selected, p, 12 / scale);
      const textHit = !handle && !selectedShapeHit
        ? selectedText && hitText(selectedText, p) ? selectedText : document.texts?.findLast(t => hitText(t, p))
        : undefined;
      const hit = handle || selectedShapeHit ? selected : textHit ? undefined : pickShape(document.shapes ?? [], p, 12 / scale);
      const target = textHit ?? hit;
      const selectedMember = selectedObjects.findLast(o => o.kind === 'text' ? hitText(o, p) : hitShape(o, p, 12 / scale));
      if (multiple || event.shiftKey || (!target && !selectedMember)) {
        selectionTap.current = { id: target?.id, start: p, additive: multiple || event.shiftKey };
        if (!multi.begin(event.pointerId, p, [], true)) return;
      } else if (selectedObjects.length > 1 && selectedMember) {
        if (!multi.begin(event.pointerId, p, selectedObjects)) return;
      } else {
      selectOne(textHit?.id ?? hit?.id ?? null);
      event.currentTarget.focus({ preventScroll: true });
      event.preventDefault();
      if (textHit) { if (!textMoving.begin(event.pointerId, textHit, p)) return; }
      else if (!hit || !editing.begin(event.pointerId, hit, handle ?? 'move', p)) return;
      }
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
    if (multi.pointerId === event.pointerId) {
      if (event.pointerType === 'mouse' && event.buttons === 0) { cancelInteraction(); return; }
      multi.move(event.pointerId, point(event)); schedulePaint(); return;
    }
    if (textMoving.pointerId === event.pointerId) {
      if (event.pointerType === 'mouse' && event.buttons === 0) { cancelInteraction(); return; }
      textMoving.move(event.pointerId, point(event)); schedulePaint(); return;
    }
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
    if (multi.pointerId === event.pointerId) {
      const p = point(event); const result = multi.complete(event.pointerId, p); const tap = selectionTap.current;
      selectionTap.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null; paintDraft(); setInteracting(false);
      if (result?.box && tap) {
        if (Math.hypot(p.x - tap.start.x, p.y - tap.start.y) * scale < 4) {
          if (tap.id && tap.additive) toggleObject(tap.id); else if (!tap.additive) selectOne(null);
        } else {
          const found = enclosedObjects(editable, result.box).map(o => o.id);
          updateSelection(tap.additive ? [...new Set([...selectedIds, ...found])] : found);
        }
      } else if (result?.objects) batchObjects({ type: 'batch', kind: 'move', ids: result.original.map(o => o.id), objects: result.objects });
      return;
    }
    if (textMoving.pointerId === event.pointerId) {
      const text = textMoving.complete(event.pointerId, point(event));
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null; paintDraft();
      if (text) { const error = saveText(text, false); if (error) setInputError(error); }
      setInteracting(false); return;
    }
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
      if (shape) commitObject(shape);
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

  const interacting = () => manager.pointerId !== null || shapes.pointerId !== null || editing.pointerId !== null || textMoving.pointerId !== null || multi.pointerId !== null || Boolean(textEditor);
  const duplicateSelected = () => {
    if (selectedObjects.length > 1 && !interacting()) {
      const copies = duplicateObjects(selectedObjects);
      batchObjects({ type: 'batch', kind: 'duplicate', ids: selectedObjects.map(o => o.id), objects: copies });
      setRequestedBatch(copies.map(o => o.id)); containerRef.current?.focus({ preventScroll: true }); return;
    }
    const source = selectedText ?? selected;
    if (!source || interacting()) return;
    const copy = duplicateObject(source, crypto.randomUUID());
    commitObject(copy);
    setRequestedCopy(copy.id);
    containerRef.current?.focus({ preventScroll: true });
  };
  const removeSelected = () => {
    if (selectedObjects.length > 1 && !interacting()) {
      batchObjects({ type: 'batch', kind: 'delete', ids: selectedObjects.map(o => o.id) });
      setSelectedIds([]); containerRef.current?.focus({ preventScroll: true }); return;
    }
    if ((!selected && !selectedText) || interacting()) return;
    if (selectedText) deleteText(selectedText.id); else if (selected) deleteShape(selected.id); selectOne(null); containerRef.current?.focus();
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
      data-selected-count={selectedObjects.length} data-selected-ids={selectedObjects.map(o => o.id).join(",")} data-multiple={multiple}
      data-page-id={document.pageId} data-background={document.background}
      data-selected-shape={selected?.id ?? ''} data-selected-text={selectedText?.id ?? ''} data-text-count={document.texts?.length ?? 0} data-text-font-ready={fontReady}
      data-shape-count={document.shapes?.length ?? 0} data-ink-count={document.objects.length} data-revision={document.revision}
      data-input-owner={enabled ? "ink" : "content"}
      className="absolute inset-0 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
      style={{ touchAction: enabled ? "none" : "auto", userSelect: "none", pointerEvents: enabled ? "auto" : "none", background: transparent ? "transparent" : "white" }}
      onPointerDown={begin} onPointerMove={move} onPointerUp={complete}
      onPointerCancel={(event) => { if (manager.pointerId === event.pointerId || shapes.pointerId === event.pointerId || editing.pointerId === event.pointerId || textMoving.pointerId === event.pointerId || multi.pointerId === event.pointerId) cancelInteraction(); }}
      onLostPointerCapture={(event) => { if (manager.pointerId === event.pointerId || shapes.pointerId === event.pointerId || editing.pointerId === event.pointerId || textMoving.pointerId === event.pointerId || multi.pointerId === event.pointerId) cancelInteraction(); }}
      onKeyDown={(event) => {
        if (textEditor) return;
        if (event.key === 'Escape') { event.stopPropagation(); cancelInteraction(); selectOne(null); }
        if (event.target !== event.currentTarget || interacting() || selectedObjects.length === 0) return;
        if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelected(); }
        if (event.key.startsWith('Arrow')) {
          event.preventDefault(); const step = event.shiftKey ? 1 : 10;
          const delta = { x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
            y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0 };
          if (selectedObjects.length > 1) batchObjects({ type: 'batch', kind: 'move', ids: selectedObjects.map(o => o.id), objects: moveObjects(selectedObjects, delta) });
          else if (selectedText) { const error = saveText(moveText(selectedText, delta), false); if (error) setInputError(error); }
          else if (selected) { const next = translateShape(selected, delta); if (next) editShape(next); }
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
        {!transparent && fontReady && <Layer listening={false} scaleX={scale} scaleY={scale}>
          {document.texts?.map(text => <Shape key={text.id} listening={false} sceneFunc={ctx => drawTeachingText(ctx._context, (multiPreview.objects?.find(o => o.id === text.id) as TeachingText | undefined) ?? (textDraft?.id === text.id ? textDraft : text))} />)}
        </Layer>}
      </Stage>
      {(multiPreview.box || selectedObjects.length > 1) && (() => {
        const b = multiPreview.box ?? selectionBounds(multiPreview.objects ?? selectedObjects);
        return <svg className="wb-selection" viewBox="0 0 1200 675" aria-label={multiPreview.box ? 'Selection rectangle' : 'Selected objects outline'}>
          <rect x={b.left} y={b.top} width={b.right - b.left} height={b.bottom - b.top} fill={multiPreview.box ? '#00756815' : 'none'} stroke="#007568" strokeWidth={2 / scale} strokeDasharray={String(6 / scale)} />
        </svg>;
      })()}
      {selectedText && <svg className="wb-selection" viewBox="0 0 1200 675" aria-label="Selected text outline">
        <rect x={(textDraft ?? selectedText).origin.x} y={(textDraft ?? selectedText).origin.y} width={selectedText.size.width} height={selectedText.size.height}
          fill="none" stroke="#007568" strokeWidth={2 / scale} strokeDasharray={String(6 / scale)} />
      </svg>}
      {selected && !multiple && <ShapeSelection key={selected.id} ref={selectionView} shape={selected} scale={scale} onHandleKey={handleKey} />}
      {/* Keep selection local to this page; only its actions render outside the drawable scene. */}
      {!transparent && selectedTool === 'select' && !textEditor && selectionActionsHost && createPortal(<div className="wb-selection-actions" role="group" aria-label="Selected object actions" onPointerDown={event => event.stopPropagation()}>
        <span className="wb-selection-label" aria-live="polite">{selectedObjects.length > 1 ? selectedObjects.length + ' objects selected' : selectedText ? 'Text selected' : selected ? selected.shape + ' selected' : 'Select an object'}</span>
        <button className="workspace-button" aria-label="Select multiple" aria-pressed={multiple} disabled={interacting()} onClick={() => { setMultiple(!multiple); containerRef.current?.focus({ preventScroll: true }); }}>{multiple ? 'Done selecting' : 'Select multiple'}</button>
        <button className="workspace-button" disabled={!document.shapes?.length || interacting()} onClick={() => {
          const list = document.shapes ?? []; const index = list.findIndex(s => s.id === (multiple ? cycle.current.shape : selectedId));
          const id = list[(index + 1) % list.length]?.id; if (id) { cycle.current.shape = id; if (multiple) toggleObject(id); else selectOne(id); } containerRef.current?.focus();
        }}>Next shape</button>
        {Boolean(document.texts?.length) && <button className="workspace-button" disabled={interacting()} onClick={() => {
          const list = document.texts ?? []; const index = list.findIndex(t => t.id === (multiple ? cycle.current.text : selectedId)); const id = list[(index + 1) % list.length]?.id; if (id) { cycle.current.text = id; if (multiple) toggleObject(id); else selectOne(id); } containerRef.current?.focus();
        }}>Next text</button>}
        {selectedText && <button className="workspace-button" disabled={interacting()} onClick={() => openTextEditor(selectedText, false)}>Edit text</button>}
        {selectedObjects.length > 0 && <>
          <button className="workspace-button" disabled={interacting()} onClick={duplicateSelected}>Duplicate</button>
          <button className="workspace-button" disabled={interacting()} onClick={removeSelected}>{selectedObjects.length > 1 ? 'Delete selected' : selectedText ? 'Delete text' : 'Delete shape'}</button>
        </>}
      </div>, selectionActionsHost)}
      {textEditor && selectionActionsHost && createPortal(<TextEditor initial={textEditor.text} onCancel={closeTextEditor} onConfirm={text => {
        const error = saveText(text, textEditor.creating); if (error) return error;
        closeTextEditor(); setSelectedTool('select'); selectOne(text.id);
      }} />, selectionActionsHost)}
      {selectedTool === 'text' && !textEditor && selectionActionsHost && createPortal(<p className="wb-text-hint">Tap the board to add text, or tap existing text to edit.</p>, selectionActionsHost)}
      {inputError && <p role="alert" className="absolute bottom-4 left-4 bg-white p-3 text-red-700">{inputError}</p>}
      {!transparent && whiteboard.error && <div role="alert" className="wb-capacity" onPointerDown={event => event.stopPropagation()}>
        <span>{whiteboard.error}</span><button className="workspace-button" disabled={interacting()} onClick={() => changePage({ type: 'dismiss-error' })}>Dismiss</button>
      </div>}
    </div>
  );
}
