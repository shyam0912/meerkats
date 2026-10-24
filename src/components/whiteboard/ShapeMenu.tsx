import { useEffect, useRef, useState } from 'react';
import useDrawing from '../../store/useDrawing';
import type { TeachingShapeType } from '../../../contracts';

const choices: { type: TeachingShapeType; label: string; path: string }[] = [
  { type: 'line', label: 'Line', path: 'M6 30L34 10' },
  { type: 'arrow', label: 'Arrow', path: 'M6 30L34 10M20 10H34V24' },
  { type: 'rectangle', label: 'Rectangle', path: 'M5 10H35V30H5Z' },
  { type: 'circle', label: 'Circle', path: 'M6 20A14 14 0 1 0 34 20A14 14 0 1 0 6 20' },
  { type: 'triangle', label: 'Triangle', path: 'M20 6L36 33H4Z' },
];
export default function ShapeMenu() {
  const { selectedTool, setSelectedTool, shapeType, setShapeType, shapeColor, setShapeColor, shapeWidth, setShapeWidth, isInteracting } = useDrawing();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null); const trigger = useRef<HTMLButtonElement>(null); const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current; const returnTo = trigger.current;
    element?.showModal(); close.current?.focus();
    return () => { element?.close(); if (returnTo?.isConnected) returnTo.focus(); };
  }, [open]);
  return <>
    <button ref={trigger} className="workspace-button wb-shapes-trigger" aria-label="Shapes" aria-haspopup="dialog" aria-pressed={selectedTool === 'shape'}
      disabled={isInteracting} onClick={() => setOpen(true)}>Shapes{selectedTool === 'shape' && <small>{choices.find(c => c.type === shapeType)?.label}</small>}</button>
    <dialog ref={dialog} className="wb-shape-tray" aria-labelledby="shapes-title" onCancel={event => { event.preventDefault(); setOpen(false); }}>
      <div className="wb-dialog-heading"><h2 id="shapes-title">Shapes</h2><button ref={close} className="workspace-button" onClick={() => setOpen(false)}>Close shapes</button></div>
      <div className="wb-shape-choices" role="group" aria-label="Shape type">{choices.map(choice => <button key={choice.type} className="workspace-button"
        aria-pressed={selectedTool === 'shape' && shapeType === choice.type} onClick={() => { setShapeType(choice.type); setSelectedTool('shape'); }}>
        <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><path d={choice.path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>{choice.label}</button>)}</div>
      <div className="wb-shape-style"><label>Shape colour<input type="color" value={shapeColor} onChange={e => setShapeColor(e.target.value)} /></label>
        <fieldset><legend>Shape width</legend><div className="wb-presets">{[2, 4, 8].map((width, i) => <button key={width} className="workspace-button" aria-pressed={shapeWidth === width}
          onClick={() => setShapeWidth(width)}>{['Fine', 'Medium', 'Broad'][i]}</button>)}</div></fieldset></div>
      <p>Choose a shape, close this tray, then drag on the board. Circles stay round; triangles are isosceles. Escape cancels a drag.</p>
      <p>Shapes stay separate from ink. Undo removes a new shape; the ink eraser and Clear ink leave shapes intact.</p>
    </dialog>
  </>;
}
