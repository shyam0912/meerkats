import { useState, type ReactNode } from "react";
import { ClassroomContext } from "./classroom-context";

export function ClassroomProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());

  return (
    <ClassroomContext.Provider
      value={{
        selectedClass,
        selectedSubject,
        sessionId,
        setSelectedClass: (value) => {
          setSelectedClass(value);
          setSelectedSubject("");
          setSessionId(crypto.randomUUID());
        },
        setSelectedSubject: (value) => {
          setSelectedSubject(value);
          setSessionId(crypto.randomUUID());
        },
        startQuickWorkspace: () => {
          setSelectedClass("");
          setSelectedSubject("");
          setSessionId(crypto.randomUUID());
        },
      }}
    >
      {children}
    </ClassroomContext.Provider>
  );
}
