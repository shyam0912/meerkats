import { useNavigate } from 'react-router-dom';
import useDrawing from '../../store/useDrawing';
import { useClassroom } from '../../store/useClassroom';

export default function InteractiveSessionHeader({ focused, onFocus }: { focused: boolean; onFocus: () => void }) {
  const { lesson, saveStatus, isInteracting, mode } = useDrawing();
  const { lessonLaunch, restored, selectedClass, selectedSubject } = useClassroom();
  const subjectId = lessonLaunch?.definition.subjectId ?? restored?.snapshot.identity.context.subjectId;
  const navigate = useNavigate();
  return <header className="interactive-session-header">
    {!focused && <button className="workspace-button" disabled={isInteracting} onClick={() => navigate(subjectId ? '/catalog?parent=' + subjectId : '/catalog')}>← Classroom</button>}
    <div><span className="interactive-kicker">{focused ? 'FOCUS' : `MEERKATS / ${selectedClass.replace(/^Standard X$/, 'Standard 10')} · ${selectedSubject.split(' · ')[0]}`}</span><h1>{lesson?.version.title} <small>· {mode === 'explore' ? 'Explore' : mode === 'annotate' ? 'Annotate' : 'Whiteboard'}</small></h1></div>
    {!focused && <span role="status" aria-live="polite" className="interactive-save">{saveStatus}</span>}
    <button className="workspace-button" disabled={isInteracting} aria-pressed={focused} onClick={onFocus}>{focused ? 'Leave focus' : 'Focus'}</button>
  </header>;
}
