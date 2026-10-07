import { useNavigate } from "react-router-dom";
import { useClassroom } from "../../store/useClassroom";
import "../../styles/v2-foundation.css";
import "./home.css";

function Arrow() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

/** Original scene motifs; the destination labels carry all navigation meaning. */
function ClassroomArt() {
  return <svg className="home-art classroom-art" viewBox="0 0 400 220" fill="none" aria-hidden="true">
    <path className="art-guide" d="M55 163 183 52l157 110M55 163h285" />
    <circle className="art-orbit" cx="183" cy="52" r="34" />
    <circle className="art-point" cx="183" cy="52" r="9" />
    <rect className="art-square" x="26" y="134" width="58" height="58" rx="13" transform="rotate(-12 55 163)" />
    <path className="art-triangle" d="m340 126 37 66h-74z" />
    <path className="art-mark" d="M232 122h22m-11-11v22M115 65h12m-6-6v12" />
  </svg>;
}
function WhiteboardArt() {
  return <svg className="home-art whiteboard-art" viewBox="0 0 400 220" fill="none" aria-hidden="true">
    <path className="board-guide" d="M56 66h288M56 112h288M56 158h288M102 28v164M158 28v164M214 28v164M270 28v164" />
    <path className="board-sketch" d="M35 88V42h46M315 181h45v-44" />
    <circle className="board-anchor" cx="60" cy="152" r="7" />
    <path className="board-ink" d="M60 152c35-12 42-98 77-104 45-7-25 125 19 117 37-7 38-65 63-69 25-4-1 59 28 52 17-4 21-26 42-32" />
    <path className="board-underline" d="M165 187c38-9 80-9 126-5" />
    <path className="board-tip" d="m298 75 15-30 17 9-15 30-20 16z" />
    <path className="board-pen" d="m313 45 13-24a7 7 0 0 1 10-3l5 3a7 7 0 0 1 3 9l-14 24z" />
  </svg>;
}
const labSubjects = ['Chemistry', 'Physics', 'Mathematics', 'Biology', 'Social Science'] as const;
function SubjectMark({ subject }: { subject: typeof labSubjects[number] }) {
  return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    {subject === 'Chemistry' && <><path d="M12 4v10L5 26a2 2 0 0 0 2 3h18a2 2 0 0 0 2-3l-7-12V4M10 4h12M10 21h12" /><circle cx="16" cy="24" r="1" /></>}
    {subject === 'Physics' && <><circle cx="16" cy="16" r="3" /><ellipse cx="16" cy="16" rx="14" ry="6" transform="rotate(-35 16 16)" /><ellipse cx="16" cy="16" rx="6" ry="14" transform="rotate(-35 16 16)" /></>}
    {subject === 'Mathematics' && <><path d="m5 27 11-22 11 22H5Zm8-6 3-6 3 6h-6Z" /><path d="m10 17 3 2m-5 2 3 2" /></>}
    {subject === 'Biology' && <><path d="M7 26C1 10 14 4 27 5c1 16-6 25-20 21ZM6 28 23 10M12 22v-8m0 8h9" /></>}
    {subject === 'Social Science' && <><circle cx="16" cy="16" r="13" /><ellipse cx="16" cy="16" rx="6" ry="13" /><path d="M3 16h26M6 8c6 4 14 4 20 0M6 24c6-4 14-4 20 0" /></>}
  </svg>;
}

export default function Home() {
  const navigate = useNavigate();
  const { startQuickWorkspace } = useClassroom();
  return <main className="mk-v2 home-page">
    <div className="home-shell">
      <header className="home-brand" aria-label="Meerkats">
        <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
          <path d="M5 27V14a6 6 0 0 1 12 0v13M19 27V14a6 6 0 0 1 12 0v13" />
          <circle cx="18" cy="5" r="3" />
        </svg><span>meerkats</span>
      </header>
      <h1 className="home-heading">Where shall we begin?</h1>
      <nav className="home-destinations" aria-label="Teaching destinations">
        <button className="mk-destination home-classroom" aria-labelledby="classroom-title" aria-describedby="classroom-description"
          onClick={() => navigate("/catalog")}>
          <ClassroomArt />
          <span className="destination-copy"><span className="destination-title" id="classroom-title">Classroom</span>
            <span className="destination-description" id="classroom-description">Explore concepts with your class.</span></span>
          <span className="destination-arrow"><Arrow /></span>
        </button>
        <button className="mk-destination home-whiteboard" aria-labelledby="whiteboard-title" aria-describedby="whiteboard-description"
          onClick={() => { startQuickWorkspace(); navigate("/workspace"); }}>
          <WhiteboardArt />
          <span className="destination-copy"><span className="destination-title" id="whiteboard-title">Whiteboard</span>
            <span className="destination-description" id="whiteboard-description">Start with a blank board.</span></span>
          <span className="destination-arrow"><Arrow /></span>
        </button>
        {/* Focusable for discovery, explicitly unavailable; no fake Lab navigation. */}
        <button className="mk-destination home-labs" aria-disabled="true" aria-labelledby="labs-title" aria-describedby="labs-description labs-availability">
          <span className="labs-copy"><span className="labs-heading"><span className="destination-title" id="labs-title">Labs</span>
            <span className="availability-label" id="labs-availability">In development</span></span>
            <span className="destination-description" id="labs-description">A space to explore, build and experiment.</span>
          </span>
          <span className="labs-subjects">{labSubjects.map(subject => <span className="lab-subject" key={subject}>
            <SubjectMark subject={subject} /><span>{subject}</span>
          </span>)}</span>
        </button>
      </nav>
    </div>
  </main>;
}
