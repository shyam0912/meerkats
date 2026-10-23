import { backgroundMarks, PAPER_MARK } from '../../drawing/background';
import type { PageBackground as Background } from '../../../contracts';
export default function PageBackground({ background }: { background?: Background }) {
  const marks = backgroundMarks(background);
  return <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 1200 675">
    {marks.lines.map((p, i) => <line key={i} x1={p[0]} y1={p[1]} x2={p[2]} y2={p[3]} stroke={PAPER_MARK} strokeWidth="1" />)}
    {marks.dots.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="1.5" fill={PAPER_MARK} />)}
  </svg>;
}
