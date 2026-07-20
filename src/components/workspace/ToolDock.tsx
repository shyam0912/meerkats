import useDrawing from "../../store/useDrawing";

function ToolDock() {
  const { selectedTool, setSelectedTool } = useDrawing();

  const toolButton = (
    tool: "pen" | "eraser" | "rectangle" | "text",
    icon: string,
    title: string
  ) => (
    <button
      title={title}
      onClick={() => setSelectedTool(tool)}
      className={`
        w-14 h-14 rounded-2xl
        flex items-center justify-center
        text-2xl
        transition-all duration-200
        ${
          selectedTool === tool
            ? "bg-blue-600 text-white shadow-lg scale-110"
            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
        }
      `}
    >
      {icon}
    </button>
  );

  return (
    <div className="w-24 bg-white border-r shadow-lg flex flex-col items-center py-6 gap-4">

      {toolButton("pen", "✏️", "Pen")}

      {toolButton("eraser", "🧽", "Eraser")}

      {toolButton("rectangle", "⬜", "Rectangle")}

      {toolButton("text", "T", "Text")}

      <div className="w-10 border-t border-slate-300 my-2" />

      <button
        title="Undo"
        className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 text-2xl transition"
      >
        ↩
      </button>

      <button
        title="Redo"
        className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 text-2xl transition"
      >
        ↪
      </button>
    </div>
  );
}

export default ToolDock;