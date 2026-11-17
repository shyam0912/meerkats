import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { arrangeCounters, placeCounter, type CountingConfig, type CountingState } from '../../../contracts/counting';
import type { ActivityProps } from '../registry';
import useDrawing from '../../store/useDrawing';
import './counting-board.css';

const words = {
  en: { title: 'Same number. A new arrangement.', prompt: 'Move them around. Is the number still the same?', quantity: 'Quantity', show: 'Show count', hide: 'Hide count',
    help: 'Count together', next: 'Next counter', again: 'Count again', stop: 'Finish counting', reset: 'Reset arrangement', more: 'More', cancel: 'Cancel placement',
    hint: 'Drag a counter, or tap one and then an empty space.', total: 'counters', counted: 'counted', preview: 'Original Demo Concept — Preview / Teacher Review Pending' },
  ml: { title: 'എണ്ണം അതേ. ക്രമം വേറെ.', prompt: 'സ്ഥാനം മാറ്റിയാൽ എണ്ണം മാറുമോ?', quantity: 'എണ്ണം', show: 'എണ്ണം കാണിക്കുക', hide: 'എണ്ണം മറയ്ക്കുക',
    help: 'ഒരുമിച്ച് എണ്ണാം', next: 'അടുത്തത്', again: 'വീണ്ടും എണ്ണാം', stop: 'എണ്ണൽ നിർത്തുക', reset: 'ആദ്യ ക്രമത്തിലേക്ക്', more: 'കൂടുതൽ', cancel: 'റദ്ദാക്കുക',
    hint: 'വലിച്ചു നീക്കുക, അല്ലെങ്കിൽ ഒരു വട്ടവും ഒഴിഞ്ഞ സ്ഥലവും തൊടുക.', total: 'വട്ടങ്ങൾ', counted: 'എണ്ണി', preview: 'Original Demo Concept — Preview / Teacher Review Pending' },
};
const colors = ['#bc633a', '#3b8176', '#a57c23', '#7564a4', '#427997', '#b0607f', '#68843c', '#b76b30', '#4e8989', '#836b53'];
type Gesture = { id: string; pointer: number | null; target: SVGGElement; initial: CountingState; live: CountingState;
  rect: DOMRect; offsetX: number; offsetY: number; startX: number; startY: number; moved: boolean; commit: (value: CountingState) => void };

function CountingScene({ config, state, onChange, enabled, controlsHost }: {
  config: CountingConfig; state: CountingState; onChange: (value: CountingState) => void; enabled: boolean; controlsHost?: HTMLDivElement | null;
}) {
  const { setInteracting } = useDrawing();
  const svg = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [draft, setDraft] = useState<CountingState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [menu, setMenu] = useState<'quantity' | 'more' | null>(null);
  const menuTrigger = useRef<HTMLButtonElement | null>(null);
  const menuRoot = useRef<HTMLDivElement>(null);
  const [blocked, setBlocked] = useState(false);
  const live = draft ?? state, w = words[state.language];
  function finish(commit: boolean) {
    const active = gesture.current; gesture.current = null;
    if (active) {
      if (commit && active.live !== active.initial) active.commit(active.live);
      if (active.pointer !== null && active.target.hasPointerCapture(active.pointer)) active.target.releasePointerCapture(active.pointer);
    }
    setDraft(null); setBlocked(false); setInteracting(false);
  }
  function cancel() { finish(false); setSelected(null); }
  useEffect(() => {
    const abort = () => { const active = gesture.current; if (active) {
      gesture.current = null;
      if (active.pointer !== null && active.target.hasPointerCapture(active.pointer)) active.target.releasePointerCapture(active.pointer);
      setDraft(null); setSelected(null); setBlocked(false); setInteracting(false);
    } };
    const key = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') { abort(); setSelected(null); setMenu(null); } };
    window.addEventListener('keydown', key); window.addEventListener('blur', abort); window.addEventListener('resize', abort);
    document.addEventListener('visibilitychange', abort);
    return () => { abort(); window.removeEventListener('keydown', key); window.removeEventListener('blur', abort);
      window.removeEventListener('resize', abort); document.removeEventListener('visibilitychange', abort); };
  }, [setInteracting]);
  useEffect(() => {
    // Observe scene resizing (including Focus) as well as window resizing.
    const element = svg.current; if (!element) return;
    const observer = new ResizeObserver(() => {
      const active = gesture.current;
      if (active && Math.abs(element.getBoundingClientRect().width - active.rect.width) > .1) {
        gesture.current = null; setDraft(null); setSelected(null); setInteracting(false);
        if (active.pointer !== null && active.target.hasPointerCapture(active.pointer)) active.target.releasePointerCapture(active.pointer);
      }
    }); observer.observe(element); return () => observer.disconnect();
  }, [setInteracting]);
  useEffect(() => {
    if (!menu) return;
    const outside = (event: globalThis.PointerEvent) => { if (!menuRoot.current?.contains(event.target as Node)) setMenu(null); };
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') { setMenu(null); menuTrigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [menu]);
  // Input ownership changes unmount this interactive instance; the parent keeps the saved scene visible.
  function start(target: SVGGElement, id: string, pointer: number | null, clientX = 0, clientY = 0) {
    if (!enabled || gesture.current || menu) return;
    const counter = state.counters.find(c => c.id === id)!; const rect = svg.current!.getBoundingClientRect();
    gesture.current = { id, pointer, target, initial: state, live: state, rect, offsetX: (clientX - rect.left) * 1200 / rect.width - counter.x,
      offsetY: (clientY - rect.top) * 675 / rect.height - counter.y, startX: clientX, startY: clientY, moved: false, commit: onChange };
    setSelected(id); setInteracting(true); if (pointer !== null) target.setPointerCapture(pointer);
  }
  function move(event: PointerEvent<SVGGElement>) {
    const active = gesture.current; if (!active || active.pointer !== event.pointerId) return;
    if (!enabled || Math.abs(svg.current!.getBoundingClientRect().width - active.rect.width) > .1 || (event.type !== 'pointerup' && event.pointerType === 'mouse' && event.buttons === 0)) { cancel(); return; }
    if (Math.hypot(event.clientX - active.startX, event.clientY - active.startY) > 5) active.moved = true;
    if (!active.moved) return;
    const x = (event.clientX - active.rect.left) * 1200 / active.rect.width - active.offsetX;
    const y = (event.clientY - active.rect.top) * 675 / active.rect.height - active.offsetY;
    const next = placeCounter(active.live, active.id, x, y);
    setBlocked(next === active.live); active.live = next; setDraft(next);
  }
  function key(event: KeyboardEvent<SVGGElement>, id: string) {
    if (!enabled || menu) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); if (gesture.current?.pointer === null) { finish(true); setSelected(null); } else if (!gesture.current) start(event.currentTarget, id, null);
    } else if (event.key.startsWith('Arrow') && gesture.current?.pointer === null && gesture.current.id === id) {
      event.preventDefault(); const active = gesture.current, counter = active.live.counters.find(c => c.id === id)!;
      const step = event.shiftKey ? 40 : 12;
      active.live = placeCounter(active.live, id, counter.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
        counter.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0)); setDraft(active.live);
    } else if (event.key === 'Tab' && gesture.current) finish(false);
  }
  function change(next: CountingState) { cancel(); onChange(next); }
  const controls = <div className="counting-controls" ref={menuRoot}>
    <button className="workspace-button" aria-label="Quantity" aria-expanded={menu === 'quantity'} disabled={Boolean(draft)} onClick={event => {
      menuTrigger.current = event.currentTarget; setMenu(menu === 'quantity' ? null : 'quantity');
    }}>{w.quantity} <strong>{state.quantity}</strong></button>
    <button className="workspace-button" aria-label="Show count" aria-pressed={state.showCount} disabled={Boolean(draft)} onClick={() => change({ ...state, showCount: !state.showCount })}>{state.showCount ? w.hide : w.show}</button>
    <button className="workspace-button" aria-label="More counting controls" aria-expanded={menu === 'more'} disabled={Boolean(draft)} onClick={event => {
      menuTrigger.current = event.currentTarget; setMenu(menu === 'more' ? null : 'more');
    }}>{w.more} ···</button>
    {selected && <button className="workspace-button" onClick={cancel} aria-label="Cancel placement">×</button>}
    {menu && <div className="counting-tray" role="group" aria-label={menu === 'quantity' ? 'Choose quantity' : 'Counting settings'}>
      <button className="counting-close workspace-button" aria-label="Close counting settings" onClick={() => { setMenu(null); menuTrigger.current?.focus(); }}>×</button>
      {menu === 'quantity' ? <><p>Choose how many · starts a new arrangement</p><div className="counting-quantities">{Array.from({ length: 10 }, (_, i) => i + 1).map(n => <button key={n} className="workspace-button" aria-label={`Use ${n} counters`} aria-pressed={state.quantity === n}
        onClick={() => { if (n !== state.quantity) change({ ...state, quantity: n, counters: arrangeCounters(config, n), counted: 0 }); setMenu(null); menuTrigger.current?.focus(); }}>{n}</button>)}</div></> : <>
        <button className="workspace-button" aria-label="Count together" aria-pressed={state.countingHelp} onClick={() => change({ ...state, countingHelp: !state.countingHelp, counted: 0 })}>{state.countingHelp ? w.stop : w.help}</button>
        <button className="workspace-button" aria-label="Reset arrangement" onClick={() => { change({ ...state, counters: arrangeCounters(config, state.quantity), counted: 0 }); setMenu(null); menuTrigger.current?.focus(); }}>{w.reset}</button>
        <button className="workspace-button" aria-label="Change label language" onClick={() => change({ ...state, language: state.language === 'en' ? 'ml' : 'en' })}>English / മലയാളം</button>
      </>}
    </div>}
    {state.countingHelp && <button className="workspace-button counting-next" aria-label={state.counted === state.quantity ? 'Count again' : 'Next counter'} disabled={Boolean(draft)}
      onClick={() => change({ ...state, counted: state.counted === state.quantity ? 0 : state.counted + 1 })}>{state.counted === state.quantity ? w.again : w.next} <span>{state.counted}/{state.quantity}</span></button>}
  </div>;
  return <section className="counting-scene" aria-label="Same Number, Different Arrangements" lang={state.language}>
    <svg ref={svg} viewBox="0 0 1200 675" className="counting-canvas" aria-label="Counter arrangement" onClick={event => {
      if (!enabled || !selected || gesture.current || menu || (event.target as Element).closest('[data-counter-id]')) return;
      const rect = event.currentTarget.getBoundingClientRect(); const next = placeCounter(state, selected, (event.clientX - rect.left) * 1200 / rect.width, (event.clientY - rect.top) * 675 / rect.height);
      if (next !== state) { change(next); setSelected(null); }
    }}>
      <rect width="1200" height="675" rx="22" fill="#fcfbf4" />
      <path d="M32 112H1168" stroke="#e5e6d8" strokeWidth="2" />
      <text x="40" y="51" className="counting-title">{w.title}</text>
      <text x="40" y="89" className="counting-prompt">{w.prompt}</text>
      {state.showCount && <g aria-label={`${state.quantity} counters`} data-testid="counting-total"><rect x="1030" y="16" width="132" height="82" rx="22" fill="#e4eddb" /><text x="1096" y="75" textAnchor="middle" className="counting-total">{state.quantity}</text></g>}
      {live.counters.map((counter, index) => <g key={counter.id} data-counter-id={counter.id} data-x={counter.x} data-y={counter.y} data-testid={`counter-${index + 1}`}
        transform={`translate(${counter.x} ${counter.y})`} role="button" aria-describedby="counting-keyboard-help" tabIndex={enabled ? 0 : -1} aria-label={`Counter ${index + 1}`} aria-pressed={selected === counter.id}
        className={`counting-counter${selected === counter.id ? ' selected' : ''}${state.countingHelp && index < state.counted ? ' counted' : ''}${state.countingHelp && index === state.counted - 1 ? ' current' : ''}${blocked && selected === counter.id ? ' blocked' : ''}`}
        onKeyDown={event => key(event, counter.id)} onClick={event => event.stopPropagation()} onPointerDown={event => {
          if (!enabled || gesture.current || !event.isPrimary || event.button !== 0 || menu) return;
          event.preventDefault(); event.stopPropagation(); event.currentTarget.focus(); start(event.currentTarget, counter.id, event.pointerId, event.clientX, event.clientY);
        }} onPointerMove={move} onPointerUp={event => {
          if (gesture.current?.pointer !== event.pointerId) return; move(event); const moved = gesture.current?.moved; finish(true); if (moved) setSelected(null);
        }} onPointerCancel={event => { if (gesture.current?.pointer === event.pointerId) cancel(); }} onLostPointerCapture={event => { if (gesture.current?.pointer === event.pointerId) cancel(); }}>
        <circle className="counter-halo" r="64" fill="none" strokeWidth="4" />
        <circle r="60" fill={colors[index]} stroke="#ffffff" strokeWidth="4" />
        <path d="M-30-25Q-15-40 8-38" fill="none" stroke="#ffffff80" strokeWidth="5" strokeLinecap="round" pointerEvents="none" />
        {state.countingHelp && index < state.counted && <text textAnchor="middle" y="16" className="counter-number">{index + 1}</text>}
      </g>)}
    </svg>
    <span className="counting-instructions" id="counting-keyboard-help">{w.hint} Keyboard: Enter, arrows, Enter to place; Escape to cancel.</span>
    <span className="counting-review">{w.preview}</span>
    <span className="sr-only" role="status">{state.countingHelp ? `${state.counted} ${w.counted}` : ''}</span>
    {enabled && controlsHost && createPortal(controls, controlsHost)}
  </section>;
}
export default function CountingBoard({ activity, state, onChange, enabled = true, controlsHost }: ActivityProps) {
  return activity.kind === 'counting-board' && state.kind === 'counting-board'
    ? <CountingScene key={enabled ? 'interactive' : 'view'} config={activity.config} state={state} onChange={onChange} enabled={enabled} controlsHost={controlsHost} /> : null;
}
