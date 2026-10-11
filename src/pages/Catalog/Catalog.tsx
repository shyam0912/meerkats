import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { Catalog as CatalogData, LessonDefinition, LessonVersion } from '../../../contracts/lesson';
import { loadCatalog, loadLessonVersion } from '../../activities/catalog';
import { useClassroom } from '../../store/useClassroom';
import { catalogPath, chapterLabel, discovery } from './discovery';
import { compactContext, contentState, plannedStandard, schoolCatalog, standardChoices, teacherLabel, type ContentState } from './schoolPilot';
import '../../styles/v2-foundation.css';
import './catalog.css';

function Badge({ state }: { state: ContentState }) {
  return <span className={`discovery-badge state-${state.toLowerCase()}`}>{state}</span>;
}
function Motif({ chemistry = false }: { chemistry?: boolean }) {
  return <svg className="discovery-motif" viewBox="0 0 240 160" fill="none" aria-hidden="true">
    {chemistry ? <><path d="M75 45h90m-78 0v38l-29 47a9 9 0 0 0 8 14h108a9 9 0 0 0 8-14l-29-47V45M79 111h82" /><circle cx="112" cy="122" r="5" /><circle cx="139" cy="95" r="4" /><path d="M193 35v22m-11-11h22" /></> : <><path d="m45 113 80-77 73 77H45Z" /><circle cx="125" cy="36" r="18" /><rect x="27" y="95" width="36" height="36" rx="8" /><path d="m198 96 19 34h-38ZM73 35v18m-9-9h18" /></>}
  </svg>;
}
function LessonPreview({ definition, onStart }: { definition: LessonDefinition; onStart: (version: LessonVersion) => void }) {
  const [version, setVersion] = useState<LessonVersion>();
  const [error, setError] = useState(false); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void loadLessonVersion(definition.publishedVersionId).then(value => {
      if (value.id !== definition.publishedVersionId || value.lessonId !== definition.id) throw new Error('Mismatched lesson');
      if (active) setVersion(value);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [definition.id, definition.publishedVersionId, attempt]);
  const state = contentState(definition, version);
  return <article className="discovery-preview">
    <div>
      <Badge state={state} />
      <h2>{definition.title}</h2>
      {version ? <p className="discovery-description">{state === 'Ready' ? 'Reviewed interactive lesson' : version.provenance.reviewStatus === 'engineering-demo' ? 'Prototype · Engineering demonstration' : 'Prototype lesson · Academic teacher review pending'}</p> :
        <p role={error ? 'alert' : 'status'} className="discovery-description">{error ? 'This lesson could not be loaded. No teaching session was started.' : 'Loading lesson preview…'}</p>}
      {error ? <button className="discovery-control" onClick={() => { setError(false); setAttempt(a => a + 1); }}>Retry lesson</button> :
        <button className="discovery-start" disabled={!version} onClick={() => { if (version) onStart(version); }}>Start teaching<span aria-hidden="true"> →</span></button>}
    </div>
    {version && <div className="discovery-outcomes"><p>In this lesson</p><ul>{version.objectives.map(objective => <li key={objective}>{objective}</li>)}</ul><span>{version.activities.length} interactive steps</span></div>}
  </article>;
}
function Discovery({ data, parentId, standard, internal }: { data: CatalogData; parentId: string | null; standard: string | null; internal: boolean }) {
  const navigate = useNavigate(); const location = useLocation();
  const { launchLesson } = useClassroom();
  const view = discovery(data, parentId);
  const planned = parentId === null ? plannedStandard(standard) : null;
  const invalid = view.invalid || (standard !== null && (!planned || parentId !== null));
  const schoolRoot = !internal && parentId === null && standard === null;
  const path = (id: string | null) => catalogPath(id) + (internal ? (id ? '&' : '?') + 'internal=demo' : '');
  const heading = useRef<HTMLHeadingElement>(null); const root = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const state = location.state as { focusId?: string } | null;
    const choice = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[data-choice-id]') ?? []).find(el => el.dataset.choiceId === state?.focusId);
    (choice ?? heading.current)?.focus();
  }, [location.state]);
  function start(definition: LessonDefinition, version: LessonVersion) {
    if (busy.current) return;
    busy.current = true; setError('');
    try {
      if (version.id !== definition.publishedVersionId || version.lessonId !== definition.id) throw new Error('Mismatched lesson');
      const classNode = data.nodes.find(n => n.id === definition.classLevelId);
      const subject = data.nodes.find(n => n.id === definition.subjectId);
      if (!classNode || !subject) throw new Error('Missing context');
      launchLesson(version, definition, classNode.title, subject.title);
      navigate('/workspace');
    } catch { busy.current = false; setError('This lesson could not be started. Please try again.'); }
  }
  const goBack = () => navigate(planned ? path(null) : view.parent ? path(view.parent.kind === 'class' ? null : view.parent.parentId) : '/', { state: { focusId: planned ? 'standard-' + planned : view.parent?.id } });
  return <div ref={root}>
    <nav className="discovery-nav" aria-label="Classroom navigation">
      <button className="discovery-control" onClick={goBack}>← Back</button>
      <span className="discovery-brand">meerkats <span>/ Classroom</span></span>
      <button className="discovery-control" onClick={() => navigate('/')}>Home</button>
    </nav>
    <header className={`discovery-heading${schoolRoot ? ' school-heading' : ''}`}>
      <p className="discovery-context">{planned ? 'Classroom' : compactContext(view.ancestors)}</p>
      <h1 ref={heading} tabIndex={-1}>{planned ? 'Standard ' + planned : view.level === 'lesson' ? 'Concept preview' : view.title}</h1>
      {view.parent && <p className="discovery-current">{teacherLabel(view.parent)}</p>}
      {schoolRoot && <p className="discovery-current">Kerala school pilot · Standards 1–10</p>}
    </header>
    {invalid ? <section className="discovery-empty"><h2>This selection is unavailable</h2><p>Return to the available standards to continue.</p><button className="discovery-control" onClick={() => navigate(path(null))}>Choose a class</button></section> : planned ? <section className="discovery-empty">
      <Badge state="Planned" /><h2>Curriculum content is planned</h2><p>No verified subjects, chapters or lessons are available for this standard yet.</p>
      <button className="discovery-control" onClick={goBack}>Choose another standard</button>
    </section> : <>
      {schoolRoot ? <>
        <div className="discovery-standards">{standardChoices(data).map(choice => <button className="discovery-standard" key={choice.number}
          data-choice-id={choice.node?.id ?? 'standard-' + choice.number} data-catalog-id={choice.node?.id} aria-label={choice.label}
          onClick={() => navigate(choice.path)}>
          <span className="standard-label">Standard</span><span className="standard-number">{choice.number}</span>
          {choice.node && data.lessons.some(l => l.classLevelId === choice.node!.id) ? <span className="standard-availability">Lesson preview →</span> : <Badge state="Planned" />}
        </button>)}</div>
        <p className="discovery-legend"><strong>Ready</strong> · Reviewed lesson <span><strong>Preview</strong> · Prototype</span><span><strong>Planned</strong> · Content not yet available</span></p>
      </> : <div className={`discovery-choices discovery-${view.level}`}>
        {view.nodes.map(node => {
          const chapter = chapterLabel(node.title);
          const definition = data.lessons.find(l => l.topicId === node.id);
          return <button className="discovery-choice" data-choice-id={node.id} data-catalog-id={node.id} key={node.id} aria-label={teacherLabel(node)}
            onClick={() => navigate(path(node.id))}>
            {(node.kind === 'class' || node.kind === 'subject') && <Motif chemistry={/chemistry/i.test(node.title)} />}
            {node.kind === 'chapter' && <span className="discovery-number">{chapter.number ?? 'Chapter'}</span>}
            <span className="discovery-choice-copy">
              {node.kind === 'class' && <span className="discovery-eyebrow">{data.nodes.find(n => n.id === node.parentId)?.title}</span>}
              {node.kind === 'topic' && <span className="discovery-eyebrow">{definition ? 'View lesson preview' : 'Planned · No lesson available yet'}</span>}
              <span className="discovery-choice-title">{node.kind === 'chapter' ? chapter.title : teacherLabel(node)}</span>
              {node.kind === 'subject' && <span className="discovery-hint">{node.title.split(' · ').slice(1).join(' · ') || 'Choose a chapter'}</span>}
            </span><span className="discovery-arrow" aria-hidden="true">→</span>
          </button>;
        })}
      </div>}
      {view.level === 'lesson' && view.lessons.map(lesson => <LessonPreview key={lesson.publishedVersionId} definition={lesson} onStart={version => start(lesson, version)} />)}
      {!schoolRoot && !view.nodes.length && !view.lessons.length && <section className="discovery-empty"><Badge state="Planned" /><h2>{view.empty}</h2><p>{view.level === 'lesson' ? 'This concept does not have an interactive lesson yet. Choose another concept to continue.' : 'Choose another selection using Back, or return Home.'}</p></section>}
    </>}
    {error && <p role="alert" className="discovery-error">{error}</p>}
    {internal && <p className="discovery-source">Developer fixtures · {import.meta.env.VITE_API_ENABLED === 'true' ? 'Catalog from the school API' : 'Bundled catalog'}</p>}
  </div>;
}
export default function Catalog() {
  const navigate = useNavigate(); const [params] = useSearchParams();
  const [data, setData] = useState<CatalogData>(); const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0);
  const internal = import.meta.env.DEV && params.get('internal') === 'demo';
  useEffect(() => {
    let active = true;
    void loadCatalog().then(value => { if (active) setData(value); }).catch(() => { if (active) setError('The classroom catalog could not be loaded. Please try again.'); });
    return () => { active = false; };
  }, [attempt]);
  return <main className="mk-v2 discovery-page"><div className="discovery-shell">
    {data ? <Discovery key={`${params.get('parent')}/${params.get('standard')}/${internal}`} data={internal ? data : schoolCatalog(data)} parentId={params.get('parent')} standard={params.get('standard')} internal={internal} /> : <>
      <nav className="discovery-nav" aria-label="Classroom navigation"><button className="discovery-control" onClick={() => navigate('/')}>Home</button><span className="discovery-brand">meerkats / Classroom</span></nav>
      <section className="discovery-empty">{error ? <><h1>Classroom is unavailable</h1><p role="alert">{error}</p><button className="discovery-control" onClick={() => { setError(''); setAttempt(a => a + 1); }}>Retry catalog</button></> : <p role="status">Loading classroom…</p>}</section>
    </>}
  </div></main>;
}
