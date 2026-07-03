import { workspaceCanvas } from "../../../data/workspaceCanvas";
import DrawingCanvas from "../../workspace/DrawingCanvas";

function WorkspaceViewer() {


  return (
    <div className="h-full flex flex-col">

      <h1 className="text-4xl font-bold mb-4">
        {workspaceCanvas.title}
      </h1>

      <p className="text-lg text-slate-600 mb-8">
        {workspaceCanvas.description}
      </p>

      <DrawingCanvas />

    </div>
  );
}

export default WorkspaceViewer;