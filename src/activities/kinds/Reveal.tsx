import type { ActivityProps } from '../registry';
export default function Reveal({ activity, state }: ActivityProps) {
  if (activity.kind !== 'reveal' || state.kind !== 'reveal') return null;
  return <div className="neutral-scene"><div className="scene-intro"><span>ORIGINAL DEMONSTRATION</span>
    <h2>{activity.title}</h2><p>{activity.guidance}</p></div>
    <ol className="reveal-items" aria-live="polite">{activity.config.items.slice(0, state.revealed).map((item, index) =>
      <li key={item.id}><span>{index + 1}</span>{item.text}</li>)}</ol>
    <div className="scene-detail"><p>{state.revealed} of {activity.config.items.length} prompts revealed</p></div>
  </div>;
}
