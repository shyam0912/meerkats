import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useClassroom } from "../../store/useClassroom";
import { subjectTools } from "../../data/subjectTools";
import { subjectShelf } from "../../data/subjectShelf";
import { subjectContent } from "../../data/subjectContent";
import CanvasRenderer from "../../components/Canvas/CanvasRenderer";



function Workspace() {
  const navigate = useNavigate();

  const { selectedClass, selectedSubject } = useClassroom();

  const [selectedShelf, setSelectedShelf] = useState("");

  const [selectedLesson, setSelectedLesson] = useState("");

  const tools = subjectTools[selectedSubject] || [];

  const shelfItems = subjectShelf[selectedSubject] || [];

  const currentContent = subjectContent[selectedSubject]?.[selectedShelf] || [];


  return (
    <div className="h-screen flex flex-col bg-slate-100">

      {/* Top Bar */}
      <div className="h-16 bg-blue-900 text-white flex items-center justify-between px-6">

        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-white/20 rounded-xl hover:bg-white/30 transition"
        >
          🏠 Home
        </button>

        <div className="text-xl font-semibold">
          {selectedClass} • {selectedSubject}
        </div>

        <div className="text-sm">
          {selectedLesson}
        </div>

      </div>

      {/* Main Area */}
      <div className="flex flex-1">

        {/* Left Tool Dock */}
        <div className="w-24 bg-white shadow-lg flex flex-col items-center py-4 gap-4">

          <button className="text-2xl">✏️</button>
          <button className="text-2xl">🖍</button>
          <button className="text-2xl">⬜</button>
          <button className="text-2xl">🔤</button>
          <button className="text-2xl">↩</button>
          <button className="text-2xl">↪</button>

        </div>


        {/* Canvas */}
        <div className="flex-1 p-6">
          <CanvasRenderer
            selectedShelf={selectedShelf}
            selectedLesson={selectedLesson}
            currentContent={currentContent}
            onLessonSelect={setSelectedLesson}
            onBack={() => setSelectedLesson("")}
          />
        </div>

        {/* Smart Tools */}
        <div className="w-72 bg-white shadow-lg p-4">

          <h2 className="text-xl font-bold mb-4">
            Smart Tools
          </h2>

          <div className="space-y-4">
            {tools.map((tool) => (
              <button
                key={tool}
                className="w-full h-16 bg-slate-100 rounded-xl hover:bg-slate-200"
              >
                {tool}
              </button>
            ))}
          </div>

        </div>

      </div>

      {/* Lesson Shelf */}
      <div className="h-28 bg-white shadow-inner flex items-center justify-center gap-6">

        {shelfItems.map((item) => (
          <button
            key={item}
            onClick={() => setSelectedShelf(item)}
            className={`px-6 py-3 rounded-xl transition ${selectedShelf === item
              ? "bg-blue-600 text-white"
              : "bg-slate-100 hover:bg-slate-200"
              }`}
          >
            {item}
          </button>
        ))}

      </div>

    </div>
  );
}

export default Workspace;