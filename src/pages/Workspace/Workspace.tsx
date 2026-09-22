import { useNavigate } from "react-router-dom";
import { useState } from "react";
import SessionHeader from "../../components/workspace/SessionHeader";
import TeachingSurface from "../../components/workspace/TeachingSurface";
import TeacherControls from "../../components/workspace/TeacherControls";
import type { DemoSelection } from "../../components/workspace/NeutralScene";

export default function Workspace() {
  const navigate = useNavigate();
  const [selection, setSelection] = useState<DemoSelection>(null);
  return <div className="teacher-workspace">
    <SessionHeader onBack={() => navigate("/")} />
    <TeachingSurface selection={selection} onSelect={setSelection} />
    <TeacherControls />
  </div>;
}
