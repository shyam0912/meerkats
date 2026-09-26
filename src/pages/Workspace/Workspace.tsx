import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import SessionHeader from "../../components/workspace/SessionHeader";
import TeachingSurface from "../../components/workspace/TeachingSurface";
import TeacherControls from "../../components/workspace/TeacherControls";
import useDrawing from "../../store/useDrawing";
import { useClassroom } from "../../store/useClassroom";

export default function Workspace() {
  const navigate = useNavigate();
  const { selection, setSelection, activatePersistence, storageChecked } = useDrawing();
  const { sessionId } = useClassroom();
  const [params, setParams] = useSearchParams();
  useEffect(() => { activatePersistence(); }, [activatePersistence]);
  useEffect(() => {
    const requested = params.get('session');
    if (requested && requested !== sessionId) {
      // Browser Back/Forward can reopen another saved URL inside the SPA.
      // Re-enter validated startup recovery rather than relabelling the current board.
      window.location.reload();
    } else if (!requested) setParams({ session: sessionId }, { replace: true });
  }, [params, setParams, sessionId]);
  if (params.get('session') && params.get('session') !== sessionId)
    return <main className="p-10" role="status">Opening teaching session…</main>;
  if (!storageChecked) return <main className="p-10" role="status">Preparing teaching session…</main>;
  return <div className="teacher-workspace">
    <SessionHeader onBack={() => navigate("/")} />
    <TeachingSurface selection={selection} onSelect={setSelection} />
    <TeacherControls />
  </div>;
}
