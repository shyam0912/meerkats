import type { CSSProperties } from 'react';
import type { ActivityDefinition } from '../../../contracts/lesson';

export default function VisualItems({ activity, selectedId, onSelect }: {
  activity: Extract<ActivityDefinition, { kind: 'explain' | 'explore' }>; selectedId?: string | null; onSelect?: (id: string) => void;
}) {
  const selected = activity.config.items.find(i => i.id === selectedId);
  return <div className="neutral-scene" aria-label={activity.title}>
    <div className="scene-intro"><span>ORIGINAL DEMONSTRATION</span><h2>{activity.title}</h2><p>{activity.guidance}</p></div>
    {activity.config.items.map((item, index) => {
      const graphic = <><svg viewBox="0 0 240 210" aria-hidden="true">
        {item.shape === 'circle' ? <circle cx="120" cy="105" r="74" /> : item.shape === 'triangle' ?
          <path d="M120 22 L210 182 H30 Z" /> : <rect x="46" y="31" width="148" height="148" rx="4" />}
      </svg><span>{item.label}</span></>;
      const style = { left: 160 + index * 330, '--shape-color': item.color } as CSSProperties;
      return onSelect ? <button key={item.id} className="scene-shape" style={style} aria-label={item.label}
        aria-pressed={selectedId === item.id} onClick={() => onSelect(item.id)}>{graphic}</button> :
        <div key={item.id} className="scene-shape static-shape" style={style}>{graphic}</div>;
    })}
    <div className="scene-detail" aria-live="polite"><p>{selected?.description ?? (onSelect ? 'Choose a shape.' : 'Observe · Describe · Compare')}</p></div>
    <span className="scene-footnote">Original engineering fixture · Not textbook content</span>
  </div>;
}
