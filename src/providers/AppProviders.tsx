import type { ReactNode } from "react";

import { ClassroomProvider } from "../store/ClassroomProvider";
import  DrawingProvider  from "../store/DrawingProvider";

interface Props {
  children: ReactNode;
}

function AppProviders({ children }: Props) {
  return (
    <ClassroomProvider>
      <DrawingProvider>
        {children}
      </DrawingProvider>
    </ClassroomProvider>
  );
}

export default AppProviders;