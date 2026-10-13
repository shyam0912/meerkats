import { useEffect, useRef } from 'react';

/** Native keyboard semantics, local live preview, one durable commit per pointer gesture. */
export default function RangeProperty({ label, value, min, max, disabled, onBegin, onPreview, onCommit, onCancel }: {
  label: string; value: number; min: number; max: number; disabled: boolean;
  onBegin: () => void; onPreview: (value: number) => void; onCommit: (value: number) => void; onCancel: () => void;
}) {
  const active = useRef<{ id: number; value: number; viewport: string; cancel: () => void; commit: (value: number) => void; target: HTMLInputElement } | null>(null);
  function cancel() { const gesture = active.current; if (!gesture) return; active.current = null; gesture.cancel();
    if (gesture.target.hasPointerCapture(gesture.id)) gesture.target.releasePointerCapture(gesture.id); }
  useEffect(() => {
    const abort = () => cancel(); const key = (event: KeyboardEvent) => { if (event.key === 'Escape') abort(); };
    window.addEventListener('blur', abort); window.addEventListener('resize', abort); window.addEventListener('keydown', key);
    document.addEventListener('visibilitychange', abort);
    return () => { abort(); window.removeEventListener('blur', abort); window.removeEventListener('resize', abort);
      window.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', abort); };
  }, []);
  return <input type="range" min={min} max={max} step="1" value={value} aria-label={label} disabled={disabled}
    onPointerDown={event => {
      if (!event.isPrimary || event.button !== 0 || active.current) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      active.current = { id: event.pointerId, value, viewport: `${window.innerWidth}/${window.innerHeight}`, target: event.currentTarget, cancel: onCancel, commit: onCommit }; onBegin();
    }}
    onChange={event => { const next = Number(event.target.value); if (active.current) { active.current.value = next; onPreview(next); } else onCommit(next); }}
    onPointerUp={event => { const gesture = active.current; if (!gesture || gesture.id !== event.pointerId) return;
      if (gesture.viewport !== `${window.innerWidth}/${window.innerHeight}`) { cancel(); return; }
      active.current = null; gesture.commit(gesture.value); if (gesture.target.hasPointerCapture(gesture.id)) gesture.target.releasePointerCapture(gesture.id); }}
    onPointerCancel={event => { if (active.current?.id === event.pointerId) cancel(); }}
    onLostPointerCapture={event => { if (active.current?.id === event.pointerId) cancel(); }} onBlur={cancel} />;
}
