import useDrawing from "../../store/useDrawing";
import useWorkspaceUI from "../../store/useWorkspaceUI";
import type { WorkspacePanel } from "../../store/workspace-ui-context";

function ToolDock() {
  const {
    activePanel,
    togglePanel,
  } = useWorkspaceUI();

  const {
    undo,
    redo,
    clearCanvas,
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
          className="w-full h-12 rounded-xl bg-slate-100 hover:bg-slate-200"
        >
          ↩
        </button>

        <button
          onClick={redo}
          className="w-full h-12 rounded-xl bg-slate-100 hover:bg-slate-200"
        >
          ↪
        </button>

        <button
          onClick={clearCanvas}
          className="w-full h-12 rounded-xl bg-red-100 hover:bg-red-200"
        >
          🗑
        </button>

      </div>

    </div>
  );
}

export default ToolDock;