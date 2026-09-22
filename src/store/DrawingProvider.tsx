import { useCallback, useMemo, useReducer, useState, type ReactNode } from "react";
import type { DocumentOwner } from "../drawing/document";
import { activeDocument, createDrawingSession, sessionReducer, type TeachingMode } from "../drawing/session";
import type { DrawingTool, Stroke } from "../types/drawing";
import { DrawingContext } from "./drawing-context";
import { useClassroom } from "./useClassroom";

function SessionDrawingProvider({ children, owner }: { children: ReactNode; owner: DocumentOwner }) {
  const [session, dispatch] = useReducer(sessionReducer, owner,
    (initialOwner) => createDrawingSession(initialOwner, {
      whiteboard: crypto.randomUUID(), annotation: crypto.randomUUID(),
    }));
  const state = activeDocument(session);
  const documentId = state.document.id;
  const [selectedTool, setSelectedTool] = useState<DrawingTool>("pen");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isInteracting, setInteracting] = useState(false);
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
    commitStroke, undo, redo, clearCanvas,
  }), [state, session.mode, setMode, selectedTool, strokeColor, strokeWidth, isInteracting, commitStroke, undo, redo, clearCanvas]);
  return <DrawingContext.Provider value={value}>{children}</DrawingContext.Provider>;
}
export default function DrawingProvider({ children }: { children: ReactNode }) {
  const { sessionId, selectedClass, selectedSubject } = useClassroom();
  return <SessionDrawingProvider key={sessionId} owner={{
    sessionId, classId: selectedClass || null, subjectId: selectedSubject || null,
  }}>{children}</SessionDrawingProvider>;
}
