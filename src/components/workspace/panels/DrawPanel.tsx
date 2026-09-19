import useDrawing from "../../../store/useDrawing";
import type { DrawingTool } from "../../../types/drawing";

export default function DrawPanel() {
  const { selectedTool, setSelectedTool, strokeColor, setStrokeColor,
    strokeWidth, setStrokeWidth, isInteracting } = useDrawing();
  const toolButton = (tool: DrawingTool, label: string) => (
    <button onClick={() => setSelectedTool(tool)} aria-pressed={selectedTool === tool}
      disabled={isInteracting}
      className={`min-h-16 rounded-2xl p-3 border font-semibold disabled:opacity-50 ${selectedTool === tool
        ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-slate-100 border-slate-200"}`}>
      {label}
    </button>
  );
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {toolButton("pen", "Pen")}
        {toolButton("eraser", "Eraser")}
      </div>
      <p className="text-sm text-slate-600">Eraser removes ink only.</p>
      <div>
        <label htmlFor="ink-color" className="block font-semibold mb-2">Pen color</label>
        <input id="ink-color" type="color" value={strokeColor} disabled={isInteracting}
          onChange={(event) => setStrokeColor(event.target.value)}
          className="w-full h-12 rounded-xl cursor-pointer" />
      </div>
      <div>
        <label htmlFor="ink-width" className="block font-semibold mb-2">Stroke width</label>
        <input id="ink-width" type="range" min={1} max={20} value={strokeWidth}
          disabled={isInteracting} onChange={(event) => setStrokeWidth(Number(event.target.value))}
          className="w-full h-12" />
        <output htmlFor="ink-width" className="block text-center text-sm text-slate-600">
          {strokeWidth}px pen / {strokeWidth * 6}px eraser
        </output>
      </div>
      <p className="text-sm text-slate-500">Temporary board. A new class, subject or Quick Workspace starts a new board. Reloading clears this session.</p>
    </div>
  );
}
