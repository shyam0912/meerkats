import { useEffect, useRef, type PointerEvent } from 'react';

export function constrain(value: number, min: number, max: number, step = 1) {
  return Math.max(min, Math.min(max, Math.round(value / step) * step));
}
/** One captured gesture owns its start value and callbacks. Drafts never enter session history. */
export function useAxisDrag(options: { enabled: boolean; value: number; min: number; max: number;
  pixelsPerUnit: () => number; begin: () => void; preview: (value: number) => void; commit: (value: number) => void; cancel: () => void }) {
  const gesture = useRef<{ id: number; x: number; start: number; value: number; pixels: number;
    viewport: string; target: SVGElement; options: typeof options } | null>(null);
  function cancel() {
    const active = gesture.current; if (!active) return;
    gesture.current = null; active.options.cancel();
    if (active.target.hasPointerCapture(active.id)) active.target.releasePointerCapture(active.id);
  }
  useEffect(() => {
    const abort = () => cancel();
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') abort(); };
    window.addEventListener('blur', abort); window.addEventListener('resize', abort);
    window.addEventListener('keydown', key); document.addEventListener('visibilitychange', abort);
    return () => { abort(); window.removeEventListener('blur', abort); window.removeEventListener('resize', abort);
      window.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', abort); };
  }, []);
  useEffect(() => { if (!options.enabled) cancel(); }, [options.enabled]);
  const move = (event: PointerEvent<SVGElement>) => {
    const active = gesture.current; if (!active || event.pointerId !== active.id) return;
    if (active.viewport !== `${window.innerWidth}/${window.innerHeight}` || Math.abs(active.options.pixelsPerUnit() - active.pixels) > .001) { cancel(); return; }
    if (event.pointerType === 'mouse' && event.buttons === 0) { cancel(); return; }
    active.value = constrain(active.start + (event.clientX - active.x) / active.pixels, active.options.min, active.options.max);
    active.options.preview(active.value);
  };
  return {
    onPointerDown: (event: PointerEvent<SVGElement>) => {
      if (!options.enabled || gesture.current || !event.isPrimary || event.button !== 0) return;
      event.preventDefault(); event.currentTarget.focus();
      const pixels = options.pixelsPerUnit(); if (!Number.isFinite(pixels) || pixels === 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = { id: event.pointerId, x: event.clientX, start: options.value, value: options.value, pixels,
        viewport: `${window.innerWidth}/${window.innerHeight}`, target: event.currentTarget, options };
      options.begin();
    },
    onPointerMove: move,
    onPointerUp: (event: PointerEvent<SVGElement>) => {
      const active = gesture.current; if (!active || active.id !== event.pointerId) return;
      // Resize events may be queued after pointerup. Validate geometry synchronously too.
      if (active.viewport !== `${window.innerWidth}/${window.innerHeight}` || Math.abs(active.options.pixelsPerUnit() - active.pixels) > .001) { cancel(); return; }
      active.value = constrain(active.start + (event.clientX - active.x) / active.pixels, active.options.min, active.options.max);
      gesture.current = null;
      active.options.commit(active.value);
      if (active.target.hasPointerCapture(active.id)) active.target.releasePointerCapture(active.id);
    },
    onPointerCancel: (event: PointerEvent<SVGElement>) => { if (gesture.current?.id === event.pointerId) cancel(); },
    onLostPointerCapture: (event: PointerEvent<SVGElement>) => { if (gesture.current?.id === event.pointerId) cancel(); },
  };
}
