import { useNavigate } from "react-router-dom";
import { useClassroom } from "../../store/useClassroom";

function Workspace() {
  const navigate = useNavigate();

  const { selectedClass, selectedSubject } = useClassroom();

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

          <div className="w-full h-full bg-white rounded-3xl shadow-lg flex items-center justify-center text-4xl font-bold text-slate-400">
            Canvas Area
          </div>

        </div>

        {/* Smart Tools */}
        <div className="w-72 bg-white shadow-lg p-4">

          <h2 className="text-xl font-bold mb-4">
            Smart Tools
          </h2>

          <div className="space-y-4">

            <button className="w-full h-16 bg-slate-100 rounded-xl hover:bg-slate-200">
              🧬 Cell Explorer
            </button>

            <button className="w-full h-16 bg-slate-100 rounded-xl hover:bg-slate-200">
              🫀 Human Body
            </button>

            <button className="w-full h-16 bg-slate-100 rounded-xl hover:bg-slate-200">
              🔬 Microscope
            </button>

          </div>

        </div>

      </div>

      {/* Lesson Shelf */}
      <div className="h-28 bg-white shadow-inner flex items-center justify-center gap-6">

        <button className="px-6 py-3 bg-slate-100 rounded-xl hover:bg-slate-200">
          Diagram
        </button>

        <button className="px-6 py-3 bg-slate-100 rounded-xl hover:bg-slate-200">
          3D Model
        </button>

        <button className="px-6 py-3 bg-slate-100 rounded-xl hover:bg-slate-200">
          Video
        </button>

        <button className="px-6 py-3 bg-slate-100 rounded-xl hover:bg-slate-200">
          Activity
        </button>

        <button className="px-6 py-3 bg-slate-100 rounded-xl hover:bg-slate-200">
          Quiz
        </button>

      </div>

    </div>
  );
}

export default Workspace;