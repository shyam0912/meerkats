import useDrawing from "../../../store/useDrawing";

function DrawPanel() {
  const {
    selectedTool,
    setSelectedTool,
    strokeColor,
    setStrokeColor,
    strokeWidth,
    setStrokeWidth,
  } = useDrawing();

  const toolButton = (
    tool: "pen" | "eraser" | "rectangle" | "text",
    icon: string,
    label: string
  ) => (
    <button
      onClick={() => setSelectedTool(tool)}
      className={`
        flex flex-col
        items-center
        justify-center
        rounded-2xl
        p-3
        transition
        border
        ${
          selectedTool === tool
            ? "bg-blue-600 text-white border-blue-600"
            : "bg-white hover:bg-slate-100 border-slate-200"
        }
      `}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs mt-1">{label}</span>
    </button>
  );

  return (
    <div className="space-y-6">

      {/* Tools */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 mb-3">
          Tools
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {toolButton("pen", "✏️", "Pen")}
          {toolButton("eraser", "🧽", "Eraser")}
          {toolButton("rectangle", "⬜", "Shape")}
          {toolButton("text", "🔤", "Text")}
        </div>
      </div>

      {/* Color */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 mb-2">
          Color
        </h3>

        <input
          type="color"
          value={strokeColor}
          onChange={(e) => setStrokeColor(e.target.value)}
          className="w-full h-12 rounded-xl cursor-pointer"
        />
      </div>

      {/* Stroke */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 mb-2">
          Stroke Width
        </h3>

        <input
          type="range"
          min={1}
          max={20}
          value={strokeWidth}
          onChange={(e) =>
            setStrokeWidth(Number(e.target.value))
          }
          className="w-full"
        />

        <div className="text-center text-sm mt-2 text-slate-500">
          {strokeWidth}px
        </div>
      </div>

    </div>
  );
}

export default DrawPanel;