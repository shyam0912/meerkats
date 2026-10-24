import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useDrawing from '../../store/useDrawing';
import { SessionRepository, type RecentBoard } from '../../persistence/database';
import { downloadBoard, exportBoardPng } from '../../drawing/exportBoard';
import TeachingSurface from '../workspace/TeachingSurface';
import DrawingToolbar from '../workspace/DrawingToolbar';
import ConfirmDialog from '../common/ConfirmDialog';
import './whiteboard-pro.css';
import PageNavigator from './PageNavigator';

export default function WhiteboardPro() {
  const { document, mode, setMode, selection, setSelection, saveStatus, isInteracting, flushBeforeLeave } = useDrawing();
  const navigate = useNavigate();
  const [focused, setFocused] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [recent, setRecent] = useState<{ boards: RecentBoard[]; unavailable: number } | null>(null);
  const [recentError, setRecentError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [leave, setLeave] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const recentTrigger = useRef<HTMLButtonElement>(null);
  const recentClose = useRef<HTMLButtonElement>(null);
  // Old quick sessions may retain the neutral fixture's mode. Preserve its data, open the board.
  useEffect(() => { if (mode !== 'whiteboard') setMode('whiteboard'); }, [mode, setMode]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isInteracting && !window.document.querySelector('dialog[open]')) setFocused(false);
    };
    window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
  }, [isInteracting]);
  useEffect(() => {
    if (!recentOpen) return;
    let active = true;
    const element = dialog.current; const trigger = recentTrigger.current;
    element?.showModal(); recentClose.current?.focus();
    void new SessionRepository().recentBoards().then(value => { if (active) setRecent(value); })
      .catch(() => { if (active) setRecentError(true); });
    return () => { active = false; element?.close(); if (trigger?.isConnected) trigger.focus(); };
  }, [recentOpen]);
  const unsaved = saveStatus.startsWith('Needs attention');
  const needsServer = saveStatus.includes('Server');
  async function go(destination: string) {
    if (isInteracting || busy) return;
    setBusy(true);
    const saved = await flushBeforeLeave();
    setBusy(false);
    if (!saved) { setLeave(destination); return; }
    if (destination === '/') navigate('/'); else window.location.assign(destination);
  }
  async function exportPng() {
    if (isInteracting || busy) return;
    setBusy(true); setMessage('Preparing PNG…');
    try { downloadBoard(await exportBoardPng(document), document.id); setMessage('PNG download requested · Check your downloads.'); }
    catch { setMessage('PNG could not be exported. Your board is unchanged. Try again.'); }
    finally { setBusy(false); }
  }
  return <div className={`teacher-workspace mk-v2 wb-pro${focused ? ' wb-focused' : ''}`}>
    <header className="wb-header">
      {!focused && <><button className="workspace-button" disabled={isInteracting || busy} onClick={() => void go('/')}>← Back</button>
        <div className="wb-title"><span>MEERKATS</span><h1>Whiteboard</h1></div></>}
      <span className={`wb-save${unsaved ? ' wb-save-error' : ''}`} role="status" aria-live="polite">{saveStatus}</span>
      {!focused && <><button ref={recentTrigger} className="workspace-button" disabled={isInteracting || busy} aria-haspopup="dialog"
        onClick={() => { setRecent(null); setRecentError(false); setRecentOpen(true); }}>Recent boards</button>
        <button className="workspace-button" disabled={isInteracting || busy} onClick={() => void exportPng()}>Export PNG</button></>}
      <button className="workspace-button" aria-pressed={focused} disabled={isInteracting || busy} onClick={() => setFocused(value => !value)}>{focused ? 'Leave focus' : 'Focus'}</button>
    </header>
    {(unsaved || needsServer) && <aside className="wb-save-help" aria-label="Save guidance">{unsaved
      ? 'Your latest work may not be saved. Keep this board open and export a PNG before leaving. Undo history is not restored after reload.'
      : 'Work is saved on this device. Server synchronization needs attention; keep using this browser for recovery.'}</aside>}
    <TeachingSurface selection={selection} onSelect={setSelection} />
    <footer className="wb-controls" aria-label="Whiteboard controls"><DrawingToolbar pro /><PageNavigator />
      {!focused && <span className="wb-footer-note">A clear space to think.</span>}</footer>
    {message && <div className="wb-message" role="alert">{message}<button className="workspace-button" aria-label="Dismiss export message" disabled={isInteracting} onClick={() => setMessage('')}>Close</button></div>}
    <dialog ref={dialog} className="wb-recent" aria-labelledby="recent-title" onCancel={event => { event.preventDefault(); setRecentOpen(false); }}>
      <div className="wb-dialog-heading"><h2 id="recent-title">Recent boards</h2><button ref={recentClose} className="workspace-button" aria-label="Close recent boards" onClick={() => setRecentOpen(false)}>Close</button></div>
      <p>Standalone boards saved in this browser. Reopening restores board content, not Undo history.</p>
      {recentError ? <p role="alert">Recent boards could not be read. Stored data has not been changed. Close and try again.</p>
        : !recent ? <p>Reading saved boards…</p> : <>
          {recent.unavailable > 0 && <p role="alert">{recent.unavailable} unreadable record(s) left untouched.</p>}
          {!recent.boards.length && <p>No saved standalone boards yet.</p>}
          <ul>{recent.boards.map(board => <li key={board.id}><button className="workspace-button" disabled={busy || board.id === document.owner.sessionId}
            onClick={() => void go('/workspace?session=' + board.id)}>
            <span>Board {board.id.slice(0, 8)}{board.id === document.owner.sessionId ? ' · Current' : ''}<small>{new Date(board.savedAt).toLocaleString()} · {board.inkCount ? 'Contains board content' : 'Empty board'}</small></span><span aria-hidden="true">↗</span>
          </button></li>)}</ul>
        </>}
      <p className="wb-local-note">Up to 20 recent boards. Browser storage is local, not a backup. PNG export is a picture, not an editable board.</p>
    </dialog>
    <ConfirmDialog open={leave !== null} title="Leave without a confirmed save?" message="Your latest work may be lost. Cancel to keep this board open and export a PNG first."
      confirmText="Leave without saving" onCancel={() => setLeave(null)} onConfirm={() => { if (leave === '/') navigate('/'); else if (leave) window.location.assign(leave); }} />
  </div>;
}
