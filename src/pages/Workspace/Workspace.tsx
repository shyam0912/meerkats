import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useClassroom } from "../../store/useClassroom";
import { subjectTools } from "../../data/subjectTools";
import { subjectShelf } from "../../data/subjectShelf";
import { subjectContent } from "../../data/subjectContent";
import CanvasRenderer from "../../components/canvas/CanvasRenderer";
import LessonShelf from "../../components/workspace/LessonShelf";
import WorkspaceTopBar from "../../components/workspace/WorkspaceTopBar";
import ToolDock from "../../components/workspace/ToolDock";
import SmartTools from "../../components/workspace/SmartTools";
import FloatingPanel from "../../components/workspace/FloatingPanel";




function Workspace() {

  const navigate = useNavigate();

  const { selectedClass, selectedSubject } = useClassroom();

  const [selectedShelf, setSelectedShelf] = useState("");

  const [selectedLesson, setSelectedLesson] = useState("");

  const tools = subjectTools[selectedSubject] || [];

  const shelfItems = subjectShelf[selectedSubject] || [];

  const currentContent = subjectContent[selectedSubject]?.[selectedShelf] || [];


  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-100">

      {/* Top Bar */}
      <WorkspaceTopBar
        selectedClass={selectedClass}
        selectedSubject={selectedSubject}
        selectedLesson={selectedLesson}
        onWhiteboard={() => {
          setSelectedShelf("");
          setSelectedLesson("");
        }}
        onExit={() => navigate("/")}
      />

      {/* Main Area */}
      <div className="relative flex flex-1 overflow-hidden">

        {/* Left Tool Dock */}
        <ToolDock />

        {/* Floating Panel */}
        <FloatingPanel />

        {/* Canvas */}
        <div className="flex-1 p-6 overflow-hidden">
          <CanvasRenderer
            selectedShelf={selectedShelf}
            selectedLesson={selectedLesson}
            currentContent={currentContent}
            onLessonSelect={setSelectedLesson}
            onBack={() => setSelectedLesson("")}
          />
        </div>

        {/* Smart Tools */}
        <SmartTools tools={tools} />

      </div>

      {/* Lesson Shelf */}
      <LessonShelf
        shelfItems={shelfItems}
        selectedShelf={selectedShelf}
        onShelfSelect={(item) => {
          setSelectedShelf(item);
          setSelectedLesson("");
        }}
      />

    </div>
  );
}

export default Workspace;