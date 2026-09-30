import type { ActivityProps } from '../registry';
import VisualItems from './VisualItems';
export default function Explain({ activity }: ActivityProps) {
  return activity.kind === 'explain' ? <VisualItems activity={activity} /> : null;
}
