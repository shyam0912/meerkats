import { useState, type ReactNode } from "react";
import {
  WorkspaceUIContext,
  type WorkspacePanel,
} from "./workspace-ui-context";

interface Props {
  children: ReactNode;
}

export default function WorkspaceUIProvider({
  children,
}: Props) {
  const [activePanel, setActivePanel] =
    useState<WorkspacePanel>(null);

  const [panelOpen, setPanelOpen] =
    useState(false);

  const openPanel = () => {
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setActivePanel(null);
  };

  const togglePanel = (
    panel: WorkspacePanel
  ) => {
    if (
      panelOpen &&
      activePanel === panel
    ) {
      closePanel();
      return;
    }

    setActivePanel(panel);
    openPanel();
  };

  return (
    <WorkspaceUIContext.Provider
      value={{
        activePanel,
        setActivePanel,

        panelOpen,

        openPanel,
        closePanel,

        togglePanel,
      }}
    >
      {children}
    </WorkspaceUIContext.Provider>
  );
}