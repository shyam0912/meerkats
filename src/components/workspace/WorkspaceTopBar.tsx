interface Props {
  selectedClass: string;
  selectedSubject: string;
  selectedLesson: string;
  onWhiteboard: () => void;
  onExit: () => void;
}

function WorkspaceTopBar({
  selectedClass,
  selectedSubject,
  selectedLesson,
  onWhiteboard,
  onExit,
}: Props) {
  return (
    <div className="h-16 bg-blue-900 text-white flex items-center justify-between px-6">

      <button
        onClick={onWhiteboard}
        className="px-4 py-2 bg-white/20 rounded-xl hover:bg-white/30 transition"
      >
        🏠 Whiteboard
      </button>

      <div className="text-xl font-semibold">
        {selectedClass} • {selectedSubject}
      </div>

      <div className="text-sm">
        {selectedLesson}
      </div>

      <button
        onClick={onExit}
        className="px-4 py-2 bg-red-600 rounded-xl hover:bg-red-700 transition"
      >
        🚪 Exit
      </button>

    </div>


  );
}

export default WorkspaceTopBar;