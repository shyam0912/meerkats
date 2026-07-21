import { createContext } from "react";

export type WorkspacePanel =
  | "draw"
  | "lesson"
  | "media"
  | "math"
  | "science"
  | "ai"
  | null;

export interface WorkspaceUIContextType {
  activePanel: WorkspacePanel;

  setActivePanel: (panel: WorkspacePanel) => void;

  panelOpen: boolean;

  openPanel: () => void;

  closePanel: () => void;

  togglePanel: (panel: WorkspacePanel) => void;
}

export const WorkspaceUIContext =
  createContext<WorkspaceUIContextType | undefined>(
    undefined
  );