import { useEffect, useId, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ open, title, message, confirmText = "Confirm",
  cancelText = "Cancel", onConfirm, onCancel }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousFocus = document.activeElement;
    dialog.showModal();
    cancelRef.current?.focus();
    return () => {
      dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open]);
  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} aria-describedby={messageId}
      onCancel={(event) => { event.preventDefault(); onCancel(); }}
      className="m-auto w-[min(480px,calc(100vw-32px))] rounded-3xl bg-white p-8 shadow-2xl backdrop:bg-black/40">
      <h2 id={titleId} className="text-2xl font-bold">{title}</h2>
      <p id={messageId} className="mt-3 text-slate-600">{message}</p>
      <div className="mt-8 flex justify-end gap-3">
        <button ref={cancelRef} onClick={onCancel} className="min-h-14 rounded-xl bg-slate-200 px-5">{cancelText}</button>
        <button onClick={onConfirm} className="min-h-14 rounded-xl bg-red-600 px-5 text-white">{confirmText}</button>
      </div>
    </dialog>
  );
}
