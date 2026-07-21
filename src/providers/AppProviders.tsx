import type { ReactNode } from "react";

import { ClassroomProvider } from "../store/ClassroomProvider";
import DrawingProvider from "../store/DrawingProvider";
import WorkspaceUIProvider from "../store/workspaceUIProvider";

interface Props {
  children: ReactNode;
}

function AppProviders({ children }: Props) {
  return (
    <ClassroomProvider>
      <WorkspaceUIProvider>
        <DrawingProvider>
          {children}
        </DrawingProvider>
      </WorkspaceUIProvider>
    </ClassroomProvider>
  );
}

export default AppProviders;