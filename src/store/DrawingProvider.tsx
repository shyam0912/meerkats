import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import type { DocumentOwner } from "../drawing/document";
import { activeDocument, createDrawingSession, createLessonSession, sessionReducer, type TeachingMode } from "../drawing/session";
import type { LessonVersion, ActivityState } from '../../contracts/lesson';
import type { DrawingTool, Stroke } from "../types/drawing";
import { DrawingContext } from "./drawing-context";
import { useClassroom } from "./useClassroom";
import { classIds, subjectIds } from "../persistence/catalog";
import { deserializeSession, serializeSession, type SessionSnapshot } from "../persistence/serialization";
import { PersistenceController } from "../persistence/controller";
import { api } from "../persistence/api";
import type { LocalRecord } from "../persistence/database";
import type { SessionIdentity, TeachingShape, TeachingShapeType } from "../../contracts";
import type { PageAction } from '../drawing/whiteboard';

function SessionDrawingProvider({ children, owner, identity, restored, lessonVersion }: {
  children: ReactNode; owner: DocumentOwner; identity: SessionIdentity; restored?: LocalRecord; lessonVersion?: LessonVersion;
}) {
  const [session, dispatch] = useReducer(sessionReducer, owner, initialOwner => restored
    ? deserializeSession(restored.snapshot) : lessonVersion ? createLessonSession(initialOwner, lessonVersion) : createDrawingSession(initialOwner, {
      whiteboard: crypto.randomUUID(), annotation: crypto.randomUUID(),
    }));
  const state = activeDocument(session);
  const documentId = state.document.id;
  const pageId = state.document.pageId;
  const [selectedTool, setSelectedTool] = useState<DrawingTool | 'shape'>("pen");
  const [shapeType, setShapeType] = useState<TeachingShapeType>('line');
  const [shapeColor, setShapeColor] = useState('#214f45');
  const [shapeWidth, setShapeWidth] = useState(4);
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [eraserWidth, setEraserWidth] = useState(18);
  const [isInteracting, setInteracting] = useState(false);
  const [selection, setSelection] = useState<SessionSnapshot['selection']>(restored?.snapshot.selection ?? null);
  const [saveStatus, setSaveStatus] = useState("Unsaved");
  const [storageChecked, setStorageChecked] = useState(Boolean(restored));
  const [persistenceEnabled, setPersistenceEnabled] = useState(false);
  const activatePersistence = useCallback(() => setPersistenceEnabled(true), []);
  const [persistence] = useState(() => new PersistenceController(
    serializeSession(session, identity, selection), setSaveStatus, undefined,
    import.meta.env.VITE_API_ENABLED === "true" ? api : undefined, restored, () => setStorageChecked(true)));
  useLayoutEffect(() => {
    if (!persistenceEnabled) return;
    // Only reducer/context changes schedule writes. Pointer drafts live outside this state.
    try { persistence.update(serializeSession(session, identity, selection)); }
    catch { persistence.invalid(); }
  }, [persistence, persistenceEnabled, session, identity, selection]);
  useEffect(() => {
    const flush = () => { void persistence.flush(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!persistence.hasUnsavedChanges) return;
      // Browsers do not await IndexedDB on unload. Offer Stay until the
      // transaction completes; forced exits and crashes cannot be guaranteed.
      flush();
      event.preventDefault();
      event.returnValue = '';
    };
    const visibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", flush);
    window.addEventListener("online", persistence.resume);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("online", persistence.resume);
      persistence.stop();
    };
  }, [persistence]);
  const setMode = useCallback((mode: TeachingMode) => dispatch({ type: "mode", mode }), []);
  const selectActivity = useCallback((id: string) => dispatch({ type: 'activity', id }), []);
  const updateActivity = useCallback((id: string, state: ActivityState) => dispatch({ type: 'activity-state', id, state }), []);
  const changePage = useCallback((action: PageAction) => { if (!isInteracting) dispatch({ type: 'page', action }); }, [isInteracting]);
  const commitStroke = useCallback((stroke: Stroke) =>
    dispatch({ type: "document", documentId, pageId, action: { type: "commit", stroke } }), [documentId, pageId]);
  const commitShape = useCallback((shape: TeachingShape) =>
    dispatch({ type: 'document', documentId, pageId, action: { type: 'commit-shape', shape } }), [documentId, pageId]);
  const undo = useCallback(() => dispatch({ type: "document", documentId, pageId, action: { type: "undo" } }), [documentId, pageId]);
  const redo = useCallback(() => dispatch({ type: "document", documentId, pageId, action: { type: "redo" } }), [documentId, pageId]);
  const clearCanvas = useCallback(() => dispatch({ type: "document", documentId, pageId, action: { type: "clear" } }), [documentId, pageId]);
  const flushBeforeLeave = useCallback(async () => {
    await persistence.flush();
    return persistence.canLeave;
  }, [persistence]);
  const value = useMemo(() => ({
    shapeType, shapeColor, shapeWidth, setShapeType, setShapeColor, setShapeWidth, commitShape,
    whiteboard: session.whiteboard, changePage,
    lesson: session.lesson, selectActivity, updateActivity,
    document: state.document, mode: session.mode, setMode, selectedTool, strokeColor, strokeWidth, eraserWidth, isInteracting,
    canUndo: state.past.length > 0, canRedo: state.future.length > 0,
    setSelectedTool, setStrokeColor, setStrokeWidth, setEraserWidth, setInteracting, flushBeforeLeave,
    commitStroke, undo, redo, clearCanvas, saveStatus, storageChecked, selection, setSelection, activatePersistence,
  }), [shapeType, shapeColor, shapeWidth, commitShape, state, session.whiteboard, changePage, session.mode, session.lesson, selectActivity, updateActivity, setMode, selectedTool, strokeColor, strokeWidth, eraserWidth, flushBeforeLeave, isInteracting, commitStroke, undo, redo, clearCanvas, saveStatus, storageChecked, selection, activatePersistence]);
  return <DrawingContext.Provider value={value}>{children}</DrawingContext.Provider>;
}
export default function DrawingProvider({ children }: { children: ReactNode }) {
  const { sessionId, selectedClass, selectedSubject, restored, lessonLaunch } = useClassroom();
  const identity = useMemo(() => restored?.snapshot.identity ?? ({
    id: sessionId, ...(lessonLaunch ? { lessonVersionId: lessonLaunch.version.id } : {}), context: {
      classId: lessonLaunch?.definition.classLevelId ?? classIds[selectedClass] ?? null, subjectId: lessonLaunch?.definition.subjectId ?? subjectIds[selectedSubject] ?? null,
      classLabel: selectedClass, subjectLabel: selectedSubject,
    },
  }), [sessionId, selectedClass, selectedSubject, restored, lessonLaunch]);
  return <SessionDrawingProvider key={sessionId} identity={identity} restored={restored} lessonVersion={lessonLaunch?.version} owner={{
    sessionId, classId: identity.context.classId, subjectId: identity.context.subjectId,
  }}>{children}</SessionDrawingProvider>;
}
