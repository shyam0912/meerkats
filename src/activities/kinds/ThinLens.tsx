import { useRef, useState } from 'react';
import type { LensState } from '../../../contracts/lens';
import type { ActivityProps } from '../registry';
import { rayHeight, solveLens } from '../physics/optics';
import { imageViewport } from '../physics/imageViewport';
import { constrain, useAxisDrag } from '../interaction/useAxisDrag';
import useDrawing from '../../store/useDrawing';
import RangeProperty from '../interaction/RangeProperty';
import './thin-lens.css';

const X = (x: number) => 600 + x * 4;
const Y = (y: number) => 230 - y * 4;
const display = (value: number) => Math.abs(value) > 9999 ? value.toExponential(1) : Number(value.toFixed(1)).toString();

function LensScene({ state, onChange }: { state: LensState; onChange: (state: LensState) => void }) {
  const { mode, setInteracting } = useDrawing();
  const [activeControl, setActiveControl] = useState<string | null>(null);
  const [draft, setDraft] = useState<LensState | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const live = draft ?? state;
  function preview(next: LensState) { setDraft(next); }
  function cancel() { setDraft(null); setActiveControl(null); setInteracting(false); }
  function begin(control: string) { setActiveControl(control); setInteracting(true); }
  function commit(next: LensState) { onChange(next); cancel(); }
  const drag = useAxisDrag({ enabled: mode === 'explore' && (!activeControl || activeControl === 'object'), value: state.distance, min: 5, max: 120,
    pixelsPerUnit: () => -4 * (svg.current!.getBoundingClientRect().width / 1200),
    begin: () => begin('object'),
    preview: distance => preview({ ...state, distance }), commit: distance => commit({ ...state, distance }), cancel });
  const result = solveLens(live);
  const image = imageViewport(result.imageDistance, result.magnification);
  const imageLabelX = image ? Math.max(160, Math.min(1030, image.x + 100)) : 0;
  const imageLabelY = image ? Math.max(100, Math.min(340, image.y + (result.kind === 'real' ? 42 : -42))) : 0;
  const description = result.kind === 'infinity' ? 'At F · Parallel rays · Image at infinity' :
    `${result.kind === 'real' ? 'Real · Inverted' : 'Virtual · Upright'} · ${Math.abs(result.magnification!) < .999 ? 'Diminished' : Math.abs(result.magnification!) > 1.001 ? 'Magnified' : 'Same size'}`;
  return <section className="lens-scene" aria-label="Interactive lenses">
    <header className="lens-heading"><div><span>PHYSICS / LENSES</span><h2>Follow the light.</h2></div><p>Prototype · Teacher review pending</p></header>
    <svg ref={svg} viewBox="0 0 1200 420" className="lens-diagram" aria-label="Lens ray diagram">
      <defs><clipPath id="lens-ray-window"><rect x="24" y="24" width="1152" height="360" /></clipPath></defs>
      <line x1="25" y1="230" x2="1175" y2="230" stroke="#9caea4" strokeWidth="2" />
      <text x="1150" y="268" textAnchor="end" className="lens-axis-label">Principal axis</text>
      <g clipPath="url(#lens-ray-window)" fill="none" strokeWidth="4.5">
        <path d={`M ${X(-live.distance)} ${Y(15)} H 600 L ${X(144)} ${Y(rayHeight(144, 'parallel', live.distance, result.f))}`} stroke="#995914" />
        <path d={`M ${X(-live.distance)} ${Y(15)} L 600 230 L ${X(144)} ${Y(rayHeight(144, 'central', live.distance, result.f))}`} stroke="#176d84" />
        {result.kind === 'virtual' && <g strokeDasharray="11 9" strokeWidth="3.5">
          <path d={`M 600 ${Y(15)} L ${X(-144)} ${Y(rayHeight(-144, 'parallel', live.distance, result.f))}`} stroke="#995914" />
          <path d={`M 600 230 L ${X(-144)} ${Y(rayHeight(-144, 'central', live.distance, result.f))}`} stroke="#176d84" />
        </g>}
      </g>
      <g className="lens-ray-key" aria-label="Ray key">
        <rect x="24" y="5" width="460" height="48" fill="#fcfcf6" />
        <path d="M36 28h40" stroke="#995914" strokeWidth="5" /><text x="86" y="36">Parallel ray</text>
        <path d="M270 28h40" stroke="#176d84" strokeWidth="5" /><text x="320" y="36">Centre ray</text>
      </g>
      {[-2, -1, 1, 2].map(n => <g key={n}><line x1={X(n * live.focalLength)} y1="221" x2={X(n * live.focalLength)} y2="239" stroke="#3c5d50" strokeWidth="4" />
        <text className="lens-focal-label" x={X(n * live.focalLength)} y="276" textAnchor="middle">{Math.abs(n) === 2 ? '2F' : 'F'}</text></g>)}
      <path d={live.lens === 'convex' ? 'M600 70 Q550 230 600 390 Q650 230 600 70Z' : 'M575 70 Q615 230 575 390 L625 390 Q585 230 625 70Z'} fill="#dcece780" stroke="#547e73" strokeWidth="3" />
      <text x="600" y="415" textAnchor="middle">{live.lens === 'convex' ? 'Convex lens' : 'Concave lens'}</text>
      <g {...drag} role="slider" tabIndex={0} aria-label="Object position" aria-valuemin={5} aria-valuemax={120} aria-valuenow={live.distance}
        aria-valuetext={`${live.distance} centimetres from lens`} className="lens-object" onKeyDown={event => {
          if (activeControl) return;
          const delta = event.key === 'ArrowLeft' ? 1 : event.key === 'ArrowRight' ? -1 : 0;
          if (delta || event.key === 'Home' || event.key === 'End') { event.preventDefault(); commit({ ...state,
            distance: event.key === 'Home' ? 5 : event.key === 'End' ? 120 : constrain(state.distance + delta * (event.shiftKey ? 5 : 1), 5, 120) }); }
        }}>
        <rect className="lens-object-target" x={X(-live.distance) - 48} y="105" width="96" height="145" rx="18" />
        <path d={`M ${X(-live.distance)} 230 V 170 m -13 18 l 13 -18 l 13 18`} fill="none" stroke="#214f45" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <text className="lens-object-label" x={X(-live.distance)} y="137" textAnchor="middle">Object</text>
      </g>
      {image && !image.outside && <g className="lens-image-mark" pointerEvents="none" aria-label={`${result.kind} image at ray intersection`}>
        <path d={`M${image.x} 230V${image.y}`} stroke="#fcfcf6" strokeWidth="15" />
        <path data-testid="lens-image" d={`M${image.x} 230V${image.y}`} stroke="#81365e" strokeWidth="9" strokeDasharray={result.kind === 'virtual' ? '7 4' : undefined} />
        <circle data-testid="lens-image-intersection" cx={image.x} cy={image.y} r="10" fill="#fcfcf6" stroke="#81365e" strokeWidth="3" />
        <path d={`M${image.x} ${image.y}l-9 ${Math.sign(result.magnification!) * Math.min(16, Math.abs(image.y - 230) * .65)}h18Z`} fill="#81365e" />
        <path d={`M${imageLabelX - 12} ${imageLabelY + 8}L${image.x} ${image.y}`} stroke="#81365e" strokeWidth="2" fill="none" />
        <text className="lens-image-label" x={imageLabelX} y={imageLabelY} textAnchor="middle">Image</text>
      </g>}
      {image?.outside && <g className="lens-offscreen" pointerEvents="none" data-testid="lens-offscreen" aria-label={`Image beyond view: ${image.direction}`}>
        <g transform={`translate(${image.edgeX} ${image.edgeY}) rotate(${image.angle})`}>
          <path d="M-18-10 0 0-18 10M-29-10-11 0-29 10" fill="none" stroke="#fcfcf6" strokeWidth="9" />
          <path d="M-18-10 0 0-18 10M-29-10-11 0-29 10" fill="none" stroke="#81365e" strokeWidth="4" />
        </g>
        <rect x="686" y="5" width="480" height="58" rx="12" />
        <text x="926" y="42" textAnchor="middle">Image beyond view · {image.direction}</text>
      </g>}
      <text x="36" y="405" className="lens-drag-hint">↔ Drag object · Arrow keys</text>
      <text x="1164" y="405" textAnchor="end" className="lens-drag-hint">Dashed lines: virtual extensions</text>
    </svg>
    <div className="lens-result"><strong data-testid="lens-result">{description}</strong><span>{result.imageDistance === null ? 'No finite image' : `v = ${display(result.imageDistance)} cm · m = ${display(result.magnification!)}`}</span></div>
    <fieldset className="lens-properties" disabled={mode !== 'explore'}><legend className="sr-only">Lens properties</legend>
      <div className="lens-switch" role="group" aria-label="Lens type">{(['convex', 'concave'] as const).map(lens => <button disabled={Boolean(activeControl)} key={lens} aria-pressed={live.lens === lens} onClick={() => commit({ ...state, lens })}>{lens === 'convex' ? 'Convex' : 'Concave'}</button>)}</div>
      {([{ key: 'distance', label: 'Object distance', min: 5, max: 120 }, { key: 'focalLength', label: 'Focal length', min: 10, max: 50 }] as const).map(item => <label key={item.key}>
        <span>{item.label} <output>{item.key === 'focalLength' && live.lens === 'concave' ? '−' : ''}{live[item.key]} cm</output></span>
        <RangeProperty label={item.label} min={item.min} max={item.max} value={live[item.key]} disabled={Boolean(activeControl && activeControl !== item.key)}
          onBegin={() => begin(item.key)} onPreview={value => preview({ ...state, [item.key]: value })}
          onCommit={value => commit({ ...state, [item.key]: value })} onCancel={cancel} />
      </label>)}
    </fieldset>
    <p className="lens-model-note">Ideal thin lens · u = −{live.distance} cm · Original ray construction</p>
  </section>;
}
export default function ThinLens({ state, onChange }: ActivityProps) {
  return state.kind === 'thin-lens' ? <LensScene state={state} onChange={onChange} /> : null;
}
