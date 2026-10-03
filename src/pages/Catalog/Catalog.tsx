import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Catalog as CatalogData, LessonDefinition } from '../../../contracts/lesson';
import { loadCatalog, loadLessonVersion } from '../../activities/catalog';
import { useClassroom } from '../../store/useClassroom';
import { classes } from '../../data/classes';

export default function Catalog() {
  const navigate = useNavigate(); const [params] = useSearchParams();
  const { launchLesson, setSelectedClass } = useClassroom();
  const [data, setData] = useState<CatalogData>(); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void loadCatalog().then(value => { if (active) { setData(value); setError(''); } }).catch(() => { if (active) setError('Catalog unavailable. Retry when the server is reachable, or use a quick workspace.'); });
    return () => { active = false; };
  }, [attempt]);
  const parent = data?.nodes.find(n => n.id === params.get('parent'));
  const nodes = data?.nodes.filter(n => parent ? n.parentId === parent.id : n.kind === 'class').sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)) ?? [];
  const lessons = data?.lessons.filter(l => parent?.kind === 'chapter' ? l.chapterId === parent.id : parent?.kind === 'topic' ? l.topicId === parent.id : false) ?? [];
  const title = parent?.kind === 'class' ? 'Select Subject' : parent?.kind === 'subject' ? 'Select Chapter' : parent?.kind === 'chapter' || parent?.kind === 'topic' ? 'Choose a lesson' : 'Select Class';
  async function start(definition: LessonDefinition) {
    setLoading(true); setError('');
    try {
      const version = await loadLessonVersion(definition.publishedVersionId);
      if (version.lessonId !== definition.id) throw new Error('Mismatched lesson');
      launchLesson(version, definition, data!.nodes.find(n => n.id === definition.classLevelId)!.title, data!.nodes.find(n => n.id === definition.subjectId)!.title);
      navigate('/workspace');
    } catch { setError('This lesson could not be validated or loaded. No teaching session was started.'); }
    finally { setLoading(false); }
  }
  return <main className="catalog-page">
    <button className="workspace-button" onClick={() => navigate(parent ? parent.kind === 'class' ? '/catalog' : `/catalog?parent=${parent.parentId}` : '/')}>← Back</button>
    <p className="catalog-kicker">MEERKATS · TEACHING CATALOG</p><h1>{title}</h1>
    <p>{parent?.title ?? 'Choose a curriculum reference lesson, a neutral demo, or a class workspace.'}</p>
    <p className="catalog-source">{import.meta.env.VITE_API_ENABLED === 'true' ? 'Catalog from the school API' : 'Bundled catalog · API disabled'}</p>
    {error && <div role="alert"><p>{error}</p><button className="workspace-button" onClick={() => setAttempt(a => a + 1)}>Retry catalog</button></div>}
    {!data && !error && <p role="status">Loading catalog…</p>}
    <div className="catalog-grid">{!lessons.length && nodes.map(node => <button className="catalog-card" key={node.id}
      onClick={() => navigate(`/catalog?parent=${node.id}`)}>{node.title}<span>{node.kind === 'class' ? data?.nodes.find(n => n.id === node.parentId)?.title : 'Browse'}</span></button>)}
      {lessons.map(lesson => <article className="catalog-card lesson-card" key={lesson.id}>
        <p>{data?.nodes.find(n => n.id === lesson.topicId)?.title}</p><h2>{lesson.title}</h2>
        <p>{data?.nodes.find(n => n.id === lesson.curriculumId)?.title}</p>
        <p>{lesson.description ?? 'Neutral engineering demo · No textbook content'}</p>
        <button className="workspace-button" disabled={loading} onClick={() => { void start(lesson); }}>{loading ? 'Loading lesson…' : 'Start Teaching'}</button>
      </article>)}
    </div>
    {!parent && <section className="legacy-class-workspaces"><h2>Class workspaces</h2><p>Standalone boards without an assigned lesson.</p>
      <div>{classes.map(label => <button className="workspace-button" key={label} onClick={() => { setSelectedClass(label); navigate('/subjects'); }}>{label}</button>)}</div>
    </section>}
  </main>;
}
