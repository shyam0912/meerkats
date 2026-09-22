import { useEffect, useRef, useState } from "react";
import useDrawing from "../../store/useDrawing";
import ConfirmDialog from "../common/ConfirmDialog";

export default function DrawingToolbar() {
  const { document, selectedTool, setSelectedTool, strokeColor, setStrokeColor, strokeWidth, setStrokeWidth,
    isInteracting, canUndo, canRedo, undo, redo, clearCanvas } = useDrawing();
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
    <button className="workspace-button ink-settings" ref={optionsTrigger} aria-label="Ink settings"
      aria-haspopup="dialog" disabled={isInteracting} onClick={() => setOptionsOpen(true)}>
      <span className="ink-swatch" style={{ background: strokeColor }} />
      <span>Ink settings<small>{selectedTool === "eraser" ? strokeWidth * 6 : strokeWidth} units · {selectedTool}</small></span>
    </button>
    <button className="workspace-button" onClick={undo} disabled={!canUndo || isInteracting}>Undo</button>
    <button className="workspace-button" onClick={redo} disabled={!canRedo || isInteracting}>Redo</button>
    <button className="workspace-button clear-button" aria-label="Clear ink"
      disabled={!document.objects.length || isInteracting} onClick={() => setConfirmClear(true)}>Clear</button>
    <dialog ref={options} aria-labelledby="ink-settings-title" className="ink-dialog"
      onCancel={(event) => { event.preventDefault(); setOptionsOpen(false); }}>
      <div className="ink-dialog-heading"><h2 id="ink-settings-title">Ink settings</h2>
        <button ref={optionsClose} className="workspace-button" aria-label="Close drawing options" onClick={() => setOptionsOpen(false)}>Close</button></div>
      <label htmlFor="ink-color">Pen color</label>
      <input id="ink-color" type="color" value={strokeColor} onChange={(event) => setStrokeColor(event.target.value)} />
      <label htmlFor="ink-width">Stroke width</label>
      <input id="ink-width" type="range" min="1" max="20" value={strokeWidth} onChange={(event) => setStrokeWidth(Number(event.target.value))} />
      <output htmlFor="ink-width">{strokeWidth} units pen / {strokeWidth * 6} units eraser</output>
      <p>Ink scales with the scene. The eraser removes ink only.</p>
    </dialog>
    <ConfirmDialog open={confirmClear} title={document.owner.target?.kind === "annotation" ? "Clear these annotations?" : "Clear this board?"}
      message="Only ink on this surface will be cleared. You can restore it with Undo."
      confirmText="Clear ink" onCancel={() => setConfirmClear(false)}
      onConfirm={() => { clearCanvas(); setConfirmClear(false); }} />
  </div>;
}
