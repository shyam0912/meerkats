import { useClassroom } from "../../store/useClassroom";
import useDrawing from "../../store/useDrawing";

export default function SessionHeader({ onBack }: { onBack: () => void }) {
  const { selectedClass, selectedSubject } = useClassroom();
  const { mode } = useDrawing();
  return <header className="session-header">
    <button className="workspace-button back-button" onClick={onBack}>← Back</button>
    <div className="session-context">
      <span className="workspace-brand">MEERKATS / TEACHING WORKSPACE</span>
      <h1>{selectedClass && selectedSubject ? `${selectedClass} · ${selectedSubject}` : "Quick workspace"}</h1>
    </div>
    <div className="session-status">
      <strong>{mode === "whiteboard" ? "Whiteboard" : "Shape studio · Demo"}</strong>
      <span>Temporary session · Not saved</span>
    </div>
  </header>;
}
