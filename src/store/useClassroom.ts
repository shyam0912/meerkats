import { useContext } from "react";
import { ClassroomContext } from "./classroom-context";

export function useClassroom() {
  const context = useContext(ClassroomContext);

  if (!context) {
    throw new Error(
      "useClassroom must be used inside ClassroomProvider"
    );
  }

  return context;
}