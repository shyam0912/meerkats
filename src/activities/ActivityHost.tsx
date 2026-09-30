import { Component, Suspense, type ReactNode } from 'react';
import { activitySchema } from '../../contracts/lesson';
import { lookupActivity, type ActivityProps } from './registry';
import ContentFallback from './ContentFallback';

class ActivityBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <ContentFallback /> : this.props.children; }
}
export default function ActivityHost(props: ActivityProps) {
  const parsed = activitySchema.safeParse(props.activity);
  const entry = parsed.success && lookupActivity(parsed.data.kind);
  if (!entry) return <ContentFallback />;
  const Renderer = entry.component;
  return <ActivityBoundary key={props.activity.id}><Suspense fallback={<div className="activity-fallback" role="status">Loading activity…</div>}>
    <Renderer {...props} />
  </Suspense></ActivityBoundary>;
}
