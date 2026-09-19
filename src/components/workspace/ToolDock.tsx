import useDrawing from "../../store/useDrawing";
import useWorkspaceUI from "../../store/useWorkspaceUI";
import type { WorkspacePanel } from "../../store/workspace-ui-context";
import { useState } from "react";
import ConfirmDialog from "../common/ConfirmDialog";

function ToolDock() {
  const [confirmClear, setConfirmClear] = useState(false);
  const {
    activePanel,
    togglePanel,
  } = useWorkspaceUI();

  const {
    undo,
    redo,
    clearCanvas,
    canUndo, canRedo, isInteracting, document,
  } = useDrawing();

  const panels: {
    id: WorkspacePanel;
    icon: string;
    label: string;
  }[] = [
      {
        id: "draw",
        icon: "🖍",
        label: "Draw",
      },
      {
        id: "lesson",
        icon: "📚",
        label: "Lesson",
      },
      {
        id: "media",
        icon: "🖼",
        label: "Media",
      },
      {
        id: "math",
        icon: "🧮",
        label: "Math",
      },
      {
        id: "science",
        icon: "🧪",
        label: "Science",
      },
      {
        id: "ai",
        icon: "🤖",
        label: "AI",
      },
    ];

  return (
    <div className="w-24 bg-white border-r shadow-lg flex flex-col">

      {/* Workspace Categories */}
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-3 items-center">

        {panels.map((panel) => (
          <button
            key={panel.id}
            disabled={panel.id !== "draw"}
            aria-label={panel.id === "draw" ? "Draw" : `${panel.label} (coming later)`}
            title={panel.label}
            onClick={() => togglePanel(panel.id)}
            className={`
              w-16 h-16
              rounded-2xl
              flex flex-col
              items-center
              justify-center
              transition-all
              duration-200
              disabled:opacity-40 disabled:cursor-not-allowed shrink-0
              ${activePanel === panel.id
                ? "bg-blue-600 text-white shadow-lg scale-105"
                : "bg-slate-100 hover:bg-slate-200"
              }
            `}
          >
            <span className="text-2xl">
              {panel.icon}
            </span>

            <span className="text-[10px] mt-1">
              {panel.label}
            </span>
          </button>
        ))}

      </div>

      {/* Fixed Actions */}
      <div className="border-t p-3 flex flex-col gap-3">

        <button
          onClick={undo}
          aria-label="Undo" disabled={!canUndo || isInteracting}
          className="w-full h-12 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
        >
          Undo
        </button>

        <button
          onClick={redo}
          aria-label="Redo" disabled={!canRedo || isInteracting}
          className="w-full h-12 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
        >
          Redo
        </button>

        <button
          onClick={() => setConfirmClear(true)}
          aria-label="Clear ink" disabled={document.objects.length === 0 || isInteracting}
          className="w-full h-12 rounded-xl bg-red-100 hover:bg-red-200 disabled:opacity-40"
        >
          Clear
        </button>

      </div>
      <ConfirmDialog open={confirmClear} title="Clear this board?"
        message="All ink on this board will be cleared. You can restore it with Undo."
        confirmText="Clear ink" onCancel={() => setConfirmClear(false)}
        onConfirm={() => { clearCanvas(); setConfirmClear(false); }} />
    </div>
  );
}

export default ToolDock;
