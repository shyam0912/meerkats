import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="w-full max-w-3xl">
        
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-blue-900">
            MEERKATS
          </h1>

          <p className="text-xl text-slate-600 mt-4">
            Classroom Operating System
          </p>
        </div>

        <div className="space-y-6">
          
          <button
            onClick={() => navigate("/classes")}
            className="w-full h-32 rounded-3xl bg-blue-900 text-white text-3xl font-semibold shadow-lg hover:scale-[1.02] transition"
          >
            🚀 Start Teaching
          </button>

          <button
            onClick={() => navigate("/workspace")}
            className="w-full h-32 rounded-3xl bg-teal-600 text-white text-3xl font-semibold shadow-lg hover:scale-[1.02] transition"
          >
            🖍 Quick Workspace
          </button>

        </div>
      </div>
    </div>
  );
}

export default Home;