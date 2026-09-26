import { createContext } from "react";
import type { LocalRecord } from "../persistence/database";

export interface ClassroomContextType {
  sessionId: string;
  restored?: LocalRecord;
  startQuickWorkspace: () => void;
  selectedClass: string;
  selectedSubject: string;

  setSelectedClass: (value: string) => void;
  setSelectedSubject: (value: string) => void;
}

export const ClassroomContext =
  createContext<ClassroomContextType | undefined>(
    undefined
  );
