import { useContext } from "react";
import { WorkspaceUIContext } from "./workspace-ui-context";

export default function useWorkspaceUI() {
  const context = useContext(WorkspaceUIContext);

  if (!context) {
    throw new Error(
      "useWorkspaceUI must be used inside WorkspaceUIProvider"
    );
  }

  return context;
}