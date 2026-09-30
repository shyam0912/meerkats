import { createContext } from "react";
import type { LocalRecord } from "../persistence/database";
import type { LessonVersion, LessonDefinition } from '../../contracts/lesson';

export interface ClassroomContextType {
  sessionId: string;
  restored?: LocalRecord;
  lessonLaunch?: { version: LessonVersion; definition: LessonDefinition; classLabel: string; subjectLabel: string };
  launchLesson: (version: LessonVersion, definition: LessonDefinition, classLabel: string, subjectLabel: string) => void;
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
