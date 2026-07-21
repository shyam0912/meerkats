import useWorkspaceUI from "../../store/useWorkspaceUI";
import DrawPanel from "./panels/DrawPanel";

function FloatingPanel() {
  const {
    panelOpen,
    activePanel,
    closePanel,
  } = useWorkspaceUI();

  if (!panelOpen || !activePanel) {
    return null;
  }

  const renderContent = () => {
    switch (activePanel) {
      case "draw":
        return <DrawPanel />;

      case "lesson":
        return (
          <div className="text-slate-500 text-center py-10">
            Lesson panel coming soon...
          </div>
        );

      case "media":
        return (
          <div className="text-slate-500 text-center py-10">
            Media panel coming soon...
          </div>
        );

      case "math":
        return (
          <div className="text-slate-500 text-center py-10">
            Math panel coming soon...
          </div>
        );

      case "science":
        return (
          <div className="text-slate-500 text-center py-10">
            Science panel coming soon...
          </div>
        );

      case "ai":
        return (
          <div className="text-slate-500 text-center py-10">
            AI panel coming soon...
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="
        absolute
        left-28
        top-6
        z-50
        w-96
        rounded-3xl
        bg-white
        shadow-2xl
        border
        border-slate-200
        overflow-hidden
      "
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
        <h2 className="text-xl font-semibold capitalize">
          {activePanel}
        </h2>

        <button
          onClick={closePanel}
          className="text-slate-500 hover:text-red-500 text-xl"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
}

export default FloatingPanel;