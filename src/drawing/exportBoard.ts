import Konva from 'konva';
import type { DrawingDocument } from './document';

/** Replays committed ink only, at logical resolution. No editor DOM or live draft is captured. */
export async function exportBoardPng(document: DrawingDocument): Promise<Blob> {
  const container = window.document.createElement('div');
  const stage = new Konva.Stage({ container, width: document.bounds.width, height: document.bounds.height });
  try {
    const paper = new Konva.Layer({ listening: false });
    paper.add(new Konva.Rect({ width: document.bounds.width, height: document.bounds.height, fill: '#ffffff' }));
    stage.add(paper);
    const ink = new Konva.Layer({ listening: false });
    for (const stroke of document.objects) {
      const common = { listening: false, globalCompositeOperation: stroke.tool === 'eraser' ? 'destination-out' as const : 'source-over' as const };
      ink.add(stroke.points.length === 2
        ? new Konva.Circle({ ...common, x: stroke.points[0], y: stroke.points[1], radius: stroke.width / 2, fill: stroke.color })
        : new Konva.Line({ ...common, points: [...stroke.points], stroke: stroke.color, strokeWidth: stroke.width,
          tension: .5, lineCap: 'round', lineJoin: 'round' }));
    }
    stage.add(ink); stage.draw();
    const canvas = stage.toCanvas({ pixelRatio: 2 });
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
