import { createContext } from "react";

export interface ClassroomContextType {
  selectedClass: string;
  selectedSubject: string;

  setSelectedClass: (value: string) => void;
  setSelectedSubject: (value: string) => void;
}

export const ClassroomContext =
  createContext<ClassroomContextType | undefined>(
    undefined
  );