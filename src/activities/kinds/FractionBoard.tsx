import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { canPlaceFraction, FRACTION_PIECE_UNITS, fractionLanes, initialFractionState, placeFractionPiece,
  type FractionConfig, type FractionPlacement, type FractionState } from '../../../contracts/fractions';
import { fractionDropTarget, fractionOrigin, fractionScene as scene } from '../fractionScene';
import type { ActivityProps } from '../registry';
import useDrawing from '../../store/useDrawing';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import './fraction-board.css';

const words = {
  en: { title: 'Parts of the same whole', hint: 'Drag a piece, or tap a piece and a space. What is the same?',
    top: 'Whole A', bottom: 'Whole B', tray: 'Your pieces', labels: 'Fractions', guides: 'Guides', more: 'More', back: 'Return to tray',
    half: 'Half', quarter: 'Quarter', valid: 'Piece placed.', invalid: 'That space does not fit. Try an empty space.', returned: 'Piece returned to the tray.',
    selected: 'Piece selected. Choose a space, or use arrows and Enter.', reset: 'Reset arrangement', prompt: 'Return all six pieces to the tray?',
    confirm: 'Reset', cancel: 'Keep arrangement', close: 'Close', keyboard: 'Keyboard: Enter to select; arrows to choose a space; Enter to place; Escape to cancel.' },
  ml: { title: 'ഒരേ മുഴുവന്റെ ഭാഗങ്ങൾ', hint: 'ഒരു ഭാഗം വലിച്ചിടൂ, അല്ലെങ്കിൽ ഭാഗവും ഒഴിഞ്ഞ ഇടവും തൊടൂ.',
    top: 'മുഴുവൻ A', bottom: 'മുഴുവൻ B', tray: 'നിങ്ങളുടെ ഭാഗങ്ങൾ', labels: 'ഭിന്നസംഖ്യകൾ', guides: 'വരകൾ', more: 'കൂടുതൽ', back: 'തിരികെ വയ്ക്കുക',
    half: 'പകുതി', quarter: 'കാൽഭാഗം', valid: 'ഭാഗം വച്ചു.', invalid: 'ഇവിടെ ചേരില്ല. ഒഴിഞ്ഞ ഇടം നോക്കൂ.', returned: 'ഭാഗം തിരികെ വച്ചു.',
    selected: 'ഭാഗം തിരഞ്ഞെടുത്തു. ഒരു സ്ഥാനം തിരഞ്ഞെടുക്കൂ.', reset: 'വീണ്ടും ക്രമീകരിക്കാം', prompt: 'ആറ് ഭാഗങ്ങളും തിരികെ വയ്ക്കണോ?',
    confirm: 'തിരികെ വയ്ക്കാം', cancel: 'ക്രമം നിലനിർത്താം', close: 'അടയ്ക്കുക', keyboard: 'കീബോർഡ്: Enter തിരഞ്ഞെടുക്കാൻ; അമ്പടയാളങ്ങൾ സ്ഥാനം മാറ്റാൻ; Enter വയ്ക്കാൻ; Escape റദ്ദാക്കാൻ.' },
};
type Gesture = { id: string; index: number; pointer: number; target: SVGGElement; rect: DOMRect; initial: FractionState;
  startX: number; startY: number; dx: number; dy: number; moved: boolean; commit: (state: FractionState) => void };
type Draft = { id: string; x: number; y: number; target: FractionPlacement | null | undefined };

function FractionScene({ config, state, onChange, enabled, controlsHost }: {
  config: FractionConfig; state: FractionState; onChange: (value: FractionState) => void; enabled: boolean; controlsHost?: HTMLDivElement | null;
}) {
  const { setInteracting } = useDrawing();
  const svg = useRef<SVGSVGElement>(null), gesture = useRef<Gesture | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null), [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<'valid' | 'invalid' | 'returned' | 'selected' | null>(null), [menu, setMenu] = useState(false), [confirm, setConfirm] = useState(false);
  const menuRoot = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const w = words[state.language];
  function cancel() {
    const g = gesture.current; gesture.current = null;
    if (g?.target.hasPointerCapture(g.pointer)) g.target.releasePointerCapture(g.pointer);
    setDraft(null); setSelected(null); setInteracting(false);
  }
  useEffect(() => {
    const abort = () => {
      const g = gesture.current; gesture.current = null;
      if (g?.target.hasPointerCapture(g.pointer)) g.target.releasePointerCapture(g.pointer);
      setDraft(null); setSelected(null); setInteracting(false);
    };
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      abort(); setMenu(false);
    };
    const observer = new ResizeObserver(() => {
      const g = gesture.current;
      if (g && Math.abs(svg.current!.getBoundingClientRect().width - g.rect.width) > .1) abort();
    });
    if (svg.current) observer.observe(svg.current);
    window.addEventListener('keydown', key); window.addEventListener('blur', abort); window.addEventListener('resize', abort);
    document.addEventListener('visibilitychange', abort);
    return () => { abort(); observer.disconnect(); window.removeEventListener('keydown', key); window.removeEventListener('blur', abort);
      window.removeEventListener('resize', abort); document.removeEventListener('visibilitychange', abort); };
  }, [setInteracting]);
  useEffect(() => {
    if (!menu) return;
    const outside = (e: globalThis.PointerEvent) => { if (!menuRoot.current?.contains(e.target as Node) && !document.querySelector('dialog[open]')) setMenu(false); };
    const escape = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) trigger.current?.focus(); };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [menu]);
  function change(next: FractionState) { if (enabled && !gesture.current && next !== state) onChange(next); }
  function place(target: FractionPlacement | null) {
    if (!enabled || !selected || gesture.current || menu) return;
    if (!canPlaceFraction(config, state, selected, target)) { setMessage('invalid'); return; }
    change(placeFractionPiece(config, state, selected, target)); setMessage(target ? 'valid' : 'returned');
  }
  function choose(id: string) {
    if (!enabled || gesture.current || menu) return;
    setSelected(id); setMessage('selected');
  }
  function targetKey(e: KeyboardEvent<SVGGElement>) {
    if (!enabled || !selected || gesture.current || menu || !e.key.startsWith('Arrow')) return;
    e.preventDefault();
    const targets = Array.from(svg.current?.querySelectorAll<SVGGElement>('[data-fraction-target]') ?? []);
    const index = targets.indexOf(e.currentTarget);
    const offset = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowUp' ? -4 : e.key === 'ArrowDown' ? 4 : 1;
    targets[index < 0 ? 0 : (index + offset + 8) % 8]?.focus();
  }
  function start(e: PointerEvent<SVGGElement>, index: number) {
    if (!enabled || menu || gesture.current || !e.isPrimary || e.button !== 0) return;
    e.preventDefault(); e.currentTarget.focus();
    const piece = state.pieces[index]!, origin = fractionOrigin(index, piece.placement), rect = svg.current!.getBoundingClientRect();
    gesture.current = { id: piece.id, index, pointer: e.pointerId, target: e.currentTarget, rect, initial: state,
      startX: e.clientX, startY: e.clientY, dx: (e.clientX - rect.left) * 1200 / rect.width - origin.x,
      dy: (e.clientY - rect.top) * 675 / rect.height - origin.y, moved: false, commit: onChange };
    setSelected(piece.id); setDraft({ id: piece.id, ...origin, target: piece.placement }); setInteracting(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function position(e: PointerEvent<SVGGElement>, g: Gesture): Draft {
    const x = (e.clientX - g.rect.left) * 1200 / g.rect.width - g.dx, y = (e.clientY - g.rect.top) * 675 / g.rect.height - g.dy;
    return { id: g.id, x, y, target: fractionDropTarget(g.index, x, y) };
  }
  function move(e: PointerEvent<SVGGElement>) {
    const g = gesture.current; if (!g || g.pointer !== e.pointerId) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) { cancel(); return; }
    if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > 5) g.moved = true;
    if (g.moved) setDraft(position(e, g));
  }
  function end(e: PointerEvent<SVGGElement>) {
    const g = gesture.current; if (!g || g.pointer !== e.pointerId) return;
    const moved = g.moved || Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > 5, p = position(e, g);
    gesture.current = null;
    if (g.target.hasPointerCapture(g.pointer)) g.target.releasePointerCapture(g.pointer);
    setDraft(null); setInteracting(false);
    if (!moved) { setMessage('selected'); return; }
    if (p.target === undefined || !canPlaceFraction(config, g.initial, g.id, p.target)) { setMessage('invalid'); return; }
    const next = placeFractionPiece(config, g.initial, g.id, p.target);
    if (next !== g.initial) g.commit(next);
    setMessage(p.target ? 'valid' : 'returned');
  }
  const validDraft = draft && draft.target !== undefined && canPlaceFraction(config, state, draft.id, draft.target);
  const selectedPiece = state.pieces.find(p => p.id === selected);
  const controls = <div className="fraction-controls" ref={menuRoot} lang={state.language}>
    <button className="workspace-button" aria-label="Fraction labels" aria-pressed={state.showLabels} disabled={!!draft} onClick={() => change({ ...state, showLabels: !state.showLabels })}>{w.labels}</button>
    <button className="workspace-button" aria-label="Alignment guides" aria-pressed={state.showGuides} disabled={!!draft} onClick={() => change({ ...state, showGuides: !state.showGuides })}>{w.guides}</button>
    {selectedPiece?.placement && <button className="workspace-button" aria-label="Return selected piece to tray" disabled={!!draft || menu} onClick={() => place(null)}>{w.back}</button>}
    <button ref={trigger} className="workspace-button" aria-label="More fraction controls" aria-expanded={menu} disabled={!!draft} onClick={() => setMenu(!menu)}>{w.more} ···</button>
    {menu && <div className="fraction-settings" role="group" aria-label="Fraction settings">
      <button className="workspace-button fraction-close" aria-label="Close fraction settings" onClick={() => { setMenu(false); trigger.current?.focus(); }}>{w.close} ×</button>
      <button className="workspace-button" aria-label="Change fraction language" onClick={() => change({ ...state, language: state.language === 'en' ? 'ml' : 'en' })}>English / മലയാളം</button>
      <button className="workspace-button" aria-label="Reset arrangement" disabled={!state.pieces.some(p => p.placement)} onClick={() => setConfirm(true)}>{w.reset}</button>
    </div>}
    <ConfirmDialog open={confirm} title={w.reset} message={w.prompt} confirmText={w.confirm} cancelText={w.cancel}
      onCancel={() => setConfirm(false)} onConfirm={() => { change({ ...initialFractionState(config), language: state.language, showLabels: state.showLabels, showGuides: state.showGuides }); setSelected(null); setConfirm(false); setMenu(false); trigger.current?.focus(); }} />
  </div>;
  return <section className="fraction-scene" lang={state.language} aria-label="Interactive Fractions">
    <svg ref={svg} viewBox="0 0 1200 675" className="fraction-canvas" aria-label="Fraction comparison board">
      <rect width="1200" height="675" rx="22" fill="#fcfaf2" />
      <text x="38" y="47" className="fraction-title">{w.title}</text>
      <text x="38" y="85" className="fraction-hint">{w.hint}</text>
      {fractionLanes.map(lane => <g key={lane}>
        <text x="38" y={scene.lanes[lane] + 60} className="fraction-lane-name">{w[lane]}</text>
        <rect data-testid={`fraction-lane-${lane}`} x={scene.x} y={scene.lanes[lane]} width={scene.width} height={scene.height} fill="#f0efe4" stroke="#698477" strokeWidth="3" />
        {[0, 1, 2, 3].map(start => {
          const target = { lane, start }, valid = !!selected && canPlaceFraction(config, state, selected, target);
          return <g key={start} data-fraction-target={`${lane}-${start}`} data-testid={`fraction-target-${lane}-${start}`} role="button"
            aria-label={`Place in ${lane} lane at quarter ${start + 1}`} aria-disabled={!enabled || !valid} tabIndex={enabled && selected && !menu ? 0 : -1}
            className={`fraction-target${selected && valid ? ' available' : ''}`} onClick={() => place(target)}
            onKeyDown={e => { targetKey(e); if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); place(target); } }}>
            <rect x={scene.x + start * scene.unit} y={scene.lanes[lane]} width={scene.unit} height={scene.height} />
          </g>;
        })}
      </g>)}
      <path d="M38 385 H1162" stroke="#dedfcf" strokeWidth="2" />
      <text x="38" y="411" className="fraction-tray-title">{w.tray}</text>
      {state.pieces.map((piece, index) => {
        const p = fractionOrigin(index, piece.placement), width = FRACTION_PIECE_UNITS[index]! * scene.unit;
        return !piece.placement && <rect key={piece.id} x={p.x} y={p.y} width={width} height={scene.height} rx="8" className="fraction-home" />;
      })}
      {validDraft && draft.target && <rect data-testid="fraction-snap-preview" x={scene.x + draft.target.start * scene.unit} y={scene.lanes[draft.target.lane]}
        width={FRACTION_PIECE_UNITS[state.pieces.findIndex(p => p.id === draft.id)]! * scene.unit} height={scene.height} className="fraction-snap" />}
      {state.pieces.map((piece, index) => {
        const p = draft?.id === piece.id ? draft : fractionOrigin(index, piece.placement), width = FRACTION_PIECE_UNITS[index]! * scene.unit;
        return <g key={piece.id} data-testid={`fraction-piece-${index + 1}`} data-piece-id={piece.id} data-lane={piece.placement?.lane ?? 'tray'} data-start={piece.placement?.start ?? ''}
          transform={`translate(${p.x} ${p.y})`} role="button" aria-label={`${index < 2 ? w.half : w.quarter} ${index + 1}`} aria-pressed={selected === piece.id}
          aria-describedby="fraction-keyboard-help" tabIndex={enabled && !menu ? 0 : -1}
          className={`fraction-piece ${index < 2 ? 'half' : 'quarter'}${selected === piece.id ? ' selected' : ''}${draft?.id === piece.id ? validDraft ? ' valid' : ' invalid' : ''}`}
          onPointerDown={e => start(e, index)} onPointerMove={move} onPointerUp={end}
          onPointerCancel={e => { if (gesture.current?.pointer === e.pointerId) cancel(); }} onLostPointerCapture={e => { if (gesture.current?.pointer === e.pointerId) cancel(); }}
          onKeyDown={e => { targetKey(e); if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(piece.id); } }}>
          <rect className="fraction-piece-body" width={width} height={scene.height} rx="8" />
          <path d={`M18 17 H${width - 18}`} stroke="#ffffff75" strokeWidth="4" strokeLinecap="round" pointerEvents="none" />
          {state.showLabels && <text x={width / 2} y="65" textAnchor="middle" className="fraction-number" pointerEvents="none">{index < 2 ? '1/2' : '1/4'}</text>}
        </g>;
      })}
      {state.showGuides && <g className="fraction-guides" pointerEvents="none" data-testid="fraction-guides">
        {fractionLanes.flatMap(lane => [1, 2, 3].map(n => <path key={`${lane}-${n}`} d={`M${scene.x + n * scene.unit} ${scene.lanes[lane]} v${scene.height}`} />))}
      </g>}
    </svg>
    <span id="fraction-keyboard-help" className="sr-only">{w.keyboard}</span>
    <span className="fraction-review">Original Demo Concept — Preview / Teacher Review Pending</span>
    <span className="fraction-announcement" role="status" aria-live="polite">{message ? w[message] : ''}</span>
    {enabled && controlsHost && createPortal(controls, controlsHost)}
  </section>;
}
export default function FractionBoard({ activity, state, onChange, enabled = true, controlsHost }: ActivityProps) {
  return activity.kind === 'fraction-board' && state.kind === 'fraction-board'
    ? <FractionScene key={enabled ? 'interactive' : 'view'} config={activity.config} state={state} onChange={onChange} enabled={enabled} controlsHost={controlsHost} /> : null;
}
