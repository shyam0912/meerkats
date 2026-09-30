import type { ActivityProps } from '../registry';
import VisualItems from './VisualItems';
export default function Explore({ activity, state, onChange }: ActivityProps) {
  return activity.kind === 'explore' && state.kind === 'explore' ? <VisualItems activity={activity} selectedId={state.selectedId}
    onSelect={id => onChange({ kind: 'explore', selectedId: state.selectedId === id ? null : id })} /> : null;
}
