import { lazy } from 'react';
import type { ActivityDefinition, ActivityState } from '../../contracts/lesson';

export interface ActivityProps { activity: ActivityDefinition; state: ActivityState; onChange: (state: ActivityState) => void }
const registry = {
  'molecule-builder': { component: lazy(() => import('./kinds/MoleculeBuilder')), canExplore: true, canReveal: false, canReset: true },
  explain: { component: lazy(() => import('./kinds/Explain')), canExplore: false, canReveal: false, canReset: false },
  explore: { component: lazy(() => import('./kinds/Explore')), canExplore: true, canReveal: false, canReset: true },
  reveal: { component: lazy(() => import('./kinds/Reveal')), canExplore: false, canReveal: true, canReset: true },
};
export function lookupActivity(kind: string) {
  return Object.hasOwn(registry, kind) ? registry[kind as keyof typeof registry] : undefined;
}
export function capabilities(activity?: ActivityDefinition) {
  const registered = activity && lookupActivity(activity.kind);
  return { canExplore: registered?.canExplore ?? false, canReveal: registered?.canReveal ?? false,
    canReset: registered?.canReset ?? false, canAnnotate: Boolean(registered && activity?.annotationPolicy === 'ink') };
}
