import { useEffect, useRef, useState } from "react";
import useDrawing from "../../store/useDrawing";
import ConfirmDialog from "../common/ConfirmDialog";
import ShapeMenu from '../whiteboard/ShapeMenu';

export default function DrawingToolbar({ pro = false }: { pro?: boolean }) {
  const { document, selectedTool, setSelectedTool, strokeColor, setStrokeColor, strokeWidth, setStrokeWidth,
    eraserWidth, setEraserWidth, isInteracting, canUndo, canRedo, undo, redo, clearCanvas } = useDrawing();
  const [confirmClear, setConfirmClear] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const options = useRef<HTMLDialogElement>(null);
  const optionsTrigger = useRef<HTMLButtonElement>(null);
  const optionsClose = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!optionsOpen) return;
    const dialog = options.current;
    const trigger = optionsTrigger.current;
    dialog?.showModal();
    optionsClose.current?.focus();
    return () => { dialog?.close(); if (trigger?.isConnected) trigger.focus(); };
  }, [optionsOpen]);
  return <div className="drawing-toolbar" role="group" aria-label="Drawing tools">
    <button className="workspace-button" aria-pressed={selectedTool === "pen"} disabled={isInteracting}
      onClick={() => setSelectedTool("pen")}>Pen</button>
    <button className="workspace-button" aria-pressed={selectedTool === "eraser"} disabled={isInteracting}
      onClick={() => setSelectedTool("eraser")}>Eraser</button>
    {pro && <ShapeMenu />}
    <button className="workspace-button ink-settings" ref={optionsTrigger} aria-label="Ink settings"
      aria-haspopup="dialog" disabled={isInteracting} onClick={() => setOptionsOpen(true)}>
      <span className="ink-swatch" style={{ background: strokeColor }} />
      <span>Ink settings<small>{selectedTool === "eraser" ? eraserWidth : strokeWidth} units · {selectedTool === 'shape' ? 'pen' : selectedTool}</small></span>
    </button>
    <button className="workspace-button" onClick={undo} disabled={!canUndo || isInteracting}>Undo</button>
    <button className="workspace-button" onClick={redo} disabled={!canRedo || isInteracting}>Redo</button>
    <button className="workspace-button clear-button" aria-label="Clear ink"
      disabled={!document.objects.length || isInteracting} onClick={() => setConfirmClear(true)}>Clear</button>
    <dialog ref={options} aria-labelledby="ink-settings-title" className={`ink-dialog${pro ? ' wb-ink-tray' : ''}`}
      onCancel={(event) => { event.preventDefault(); setOptionsOpen(false); }}>
      <div className="ink-dialog-heading"><h2 id="ink-settings-title">Ink settings</h2>
        <button ref={optionsClose} className="workspace-button" aria-label="Close drawing options" onClick={() => setOptionsOpen(false)}>Close</button></div>
      <label htmlFor="ink-color">Pen color</label>
      <input id="ink-color" type="color" value={strokeColor} onChange={(event) => setStrokeColor(event.target.value)} />
      {pro && <div className="wb-presets" role="group" aria-label="Pen colour presets">{[
        ['Black', '#000000'], ['Teal', '#214f45'], ['Blue', '#225eaf'], ['Red', '#b63737'], ['Purple', '#77408c'],
      ].map(([name, color]) => <button key={name} className="workspace-button wb-colour" aria-label={name + ' ink'} aria-pressed={strokeColor === color}
        onClick={() => setStrokeColor(color!)}><span style={{ background: color }} /></button>)}</div>}
      <label htmlFor="ink-width">{selectedTool !== 'eraser' ? 'Stroke width' : 'Eraser size'}</label>
      <input id="ink-width" type="range" min={selectedTool !== 'eraser' ? 1 : 6} max={selectedTool !== 'eraser' ? 20 : 120}
        value={selectedTool !== 'eraser' ? strokeWidth : eraserWidth}
        onChange={(event) => (selectedTool !== 'eraser' ? setStrokeWidth : setEraserWidth)(Number(event.target.value))} />
      {pro && <div className="wb-presets" role="group" aria-label={selectedTool !== 'eraser' ? 'Pen sizes' : 'Eraser sizes'}>
        {(selectedTool !== 'eraser' ? [3, 7, 15] : [18, 48, 96]).map((width, i) => <button key={width} className="workspace-button"
          aria-pressed={(selectedTool !== 'eraser' ? strokeWidth : eraserWidth) === width}
          onClick={() => (selectedTool !== 'eraser' ? setStrokeWidth : setEraserWidth)(width)}>{['Fine', 'Medium', 'Broad'][i]}</button>)}
      </div>}
      <p>{strokeWidth} units pen · {eraserWidth} units eraser. Sizes are independent and scale with the board.</p>
      <p>The eraser removes ink only.</p>
    </dialog>
    <ConfirmDialog open={confirmClear} title={document.owner.target?.kind === "annotation" ? "Clear these annotations?" : document.pageId ? "Clear this page?" : "Clear this board?"}
      message="Only ink on this surface will be cleared. Undo can restore it until you reload or leave this session."
      confirmText="Clear ink" onCancel={() => setConfirmClear(false)}
      onConfirm={() => { clearCanvas(); setConfirmClear(false); }} />
  </div>;
}
