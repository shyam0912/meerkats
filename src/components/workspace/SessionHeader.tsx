import { useClassroom } from "../../store/useClassroom";
import useDrawing from "../../store/useDrawing";
import ActivityNavigator from '../../activities/ActivityNavigator';

export default function SessionHeader({ onBack }: { onBack: () => void }) {
  const { selectedClass, selectedSubject } = useClassroom();
  const { mode, saveStatus, lesson } = useDrawing();
  return <header className="session-header">
    <button className="workspace-button back-button" onClick={onBack}>← Back</button>
    <div className="session-context">
      <span className="workspace-brand">MEERKATS / TEACHING WORKSPACE</span>
      <h1>{selectedClass && selectedSubject ? `${selectedClass} · ${selectedSubject}` : "Quick workspace"}</h1>
      {lesson && <p className="lesson-title">{lesson.version.title}</p>}
    </div>
    <div className="session-status">
      <strong>{mode === "whiteboard" ? "Whiteboard" : lesson ? `Lesson · v${lesson.version.version}` : "Shape studio · Demo"}</strong>
      <span role="status" aria-live="polite">{saveStatus}</span>
    </div>
    <ActivityNavigator />
  </header>;
}
