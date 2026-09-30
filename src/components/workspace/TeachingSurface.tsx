import { useEffect, useRef, useState } from "react";
import useDrawing from "../../store/useDrawing";
import { fitScene } from "../../drawing/scene";
import DrawingCanvas from "./DrawingCanvas";
import NeutralScene, { type DemoSelection } from "./NeutralScene";
import ActivityHost from '../../activities/ActivityHost';

export default function TeachingSurface({ selection, onSelect }: {
  selection: DemoSelection; onSelect: (value: DemoSelection) => void;
}) {
  const { document, mode, lesson, updateActivity } = useDrawing();
  const activity = lesson?.version.activities.find(a => a.id === lesson.progress.currentActivityId);
  const host = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setAvailable({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const fitted = fitScene(available, document.bounds);
  const isContent = mode !== "whiteboard";
  return <main className="teaching-area" aria-label="Teaching surface">
    <div className="surface-mode-label">
      <span className="mode-dot" />{mode === "whiteboard" ? "WHITEBOARD" : mode === "explore" ? lesson ? "CONTENT · EXPLORE" : "EXPLORE · TOUCH A SHAPE" : "ANNOTATE · DRAW OVER CONTENT"}
      <span>{mode === "explore" ? "Ink stays visible" : "Ink only · Pen or eraser"}</span>
    </div>
    <div ref={host} className="scene-viewport">
      {fitted.scale > 0 && <div className="fitted-scene" data-testid="fitted-scene"
        style={{ width: fitted.width, height: fitted.height }}>
        {isContent && <div className="content-layer" inert={mode === "annotate"}
          style={{ width: document.bounds.width, height: document.bounds.height, transform: `scale(${fitted.scale})` }}>
          {activity && lesson ? <ActivityHost activity={activity} state={lesson.progress.states[activity.id]!} onChange={state => updateActivity(activity.id, state)} />
            : <NeutralScene selection={selection} onSelect={onSelect} />}
        </div>}
        <DrawingCanvas key={document.id} enabled={mode !== "explore"} transparent={isContent} />
      </div>}
    </div>
  </main>;
}
