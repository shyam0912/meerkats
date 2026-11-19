import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { ActivityProps } from '../registry';
import { acceptsPlantSlot, initialPlantState, placePlantPart, plantDropTarget, plantSlots, plantTargets, wholePlant,
  type PlantConfig, type PlantSlot, type PlantState } from '../../../contracts/plant';
import useDrawing from '../../store/useDrawing';
import './plant-builder.css';

const words = {
  en: { title: 'Build a plant', hint: 'Drag a part, or tap a part and its place.', tray: 'Your plant parts',
    names: ['Roots', 'Stem', 'Leaf', 'Leaf', 'Flower'], labels: 'Labels', water: 'Water', light: 'Sunlight', more: 'More',
    whole: 'Show whole plant', reset: 'Reset plant', back: 'Return to tray', cancel: 'Cancel placement', close: 'Close plant settings',
    explanations: ['Take in water and hold the plant in the soil.', 'Holds the plant up and carries water.',
      'Use light, water and air to make food.', 'Use light, water and air to make food.', 'Helps a flowering plant make seeds.'],
    ready: 'Touch a part. What does it do?', fit: 'Try a highlighted place.', placed: 'Part placed.',
    wet: 'Water in soil → roots → stem → leaves', dry: 'Less water in the soil. Plants need water over time.',
    sun: 'Leaves use light, water and air to make food.', dark: 'No light: no food-making from light. Night is normal.',
    model: 'A flowering plant model', resetPrompt: 'Return all parts to the tray?', yes: 'Reset', no: 'Keep plant' },
  ml: { title: 'ഒരു ചെടി ഉണ്ടാക്കാം', hint: 'ഒരു ഭാഗം വലിച്ചിടുക, അല്ലെങ്കിൽ ഭാഗവും സ്ഥാനവും തൊടുക.', tray: 'ചെടിയുടെ ഭാഗങ്ങൾ',
    names: ['വേരുകൾ', 'തണ്ട്', 'ഇല', 'ഇല', 'പൂവ്'], labels: 'പേരുകൾ', water: 'വെള്ളം', light: 'സൂര്യപ്രകാശം', more: 'കൂടുതൽ',
    whole: 'ചെടി മുഴുവൻ കാണാം', reset: 'വീണ്ടും തുടങ്ങാം', back: 'തിരികെ വയ്ക്കുക', cancel: 'റദ്ദാക്കുക', close: 'ക്രമീകരണങ്ങൾ അടയ്ക്കുക',
    explanations: ['വെള്ളം വലിച്ചെടുക്കുന്നു. ചെടിയെ മണ്ണിൽ ഉറപ്പിക്കുന്നു.', 'ചെടിയെ താങ്ങുന്നു. വെള്ളം എത്തിക്കുന്നു.',
      'വെളിച്ചവും വെള്ളവും വായുവും ഉപയോഗിച്ച് ആഹാരം ഉണ്ടാക്കുന്നു.', 'വെളിച്ചവും വെള്ളവും വായുവും ഉപയോഗിച്ച് ആഹാരം ഉണ്ടാക്കുന്നു.', 'വിത്തുകൾ ഉണ്ടാകാൻ സഹായിക്കുന്നു.'],
    ready: 'ഒരു ഭാഗം തൊടൂ. അത് എന്ത് ചെയ്യുന്നു?', fit: 'കാണിച്ചിരിക്കുന്ന സ്ഥാനത്ത് വയ്ക്കൂ.', placed: 'ഭാഗം വച്ചു.',
    wet: 'മണ്ണിലെ വെള്ളം → വേരുകൾ → തണ്ട് → ഇലകൾ', dry: 'മണ്ണിൽ വെള്ളം കുറവാണ്. ചെടികൾക്ക് വെള്ളം വേണം.',
    sun: 'ഇലകൾ വെളിച്ചവും വെള്ളവും വായുവും ഉപയോഗിച്ച് ആഹാരം ഉണ്ടാക്കുന്നു.', dark: 'ഇരുട്ടിൽ വെളിച്ചം ഉപയോഗിച്ച് ആഹാരം ഉണ്ടാക്കില്ല. രാത്രി സ്വാഭാവികമാണ്.',
    model: 'പൂക്കുന്ന ഒരു ചെടിയുടെ മാതൃക', resetPrompt: 'എല്ലാ ഭാഗങ്ങളും തിരികെ വയ്ക്കണോ?', yes: 'വീണ്ടും തുടങ്ങാം', no: 'ചെടി നിലനിർത്താം' },
};
const trayPositions = [{ x: 120, y: 205 }, { x: 280, y: 205 }, { x: 120, y: 365 }, { x: 280, y: 365 }, { x: 200, y: 520 }];
function BotanicalPart({ index, right = false }: { index: number; right?: boolean }) {
  if (index === 0) return <g fill="none" stroke="#95623e" strokeWidth="11" strokeLinecap="round">
    <path d="M0 -40 Q-7 0 0 62 M0 -8 Q-26 5 -58 48 M0 8 Q30 19 58 55 M-22 17 L-53 14 M25 27 L57 22 M-5 36 L-27 64" />
    <path d="M-51 37 L-66 34 M42 42 L69 42" strokeWidth="5" />
  </g>;
  if (index === 1) return <g><path d="M0 128 Q-8 20 0 -110" fill="none" stroke="#428853" strokeWidth="22" strokeLinecap="round" /><path d="M-3 118 Q-10 15 -3 -100" fill="none" stroke="#83b665" strokeWidth="5" strokeLinecap="round" /></g>;
  if (index === 2 || index === 3) return <g transform={right ? 'scale(-1 1)' : undefined}>
    <path d="M78 40 L110 42" stroke="#428853" strokeWidth="9" strokeLinecap="round" /><path d="M78 40 Q28 -69 -74 -47 Q-88 49 78 40" fill="#4f9953" stroke="#29663e" strokeWidth="3" />
    <path d="M78 40 Q-3 -6 -67 -40 M12 7 L-15 -36 M-17 -10 L-48 13 M37 21 L40 -10" fill="none" stroke="#c4dc85" strokeWidth="4" strokeLinecap="round" />
  </g>;
  return <g>{[0,60,120,180,240,300].map(angle => <ellipse key={angle} cy="-37" rx="24" ry="37" transform={`rotate(${angle})`} fill="#e98c88" stroke="#bc5d67" strokeWidth="3" />)}<circle r="27" fill="#ecc45d" stroke="#a77c26" strokeWidth="3" /><circle r="10" fill="#d8a640" /></g>;
}
type Gesture = { id: string; pointer: number; target: SVGGElement; rect: DOMRect; initial: PlantState;
  startX: number; startY: number; dx: number; dy: number; moved: boolean; commit: (s: PlantState) => void };
function PlantScene({ state, config, onChange, enabled, controlsHost }: {
  state: PlantState; config: PlantConfig; onChange: (s: PlantState) => void; enabled: boolean; controlsHost?: HTMLDivElement | null;
}) {
  const { setInteracting } = useDrawing();
  const svg = useRef<SVGSVGElement>(null), gesture = useRef<Gesture | null>(null);
  const [draft, setDraft] = useState<{ id: string; x: number; y: number } | null>(null);
  const [picked, setPicked] = useState<string | null>(null), [message, setMessage] = useState('');
  const [menu, setMenu] = useState(false), [confirm, setConfirm] = useState(false);
  const demo = state.demonstration;
  const menuRoot = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const w = words[state.language];
  const selectedIndex = state.parts.findIndex(p => p.id === state.selectedPartId);
  function cancel() {
    const active = gesture.current; gesture.current = null;
    if (active?.target.hasPointerCapture(active.pointer)) active.target.releasePointerCapture(active.pointer);
    setDraft(null); setPicked(null); setInteracting(false);
  }
  useEffect(() => {
    const abort = () => { const active = gesture.current; gesture.current = null;
      if (active?.target.hasPointerCapture(active.pointer)) active.target.releasePointerCapture(active.pointer);
      setDraft(null); setPicked(null); setInteracting(false);
    };
    const key = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { abort(); setMenu(false); setConfirm(false); } };
    window.addEventListener('keydown', key); window.addEventListener('blur', abort); window.addEventListener('resize', abort);
    document.addEventListener('visibilitychange', abort);
    const observer = new ResizeObserver(() => { const active = gesture.current;
      if (active && Math.abs(svg.current!.getBoundingClientRect().width - active.rect.width) > .1) abort();
    }); if (svg.current) observer.observe(svg.current);
    return () => { abort(); observer.disconnect(); window.removeEventListener('keydown', key); window.removeEventListener('blur', abort);
      window.removeEventListener('resize', abort); document.removeEventListener('visibilitychange', abort); };
  }, [setInteracting]);
  useEffect(() => {
    if (!menu) return;
    const outside = (e: globalThis.PointerEvent) => { if (!menuRoot.current?.contains(e.target as Node)) { setMenu(false); setConfirm(false); } };
    const key = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') trigger.current?.focus(); };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); };
  }, [menu]);
  function change(next: PlantState) { if (!enabled || gesture.current) return; setPicked(null); if (next !== state) onChange(next); }
  function inspect(id: string) {
    if (!enabled || menu || gesture.current) return;
    setPicked(id); setMessage(w.fit);
    if (state.selectedPartId !== id || state.demonstration !== null) onChange({ ...state, selectedPartId: id, demonstration: null });
  }
  function targetKey(event: KeyboardEvent<SVGGElement>) {
    if (!enabled || !picked || !event.key.startsWith('Arrow')) return;
    const targets = Array.from(svg.current?.querySelectorAll<SVGGElement>('.plant-target.available') ?? []);
    if (!targets.length) return;
    event.preventDefault();
    const index = targets.indexOf(event.currentTarget), backwards = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    targets[(index + (backwards ? -1 : 1) + targets.length) % targets.length]?.focus();
  }
  function place(slot: PlantSlot) {
    if (!enabled || !picked || gesture.current) return;
    const next = placePlantPart(state, picked, slot);
    if (next === state) { setMessage(w.fit); return; }
    change(next); setMessage(w.placed);
  }
  function start(e: PointerEvent<SVGGElement>, id: string, x: number, y: number) {
    if (!enabled || menu || !e.isPrimary || e.button !== 0 || gesture.current) return;
    e.preventDefault(); e.currentTarget.focus(); const rect = svg.current!.getBoundingClientRect();
    gesture.current = { id, pointer: e.pointerId, target: e.currentTarget, rect, initial: state, startX: e.clientX, startY: e.clientY,
      dx: (e.clientX-rect.left)*1200/rect.width-x, dy: (e.clientY-rect.top)*675/rect.height-y, moved: false, commit: onChange };
    setPicked(id); setInteracting(true); e.currentTarget.setPointerCapture(e.pointerId);
  }
  function point(e: PointerEvent<SVGGElement>, g: Gesture) {
    return { id: g.id, x: (e.clientX-g.rect.left)*1200/g.rect.width-g.dx, y: (e.clientY-g.rect.top)*675/g.rect.height-g.dy };
  }
  function move(e: PointerEvent<SVGGElement>) {
    const g = gesture.current; if (!g || g.pointer !== e.pointerId) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) { cancel(); return; }
    if (Math.hypot(e.clientX-g.startX,e.clientY-g.startY)>5) g.moved = true;
    if (g.moved) setDraft(point(e,g));
  }
  function end(e: PointerEvent<SVGGElement>) {
    const g = gesture.current; if (!g || g.pointer !== e.pointerId) return;
    const moved = g.moved || Math.hypot(e.clientX-g.startX,e.clientY-g.startY)>5;
    const p=point(e,g); gesture.current=null;
    if (g.target.hasPointerCapture(g.pointer)) g.target.releasePointerCapture(g.pointer);
    setDraft(null); setInteracting(false);
    if (!moved) { inspect(g.id); return; }
    const slot=plantDropTarget(g.initial,g.id,p.x,p.y);
    if (slot) { const next=placePlantPart(g.initial,g.id,slot); if(next!==g.initial)g.commit(next); setMessage(w.placed); }
    else setMessage(w.fit);
    setPicked(null);
  }
  const connected = state.parts.some(p=>p.slot==='root') && state.parts.some(p=>p.slot==='stem');
  const controls = <div className="plant-controls" ref={menuRoot}>
    <button className="workspace-button" aria-label="Show plant labels" aria-pressed={state.showLabels} disabled={!!draft} onClick={()=>change({...state,showLabels:!state.showLabels})}>{w.labels}</button>
    <button className="workspace-button" aria-label="Water demonstration" aria-pressed={demo==='water'} disabled={!!draft} onClick={()=>{ change({...state,demonstration:'water',water:demo==='water' && state.water==='available'?'limited':'available'}); }}>{w.water}</button>
    <button className="workspace-button" aria-label="Sunlight demonstration" aria-pressed={demo==='light'} disabled={!!draft} onClick={()=>{ change({...state,demonstration:'light',light:demo==='light' && state.light==='daylight'?'no-light':'daylight'}); }}>{w.light}</button>
    <button ref={trigger} className="workspace-button" aria-label="More plant controls" aria-expanded={menu} disabled={!!draft} onClick={()=>{ setPicked(null); setMenu(!menu); setConfirm(false); }}>{w.more} ···</button>
    {menu && <div className="plant-tray" role="group" aria-label="Plant settings">
      <button className="workspace-button plant-close" aria-label="Close plant settings" onClick={()=>{setMenu(false);setConfirm(false);trigger.current?.focus();}}>×</button>
      {confirm ? <><p>{w.resetPrompt}</p><button className="workspace-button" aria-label="Confirm reset plant" onClick={()=>{change({...initialPlantState(config),language:state.language,showLabels:state.showLabels});setConfirm(false);setMenu(false);trigger.current?.focus();}}>{w.yes}</button><button className="workspace-button" onClick={()=>setConfirm(false)}>{w.no}</button></> : <>
        <button className="workspace-button" aria-label="Show whole plant" onClick={()=>{change(wholePlant(state));setMenu(false);trigger.current?.focus();}}>{w.whole}</button>
        <button className="workspace-button" aria-label="Return selected part to tray" disabled={selectedIndex<0 || !state.parts[selectedIndex]?.slot} onClick={()=>{change(placePlantPart(state,state.selectedPartId!,null));setMenu(false);trigger.current?.focus();}}>{w.back}</button>
        <button className="workspace-button" aria-label="Reset plant" disabled={state.parts.every(p=>p.slot===null)} onClick={()=>setConfirm(true)}>{w.reset}</button>
        <button className="workspace-button" aria-label="Change plant language" onClick={()=>change({...state,language:state.language==='en'?'ml':'en'})}>English / മലയാളം</button>
      </>}
    </div>}
  </div>;
  const caption = demo==='water' ? (state.water==='available'?w.wet:w.dry) : demo==='light' ? (state.light==='daylight'?w.sun:w.dark) : selectedIndex>=0?w.explanations[selectedIndex]:w.ready;
  return <section className="plant-scene" lang={state.language} aria-label="Build a Plant" data-water={state.water} data-light={state.light}>
    <svg ref={svg} viewBox="0 0 1200 675" className="plant-canvas" aria-label="Plant assembly">
      <rect width="1200" height="675" rx="24" fill="#faf9f1" />
      <text x="36" y="49" className="plant-title">{w.title}</text><text x="36" y="85" className="plant-hint">{w.hint}</text>
      <rect x="28" y="112" width="344" height="484" rx="28" fill="#eef0e4" />
      <text x="54" y="145" className="plant-tray-title">{w.tray}</text>
      <path d="M425 463 Q650 450 1155 463 L1155 588 L425 588Z" fill="#e8d6b9" />
      <path d="M425 463 Q650 450 1155 463" fill="none" stroke="#ad8c5c" strokeWidth="3" />
      {[450,520,620,900,1000,1110].map((x,i)=><path key={x} d={`M${x} ${490+i%2*45} l10 4`} stroke="#bea17b" strokeWidth="4" strokeLinecap="round" />)}
      <text x="1164" y="85" textAnchor="end" className="plant-model">{w.model}</text>
      {demo==='light' && <g data-testid="plant-light-visual" aria-hidden="true" opacity={state.light==='daylight'?1:.35}>
        <circle cx="1070" cy="177" r="40" fill="#f1cc65" stroke="#b08a29" strokeWidth="3" />
        {[0,45,90,135,180,225,270,315].map(a=><path key={a} d="M1070 120 v-15" transform={`rotate(${a} 1070 177)`} stroke="#c49b36" strokeWidth="5" strokeLinecap="round" />)}
        {state.light==='daylight' && <path className="plant-light-rays" d="M1025 210 L935 279 M1020 174 L925 212 M1060 225 L982 332" stroke="#c3992d" strokeWidth="7" strokeDasharray="12 10" fill="none" />}
      </g>}
      {demo==='water' && <g data-testid="plant-water-visual" aria-hidden="true">
        {(state.water==='available'?[500,550,1010,1060]:[520]).map(x=><path key={x} d={`M${x} 487 q-24 32 0 32 q24 0 0 -32`} fill="#408eae" />)}
      </g>}
      {plantSlots.map((slot,i)=>{
        const p=plantTargets[slot], available=!state.parts.some(part=>part.slot===slot), index=state.parts.findIndex(part=>part.id===picked);
        const active=!!picked && available && acceptsPlantSlot(index,slot);
        return available && <g key={slot} data-testid={`plant-target-${slot}`} role="button" aria-label={`Place at ${slot}`} aria-disabled={!active}
          tabIndex={enabled && active?0:-1} className={`plant-target${active?' available':''}`} transform={`translate(${p.x} ${p.y})`}
          onClick={()=>place(slot)} onKeyDown={e=>{targetKey(e);if(e.key==='Enter'||e.key===' '){e.preventDefault();place(slot);}}}>
          <rect x="-70" y="-65" width="140" height="130" rx="24" className="plant-target-hit" />
          <g opacity=".16" pointerEvents="none"><BotanicalPart index={i} right={slot==='leaf-right'} /></g>
        </g>;
      })}
      {state.parts.map((part,i)=>{
        const p=draft?.id===part.id?draft:part.slot?plantTargets[part.slot]:trayPositions[i]!;
        const scale=part.slot || draft?.id===part.id?1:i===1?.5:.7;
        return <g key={part.id} data-testid={`plant-part-${i+1}`} data-part-id={part.id} data-slot={part.slot??'tray'}
          role="button" aria-label={`${w.names[i]} ${i+1}`} aria-pressed={state.selectedPartId===part.id} tabIndex={enabled?0:-1}
          className={`plant-part${picked===part.id || state.selectedPartId===part.id?' selected':''}`} transform={`translate(${p.x} ${p.y})`}
          onPointerDown={e=>start(e,part.id,p.x,p.y)} onPointerMove={move} onPointerUp={end}
          onPointerCancel={e=>{if(gesture.current?.pointer===e.pointerId)cancel();}}
          onLostPointerCapture={e=>{if(gesture.current?.pointer===e.pointerId)cancel();}}
          onKeyDown={e=>{targetKey(e);if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect(part.id);}}}>
          <rect x="-70" y="-65" width="140" height="130" rx="24" className="plant-part-hit" />
          <g transform={`scale(${scale})`} pointerEvents="none"><BotanicalPart index={i} right={part.slot==='leaf-right' || (!part.slot&&i===3)} /></g>
          {state.showLabels && <text className="plant-part-label" y={part.slot?i===0?48:i===1?95:i===4?-10:82:91} x={part.slot?i===0?-130:i===1?-60:i===4?110:0:0} textAnchor={part.slot?(i===0||i===1)?'end':i===4?'start':'middle':'middle'} pointerEvents="none">{w.names[i]}</text>}
        </g>;
      })}
      {demo==='water' && connected && state.water==='available' && <g className="plant-water-path" pointerEvents="none" aria-hidden="true">
        <path d="M720 540 Q760 510 760 455 L760 280" stroke="#d6f4fa" strokeWidth="12" fill="none" />
        <path d="M720 540 Q760 510 760 455 L760 280" stroke="#247b9e" strokeWidth="6" strokeDasharray="12 10" fill="none" />
        {[420,350,280].map(y=><path key={y} d={`M752 ${y+10} L760 ${y} L768 ${y+10}`} fill="none" stroke="#176380" strokeWidth="4" />)}
        {state.parts.some(p=>p.slot==='leaf-left') && <path d="M760 342 L685 310" stroke="#247b9e" strokeWidth="5" strokeDasharray="8 6" />}
        {state.parts.some(p=>p.slot==='leaf-right') && <path d="M760 407 L840 378" stroke="#247b9e" strokeWidth="5" strokeDasharray="8 6" />}
      </g>}
    </svg>
    <div className="plant-caption" data-testid="plant-explanation">{caption}</div>
    <span className="plant-review">Original Demo Concept — Preview / Teacher Review Pending</span>
    <span className="plant-announcement" role="status" aria-live="polite">{message}</span>
    {controlsHost && enabled && createPortal(controls,controlsHost)}
  </section>;
}
export default function PlantBuilder({ activity, state, onChange, enabled = true, controlsHost }: ActivityProps) {
  if(activity.kind!=='plant-builder'||state.kind!=='plant-builder')return null;
  return <PlantScene key={enabled?'interactive':'view'} config={activity.config} state={state} onChange={onChange} enabled={enabled} controlsHost={controlsHost} />;
}
