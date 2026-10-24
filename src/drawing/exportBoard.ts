import Konva from 'konva';
import type { DrawingDocument } from './document';
import { backgroundMarks, PAPER_MARK } from './background';
import { shapePath } from './teachingShapes';

/** Replays committed content at logical resolution. No editor DOM or live draft is captured. */
export async function exportBoardPng(document: DrawingDocument, pixelRatio = 2): Promise<Blob> {
  const container = window.document.createElement('div');
  const stage = new Konva.Stage({ container, width: document.bounds.width, height: document.bounds.height });
  try {
    const paper = new Konva.Layer({ listening: false });
    paper.add(new Konva.Rect({ width: document.bounds.width, height: document.bounds.height, fill: '#ffffff' }));
    const marks = backgroundMarks(document.background);
    for (const points of marks.lines) paper.add(new Konva.Line({ points, stroke: PAPER_MARK, strokeWidth: 1, listening: false }));
    for (const dot of marks.dots) paper.add(new Konva.Circle({ ...dot, radius: 1.5, fill: PAPER_MARK, listening: false }));
    stage.add(paper);
    const ink = new Konva.Layer({ listening: false });
    for (const stroke of document.objects) {
      const common = { listening: false, globalCompositeOperation: stroke.tool === 'eraser' ? 'destination-out' as const : 'source-over' as const };
      ink.add(stroke.points.length === 2
        ? new Konva.Circle({ ...common, x: stroke.points[0], y: stroke.points[1], radius: stroke.width / 2, fill: stroke.color })
        : new Konva.Line({ ...common, points: [...stroke.points], stroke: stroke.color, strokeWidth: stroke.width,
          tension: .5, lineCap: 'round', lineJoin: 'round' }));
    }
    stage.add(ink);
    const shapes = new Konva.Layer({ listening: false });
    for (const shape of document.shapes ?? []) shapes.add(new Konva.Path({ data: shapePath(shape), stroke: shape.color,
      strokeWidth: shape.width, lineCap: 'round', lineJoin: 'round', listening: false }));
    stage.add(shapes); stage.draw();
    const canvas = stage.toCanvas({ pixelRatio });
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png'));
  } finally { stage.destroy(); container.remove(); }
}

export function downloadBoard(blob: Blob, documentId: string) {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url; link.download = `Meerkats-board-${documentId.slice(0, 8)}.png`;
  window.document.body.append(link); link.click(); link.remove();
  // Give the browser time to accept the download before releasing its blob URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
