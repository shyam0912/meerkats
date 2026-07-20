import useDrawing from "../../store/useDrawing";

function ToolDock() {
  const {
    selectedTool,
    setSelectedTool,
  } = useDrawing();

  return (
    <div className="w-24 bg-white shadow-lg flex flex-col items-center py-4 gap-4">

      <button
        onClick={() => setSelectedTool("pen")}
        className={selectedTool==="pen" ? "text-2xl scale-125" : "text-2xl"}
      >
        ✏️
      </button>

      <button
        onClick={() => setSelectedTool("eraser")}
        className={selectedTool==="eraser" ? "text-2xl scale-125" : "text-2xl"}
      >
        🖍
      </button>

      <button
        onClick={() => setSelectedTool("rectangle")}
        className={selectedTool==="rectangle" ? "text-2xl scale-125" : "text-2xl"}
      >
        ⬜
      </button>

      <button
        onClick={() => setSelectedTool("text")}
        className={selectedTool==="text" ? "text-2xl scale-125" : "text-2xl"}
      >
        🔤
      </button>

      <button className="text-2xl">
        ↩
      </button>

      <button className="text-2xl">
        ↪
      </button>

    </div>
  );
}

export default ToolDock;