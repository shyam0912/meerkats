import useDrawing from "../../store/useDrawing";
import DrawingToolbar from "./DrawingToolbar";
import { capabilities } from '../../activities/registry';
import { initialState } from '../../../contracts/lesson';

export default function TeacherControls() {
  const { mode, setMode, isInteracting, document, lesson, updateActivity } = useDrawing();
  const activity = lesson?.version.activities.find(a => a.id === lesson.progress.currentActivityId);
  const supported = capabilities(activity);
  const runtime = activity && lesson?.progress.states[activity.id];
  return <footer className="teacher-controls" aria-label="Teacher controls">
    <div className="mode-controls" role="group" aria-label="Teaching mode">
      <button className="workspace-button" aria-pressed={mode === "whiteboard"} disabled={isInteracting}
        onClick={() => setMode("whiteboard")}>Whiteboard</button>
      <button className="workspace-button" aria-label="Content" aria-pressed={mode === "explore"} disabled={isInteracting}
        onClick={() => setMode("explore")}>Content <small>{!lesson || supported.canExplore ? 'Explore' : 'View'}</small></button>
      {(!lesson || supported.canAnnotate) && <button className="workspace-button" aria-pressed={mode === "annotate"} disabled={isInteracting}
        onClick={() => setMode("annotate")}>Annotate</button>}
    </div>
    {mode === "explore"
      ? lesson && activity ? <div className="activity-actions">
        <p className="explore-guidance">{activity.guidance}</p>
        {supported.canReveal && activity.kind === 'reveal' && runtime?.kind === 'reveal' && <button className="workspace-button" disabled={runtime.revealed >= activity.config.items.length}
          onClick={() => updateActivity(activity.id, { kind: 'reveal', revealed: runtime.revealed + 1 })}>Reveal next</button>}
        {supported.canReset && <button className="workspace-button" disabled={JSON.stringify(runtime) === JSON.stringify(initialState(activity))}
          onClick={() => updateActivity(activity.id, initialState(activity))}>Reset activity</button>}
      </div> : <p className="explore-guidance">Touch a shape to explore.<br /><span>Choose Annotate to draw over it.</span></p>
      : <DrawingToolbar key={document.id} />}
  </footer>;
}
