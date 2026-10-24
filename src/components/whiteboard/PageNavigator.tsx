import { useEffect, useRef, useState } from 'react';
import { MAX_WHITEBOARD_PAGES, type PageBackground } from '../../../contracts';
import useDrawing from '../../store/useDrawing';
import { exportBoardPng } from '../../drawing/exportBoard';
import { SessionRepository, type LocalRecord } from '../../persistence/database';
import ConfirmDialog from '../common/ConfirmDialog';

export default function PageNavigator() {
  const { whiteboard, changePage, isInteracting } = useDrawing();
  const board = whiteboard.document;
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [previews, setPreviews] = useState<{ revision: number; urls: Record<string, string> }>({ revision: -1, urls: {} });
  const [backup, setBackup] = useState<LocalRecord>();
  const [backupError, setBackupError] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null); const trigger = useRef<HTMLButtonElement>(null); const close = useRef<HTMLButtonElement>(null);
  const index = board.pages.findIndex(p => p.id === board.activePageId);
  const page = board.pages[index]!;
  const full = board.pages.length + board.deletedPages.length >= MAX_WHITEBOARD_PAGES;
  useEffect(() => {
    if (!open) return;
    const element = dialog.current; const returnTo = trigger.current;
    element?.showModal(); close.current?.focus(); let active = true;
    void new SessionRepository().migrationBackup(board.owner.sessionId).then(value => { if (active) { setBackup(value); setBackupError(false); } })
      .catch(() => { if (active) setBackupError(true); });
    return () => { active = false; element?.close(); if (returnTo?.isConnected) returnTo.focus(); };
  }, [open, board.owner.sessionId]);
  useEffect(() => {
    if (!open) return;
    let active = true; const urls: string[] = [];
    // Small previews are produced sequentially and disposed when the tray closes.
    // The same compositing renderer as PNG export preserves eraser masks.
    void (async () => {
      for (const p of board.pages) {
        try {
          const surface = { schemaVersion: 1 as const, id: board.id, owner: board.owner, revision: board.revision,
            bounds: board.bounds, objects: p.objects, shapes: p.shapes, background: p.background };
          const blob = await exportBoardPng(surface, .15); if (!active) return;
          const url = URL.createObjectURL(blob); urls.push(url);
          setPreviews(previous => ({ revision: board.revision, urls: { ...(previous.revision === board.revision ? previous.urls : {}), [p.id]: url } }));
        } catch { /* The labelled page remains usable if preview rendering fails. */ }
      }
    })();
    return () => { active = false; urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [open, board.pages, board.id, board.owner, board.revision, board.bounds]);
  function downloadBackup() {
    if (!backup) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = window.document.createElement('a'); link.href = url; link.download = `Meerkats-original-v1-${board.id.slice(0, 8)}.json`;
    window.document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  return <>
    <button ref={trigger} className="workspace-button wb-pages-trigger" aria-label={`Pages · ${index + 1} of ${board.pages.length}`} aria-haspopup="dialog"
      disabled={isInteracting} onClick={() => { setPreviews({ revision: -1, urls: {} }); setOpen(true); }}>Page {index + 1} / {board.pages.length}</button>
    <dialog ref={dialog} className="wb-pages" aria-labelledby="wb-pages-title" onCancel={event => { event.preventDefault(); setOpen(false); }}>
      <div className="wb-dialog-heading"><h2 id="wb-pages-title">Board pages</h2><button ref={close} className="workspace-button" aria-label="Close pages" onClick={() => setOpen(false)}>Close</button></div>
      <div className="wb-page-actions"><button className="workspace-button" disabled={full || isInteracting} onClick={() => { changePage({ type: 'add', id: crypto.randomUUID() }); }}>Add page</button>
        <p>{board.pages.length + board.deletedPages.length} / {MAX_WHITEBOARD_PAGES} pages including deleted pages · 2 MiB board limit</p></div>
      <div className="wb-backgrounds" role="group" aria-label={`Background for page ${index + 1}`}>
        {(['white', 'lined', 'dotted', 'grid'] as PageBackground[]).map(background => <button key={background} className="workspace-button"
          aria-pressed={page.background === background} disabled={isInteracting} onClick={() => changePage({ type: 'background', id: page.id, background })}>
          {background === 'grid' ? 'Square grid' : background[0]!.toUpperCase() + background.slice(1)}</button>)}
      </div>
      <p className="wb-page-help">Undo/Redo affect this page. Clear ink leaves shapes intact. Deleted pages can be restored below.</p>
      {whiteboard.error && <p role="alert">{whiteboard.error}</p>}
      <div className="wb-pages-scroll">
        <ol className="wb-page-list">{board.pages.map((p, i) => <li key={p.id} data-page-id={p.id}>
          <button className="workspace-button wb-page-preview" aria-label={`Open page ${i + 1}`} aria-pressed={p.id === page.id} disabled={isInteracting}
            onClick={() => { changePage({ type: 'select', id: p.id }); setOpen(false); }}>
            {previews.revision === board.revision && previews.urls[p.id] ? <img src={previews.urls[p.id]} alt="" /> : <span className="wb-preview-placeholder">Preview</span>}<span>Page {i + 1}</span></button>
          <div className="wb-page-row"><button className="workspace-button" aria-label={`Move page ${i + 1} earlier`} disabled={i === 0 || isInteracting} onClick={() => changePage({ type: 'move', id: p.id, direction: -1 })}>←</button>
            <button className="workspace-button" aria-label={`Move page ${i + 1} later`} disabled={i === board.pages.length - 1 || isInteracting} onClick={() => changePage({ type: 'move', id: p.id, direction: 1 })}>→</button>
            <button className="workspace-button" aria-label={`Delete page ${i + 1}`} disabled={board.pages.length === 1 || isInteracting} onClick={() => setDeleting(p.id)}>Delete</button></div>
        </li>)}</ol>
        {board.deletedPages.length > 0 && <section aria-label="Deleted pages"><h3>Deleted pages</h3><p>Retained with their ink, shapes and background; still count toward board capacity.</p>
          {board.deletedPages.map((p, i) => <button key={p.id} className="workspace-button" disabled={isInteracting} onClick={() => changePage({ type: 'restore', id: p.id })}>Restore deleted page {i + 1}</button>)}
        </section>}
        {backup && backup.snapshot.whiteboard.schemaVersion === 1 && <section aria-label="Original v1 recovery"><h3>Original board preserved</h3>
          <p>The pre-migration snapshot is stored in this browser. Recovery adds a page without replacing your current work.</p>
          <button className="workspace-button" disabled={full || isInteracting} onClick={() => { if (backup.snapshot.whiteboard.schemaVersion === 1) changePage({ type: 'add', id: crypto.randomUUID(), objects: backup.snapshot.whiteboard.objects }); }}>Recover original as a page</button>
          <button className="workspace-button" onClick={downloadBackup}>Download original v1 backup</button></section>}
        {backupError && <p role="alert">The migration backup could not be read. Existing stored data was left untouched.</p>}
      </div>
    </dialog>
    <ConfirmDialog open={deleting !== null} title="Delete this page?" message="The page will move to Deleted pages, where you can restore its ink, shapes and background. Other pages will not change."
      confirmText="Delete page" onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting) changePage({ type: 'delete', id: deleting }); setDeleting(null); close.current?.focus(); }} />
  </>;
}
