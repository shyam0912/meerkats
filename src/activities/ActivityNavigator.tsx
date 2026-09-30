import { useEffect, useRef, useState } from 'react';
import useDrawing from '../store/useDrawing';
export default function ActivityNavigator() {
  const { lesson, selectActivity, isInteracting } = useDrawing();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null); const close = useRef<HTMLButtonElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current; const button = trigger.current;
    element?.showModal(); close.current?.focus();
    return () => { element?.close(); button?.focus(); };
  }, [open]);
  if (!lesson || lesson.version.activities.length < 2) return null;
  const activities = lesson.version.activities;
  const index = activities.findIndex(a => a.id === lesson.progress.currentActivityId);
  return <nav className="activity-navigation" aria-label="Lesson activities">
    <button className="workspace-button" disabled={isInteracting || index <= 0} onClick={() => selectActivity(activities[index - 1]!.id)}>Previous</button>
    <button ref={trigger} className="workspace-button activity-position" aria-haspopup="dialog" disabled={isInteracting}
      onClick={() => setOpen(true)} aria-label="Activity outline">{index + 1} of {activities.length}<span>{activities[index]?.title}</span></button>
    <button className="workspace-button" disabled={isInteracting || index >= activities.length - 1} onClick={() => selectActivity(activities[index + 1]!.id)}>Next</button>
    <dialog ref={dialog} className="ink-dialog activity-outline" aria-labelledby="activity-outline-title"
      onCancel={event => { event.preventDefault(); setOpen(false); }}>
      <div className="ink-dialog-heading"><h2 id="activity-outline-title">Lesson activities</h2>
        <button ref={close} className="workspace-button" onClick={() => setOpen(false)}>Close outline</button></div>
      <ol>{activities.map((a, i) => <li key={a.id}><button className="workspace-button" aria-current={a.id === lesson.progress.currentActivityId ? 'step' : undefined}
        onClick={() => { selectActivity(a.id); setOpen(false); }}>{i + 1}. {a.title}</button></li>)}</ol>
    </dialog>
  </nav>;
}
