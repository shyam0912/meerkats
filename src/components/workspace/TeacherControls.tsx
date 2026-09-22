import useDrawing from "../../store/useDrawing";
import DrawingToolbar from "./DrawingToolbar";

export default function TeacherControls() {
  const { mode, setMode, isInteracting, document } = useDrawing();
  return <footer className="teacher-controls" aria-label="Teacher controls">
    <div className="mode-controls" role="group" aria-label="Teaching mode">
      <button className="workspace-button" aria-pressed={mode === "whiteboard"} disabled={isInteracting}
        onClick={() => setMode("whiteboard")}>Whiteboard</button>
      <button className="workspace-button" aria-label="Content" aria-pressed={mode === "explore"} disabled={isInteracting}
        onClick={() => setMode("explore")}>Content <small>Explore</small></button>
      <button className="workspace-button" aria-pressed={mode === "annotate"} disabled={isInteracting}
        onClick={() => setMode("annotate")}>Annotate</button>
    </div>
    {mode === "explore"
      ? <p className="explore-guidance">Touch a shape to explore.<br /><span>Choose Annotate to draw over it.</span></p>
      : <DrawingToolbar key={document.id} />}
  </footer>;
}
