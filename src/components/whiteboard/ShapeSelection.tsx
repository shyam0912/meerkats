import { useImperativeHandle, useState, type Ref, type KeyboardEvent } from 'react';
import type { TeachingShape } from '../../../contracts';
import { selectionCorners, shapeFrame, shapeHandles, type ShapeHandle } from '../../drawing/shapeEditing';

export interface ShapeSelectionRef { preview: (shape: TeachingShape | null) => void }
export default function ShapeSelection({ shape, scale, ref, onHandleKey }: {
  shape: TeachingShape; scale: number; ref: Ref<ShapeSelectionRef>; onHandleKey: (handle: ShapeHandle, event: KeyboardEvent<SVGCircleElement>) => void;
}) {
  const [draft, setDraft] = useState<TeachingShape | null>(null);
  useImperativeHandle(ref, () => ({ preview: setDraft }), []);
  const shown = draft ?? shape; const corners = selectionCorners(shown); const frame = shapeFrame(shown);
  const handles = shapeHandles(shown, scale);
  return <svg className="wb-selection" viewBox="0 0 1200 675" aria-label="Selected shape controls">
    <polygon points={corners.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#007568" strokeWidth={2 / scale} strokeDasharray={`${6 / scale} ${4 / scale}`} />
    <line x1={frame.center.x} y1={frame.center.y} x2={handles.at(-1)!.point.x} y2={handles.at(-1)!.point.y} stroke="#007568" strokeWidth={1 / scale} strokeDasharray={`${4 / scale} ${4 / scale}`} />
    {handles.map(({ kind, point }) => <g key={kind}>
      <circle cx={point.x} cy={point.y} r={24 / scale} fill="transparent" className="wb-shape-handle" role="button" tabIndex={0}
        aria-label={kind === 'rotate' ? 'Rotate shape' : 'Resize shape ' + kind} data-handle={kind}
        onKeyDown={event => onHandleKey(kind, event)} />
      <circle cx={point.x} cy={point.y} r={(kind === 'rotate' ? 11 : 8) / scale} fill="white" stroke="#007568" strokeWidth={2 / scale} />
      {kind === 'rotate' && <text x={point.x} y={point.y} textAnchor="middle" dominantBaseline="central" fontSize={18 / scale} fill="#214f45">↻</text>}
    </g>)}
  </svg>;
}
