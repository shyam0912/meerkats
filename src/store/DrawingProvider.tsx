import { useCallback, useMemo, useReducer, useState, type ReactNode } from "react";
import { createDocument, documentReducer, type DocumentOwner } from "../drawing/document";
import type { DrawingTool, Stroke } from "../types/drawing";
import { DrawingContext } from "./drawing-context";
import { useClassroom } from "./useClassroom";

function SessionDrawingProvider({ children, owner }: { children: ReactNode; owner: DocumentOwner }) {
  const [state, dispatch] = useReducer(documentReducer, owner,
    (initialOwner) => createDocument(initialOwner, crypto.randomUUID()));
  const [selectedTool, setSelectedTool] = useState<DrawingTool>("pen");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isInteracting, setInteracting] = useState(false);
  const commitStroke = useCallback((stroke: Stroke) => dispatch({ type: "commit", stroke }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const clearCanvas = useCallback(() => dispatch({ type: "clear" }), []);
  const value = useMemo(() => ({
    document: state.document, selectedTool, strokeColor, strokeWidth, isInteracting,
    canUndo: state.past.length > 0, canRedo: state.future.length > 0,
    setSelectedTool, setStrokeColor, setStrokeWidth, setInteracting,
    commitStroke, undo, redo, clearCanvas,
  }), [state, selectedTool, strokeColor, strokeWidth, isInteracting, commitStroke, undo, redo, clearCanvas]);
  return <DrawingContext.Provider value={value}>{children}</DrawingContext.Provider>;
}

export default function DrawingProvider({ children }: { children: ReactNode }) {
  const { sessionId, selectedClass, selectedSubject } = useClassroom();
  return (
    <SessionDrawingProvider key={sessionId} owner={{
      sessionId, classId: selectedClass || null, subjectId: selectedSubject || null,
    }}>
      {children}
    </SessionDrawingProvider>
  );
}
