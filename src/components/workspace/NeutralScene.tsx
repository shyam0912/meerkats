import type { CSSProperties } from "react";

export type DemoSelection = "circle" | "triangle" | "square" | null;
const shapes = [
  { id: "circle", label: "Circle", x: 160, color: "#087f8c", description: "One continuous curved edge." },
  { id: "triangle", label: "Triangle", x: 490, color: "#bb6628", description: "Three sides. Three corners." },
  { id: "square", label: "Square", x: 820, color: "#6757a5", description: "Four equal sides. Four corners." },
] as const;

export default function NeutralScene({ selection, onSelect }: {
  selection: DemoSelection; onSelect: (value: DemoSelection) => void;
}) {
  const selected = shapes.find((shape) => shape.id === selection);
  return <div className="neutral-scene" aria-label="Interactive shape diagram">
    <div className="scene-intro"><span>INTERACTIVE DEMO</span><h2>Shape studio</h2>
      <p>Select a shape to explore. Annotate to add your own marks.</p></div>
    <svg className="scene-connectors" viewBox="0 0 1200 675" aria-hidden="true">
      <path d="M280 368 H940" fill="none" stroke="#dce4e4" strokeWidth="3" strokeDasharray="8 10" />
    </svg>
    {shapes.map((shape) => <button key={shape.id} aria-label={shape.label}
      aria-pressed={selection === shape.id} onClick={() => onSelect(selection === shape.id ? null : shape.id)}
      className="scene-shape" style={{ left: shape.x, "--shape-color": shape.color } as CSSProperties}>
      <svg viewBox="0 0 240 210" aria-hidden="true">
        {shape.id === "circle" ? <circle cx="120" cy="105" r="74" /> :
          shape.id === "triangle" ? <path d="M120 22 L210 182 H30 Z" /> :
            <rect x="46" y="31" width="148" height="148" rx="4" />}
      </svg>
      <span>{shape.label}</span>
    </button>)}
    <div className="scene-detail" aria-live="polite">
      <span>{selected ? selected.label.toUpperCase() : "TRY IT"}</span>
      <p>{selected ? selected.description : "Choose any of the three shapes."}</p>
    </div>
    <span className="scene-footnote">Original demonstration fixture · No curriculum assigned</span>
  </div>;
}
