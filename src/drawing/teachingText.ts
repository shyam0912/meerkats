import { teachingTextSchema, type TeachingText } from '../../contracts';
import type { Point } from './tools/InkTool';

export const BOARD_FONT = 'Meerkats Malayalam';
let loading: Promise<void> | undefined;
export function ensureBoardFont(): Promise<void> {
  if (!loading) loading = (async () => {
    const font = new FontFace(BOARD_FONT, `url("${import.meta.env.BASE_URL}fonts/NotoSansMalayalam.ttf")`, { weight: '400' });
    await font.load(); window.document.fonts.add(font);
  })().catch(error => { loading = undefined; throw error; });
  return loading;
}

/** Shape complete lines in the browser. No code-unit splitting, wrapping or normalization. */
export function drawTeachingText(ctx: CanvasRenderingContext2D, text: TeachingText) {
  ctx.save(); ctx.font = `400 ${text.fontSize}px "${BOARD_FONT}"`; ctx.fillStyle = text.color;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.direction = 'ltr';
  const padding = text.fontSize * .4;
  text.text.split('\n').forEach((line, index) => ctx.fillText(line, text.origin.x + padding,
    text.origin.y + text.fontSize * (1.35 + index * 1.8)));
  ctx.restore();
}
export function layoutText(value: TeachingText): TeachingText {
  const ctx = window.document.createElement('canvas').getContext('2d');
  if (!ctx) throw new Error('Text measurement is unavailable.');
  ctx.font = `400 ${value.fontSize}px "${BOARD_FONT}"`;
  const lines = value.text.split('\n');
  const width = Math.max(1, ...lines.map(line => { const m = ctx.measureText(line); return Math.max(m.width, m.actualBoundingBoxRight) + Math.max(0, m.actualBoundingBoxLeft); })) + value.fontSize * .8;
  const height = lines.length * value.fontSize * 1.8;
  const next = { ...value, size: { width, height }, origin: {
    x: Math.max(0, Math.min(value.origin.x, 1200 - width)), y: Math.max(0, Math.min(value.origin.y, 675 - height)),
  } };
  if (!teachingTextSchema.safeParse(next).success) throw new Error('Text must fit this page: use shorter lines, fewer lines or a smaller font (up to 4,096 characters / 24 lines).');
  return next;
}
export function hitText(text: TeachingText, point: Point) {
  return point.x >= text.origin.x && point.x <= text.origin.x + text.size.width && point.y >= text.origin.y && point.y <= text.origin.y + text.size.height;
}
export function moveText(text: TeachingText, delta: Point): TeachingText {
  return { ...text, origin: { x: Math.max(0, Math.min(1200 - text.size.width, text.origin.x + delta.x)),
    y: Math.max(0, Math.min(675 - text.size.height, text.origin.y + delta.y)) } };
}
export class TextMoveInteraction {
  private active: { id: number; original: TeachingText; start: Point } | null = null;
  draft: TeachingText | null = null;
  get pointerId() { return this.active?.id ?? null; }
  begin(id: number, original: TeachingText, start: Point) {
    if (this.active) return false;
    this.active = { id, original, start }; this.draft = original; return true;
  }
  move(id: number, point: Point) {
    if (this.active?.id !== id) return;
    this.draft = moveText(this.active.original, { x: point.x - this.active.start.x, y: point.y - this.active.start.y });
  }
  complete(id: number, point: Point) {
    if (this.active?.id !== id) return null;
    this.move(id, point); const result = this.draft; const original = this.active.original; this.cancel();
    return JSON.stringify(result) === JSON.stringify(original) ? null : result;
  }
  cancel() { this.active = null; this.draft = null; }
}
