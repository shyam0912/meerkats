interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">

      <div className="w-[420px] rounded-3xl bg-white shadow-2xl p-8">

        <h2 className="text-2xl font-bold text-slate-800">
          {title}
        </h2>

        <p className="mt-3 text-slate-600">
          {message}
        </p>

        <div className="mt-8 flex justify-end gap-3">

          <button
            onClick={onCancel}
            className="
              px-5 py-2
              rounded-xl
              bg-slate-200
              hover:bg-slate-300
              transition
            "
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            className="
              px-5 py-2
              rounded-xl
              bg-red-600
              hover:bg-red-700
              text-white
              transition
            "
          >
            {confirmText}
          </button>

        </div>

      </div>

    </div>
  );
}

export default ConfirmDialog;