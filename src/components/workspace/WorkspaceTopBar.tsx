import { useNavigate } from "react-router-dom";

interface Props {
  selectedClass: string;
  selectedSubject: string;
  selectedLesson: string;
}

function WorkspaceTopBar({
  selectedClass,
  selectedSubject,
  selectedLesson,
}: Props) {
  const navigate = useNavigate();

  return (
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
  );
}

export default WorkspaceTopBar;