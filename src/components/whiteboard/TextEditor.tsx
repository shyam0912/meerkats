import { useEffect, useRef, useState } from 'react';
import type { TeachingText } from '../../../contracts';
import { BOARD_FONT, ensureBoardFont, layoutText } from '../../drawing/teachingText';

export default function TextEditor({ initial, onConfirm, onCancel }: {
  initial: TeachingText; onConfirm: (text: TeachingText) => string | undefined; onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [composing, setComposing] = useState(false); const composition = useRef(false);
  const [ready, setReady] = useState(false); const [error, setError] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    let active = true; field.current?.focus();
    void ensureBoardFont().then(() => { if (active) setReady(true); }).catch(() => { if (active) setError('Text font could not load. Cancel and try again; existing text is unchanged.'); });
    return () => { active = false; };
  }, []);
  return <section className="wb-text-editor" aria-label="Edit board text" onPointerDown={e => e.stopPropagation()}
    onKeyDown={e => {
      e.stopPropagation();
      if (e.key === 'Escape' && !composition.current && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) { e.preventDefault(); onCancel(); }
    }}>
    <label className="wb-text-field">Board text<textarea ref={field} value={value.text} spellCheck={false} wrap="off"
      style={{ fontFamily: `"${BOARD_FONT}", sans-serif` }}
      onCompositionStart={() => { composition.current = true; setComposing(true); }}
      onCompositionEnd={e => { const text = e.currentTarget.value; composition.current = false; setComposing(false); setValue(v => ({ ...v, text })); }}
      onChange={e => setValue(v => ({ ...v, text: e.target.value }))} /></label>
    <div className="wb-text-options">
      <label>Text colour<input type="color" value={value.color} onChange={e => setValue(v => ({ ...v, color: e.target.value }))} /></label>
      <label>Font size<select value={value.fontSize} onChange={e => setValue(v => ({ ...v, fontSize: Number(e.target.value) }))}>
        {[16, 24, 32, 40, 48, 64, 80, 96].map(size => <option key={size} value={size}>{size}</option>)}
      </select></label>
      <button className="workspace-button" disabled={!ready || composing || !value.text.trim()} onClick={() => {
        if (composition.current) return;
        try { const error = onConfirm(layoutText(value)); if (error) setError(error); } catch (error) { setError((error as Error).message); }
      }}>Apply text</button>
      <button className="workspace-button" onClick={onCancel}>Cancel text</button>
    </div>
    {composing && <p>Finish keyboard composition before applying.</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
