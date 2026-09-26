import { useCallback, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import type { DocumentOwner } from "../drawing/document";
import { activeDocument, createDrawingSession, sessionReducer, type TeachingMode } from "../drawing/session";
import type { DrawingTool, Stroke } from "../types/drawing";
import { DrawingContext } from "./drawing-context";
import { useClassroom } from "./useClassroom";
import { classIds, subjectIds } from "../persistence/catalog";
import { deserializeSession, serializeSession, type SessionSnapshot } from "../persistence/serialization";
import { PersistenceController } from "../persistence/controller";
import { api } from "../persistence/api";
import type { LocalRecord } from "../persistence/database";
import type { SessionIdentity } from "../../contracts";

function SessionDrawingProvider({ children, owner, identity, restored }: {
  children: ReactNode; owner: DocumentOwner; identity: SessionIdentity; restored?: LocalRecord;
}) {
  const [session, dispatch] = useReducer(sessionReducer, owner, initialOwner => restored
    ? deserializeSession(restored.snapshot) : createDrawingSession(initialOwner, {
      whiteboard: crypto.randomUUID(), annotation: crypto.randomUUID(),
    }));
  const state = activeDocument(session);
  const documentId = state.document.id;
  const [selectedTool, setSelectedTool] = useState<DrawingTool>("pen");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isInteracting, setInteracting] = useState(false);
  const [selection, setSelection] = useState<SessionSnapshot['selection']>(restored?.snapshot.selection ?? null);
  const [saveStatus, setSaveStatus] = useState("Unsaved");
  const [storageChecked, setStorageChecked] = useState(Boolean(restored));
  const [persistenceEnabled, setPersistenceEnabled] = useState(false);
  const activatePersistence = useCallback(() => setPersistenceEnabled(true), []);
  const [persistence] = useState(() => new PersistenceController(
    serializeSession(session, identity, selection), setSaveStatus, undefined,
    import.meta.env.VITE_API_ENABLED === "true" ? api : undefined, restored, () => setStorageChecked(true)));
  useEffect(() => {
    if (!persistenceEnabled) return;
    // Only reducer/context changes schedule writes. Pointer drafts live outside this state.
    try { persistence.update(serializeSession(session, identity, selection)); }
    catch { persistence.invalid(); }
  }, [persistence, persistenceEnabled, session, identity, selection]);
  useEffect(() => {
    const flush = () => { void persistence.flush(); };
    window.addEventListener("pagehide", flush);
    window.addEventListener("online", persistence.resume);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("online", persistence.resume);
      persistence.stop();
    };
  }, [persistence]);
  const setMode = useCallback((mode: TeachingMode) => dispatch({ type: "mode", mode }), []);
  const commitStroke = useCallback((stroke: Stroke) =>
    dispatch({ type: "document", documentId, action: { type: "commit", stroke } }), [documentId]);
  const undo = useCallback(() => dispatch({ type: "document", documentId, action: { type: "undo" } }), [documentId]);
  const redo = useCallback(() => dispatch({ type: "document", documentId, action: { type: "redo" } }), [documentId]);
  const clearCanvas = useCallback(() => dispatch({ type: "document", documentId, action: { type: "clear" } }), [documentId]);
  const value = useMemo(() => ({
    document: state.document, mode: session.mode, setMode, selectedTool, strokeColor, strokeWidth, isInteracting,
    canUndo: state.past.length > 0, canRedo: state.future.length > 0,
    setSelectedTool, setStrokeColor, setStrokeWidth, setInteracting,
    commitStroke, undo, redo, clearCanvas, saveStatus, storageChecked, selection, setSelection, activatePersistence,
  }), [state, session.mode, setMode, selectedTool, strokeColor, strokeWidth, isInteracting, commitStroke, undo, redo, clearCanvas, saveStatus, storageChecked, selection, activatePersistence]);
  return <DrawingContext.Provider value={value}>{children}</DrawingContext.Provider>;
}
export default function DrawingProvider({ children }: { children: ReactNode }) {
  const { sessionId, selectedClass, selectedSubject, restored } = useClassroom();
  const identity = useMemo(() => restored?.snapshot.identity ?? ({
    id: sessionId, context: {
      classId: classIds[selectedClass] ?? null, subjectId: subjectIds[selectedSubject] ?? null,
      classLabel: selectedClass, subjectLabel: selectedSubject,
    },
  }), [sessionId, selectedClass, selectedSubject, restored]);
  return <SessionDrawingProvider key={sessionId} identity={identity} restored={restored} owner={{
    sessionId, classId: identity.context.classId, subjectId: identity.context.subjectId,
  }}>{children}</SessionDrawingProvider>;
}
