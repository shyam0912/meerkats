import { useState, type ReactNode } from "react";
import { ClassroomContext } from "./classroom-context";

export function ClassroomProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");

  return (
    <ClassroomContext.Provider
      value={{
        selectedClass,
        selectedSubject,
        setSelectedClass,
        setSelectedSubject,
      }}
    >
      {children}
    </ClassroomContext.Provider>
  );
}