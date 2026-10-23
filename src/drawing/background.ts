import type { PageBackground } from '../../contracts';
export const PAPER_MARK = '#b8c9c5';
export function backgroundMarks(background: PageBackground = 'white') {
  const lines: number[][] = []; const dots: { x: number; y: number }[] = [];
  if (background === 'lined' || background === 'grid') for (let y = 40; y < 675; y += 40) lines.push([0, y, 1200, y]);
  if (background === 'grid') for (let x = 40; x < 1200; x += 40) lines.push([x, 0, x, 675]);
  if (background === 'dotted') for (let x = 40; x < 1200; x += 40) for (let y = 40; y < 675; y += 40) dots.push({ x, y });
  return { lines, dots };
}
