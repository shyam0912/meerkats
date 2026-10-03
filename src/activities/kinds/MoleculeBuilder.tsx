import type { CSSProperties } from 'react';
import type { ActivityProps } from '../registry';
import { branchPosition, hydrogenCount, type Molecule, type MoleculeState } from '../../../contracts/molecule';
import './molecule.css';

type Part = NonNullable<MoleculeState['focusPart']>;
const parts: { id: Part; label: string; value: string }[] = [
  { id: 'position', label: 'Position', value: '2-' }, { id: 'branch', label: 'Branch', value: 'methyl' },
  { id: 'parent', label: 'Parent root', value: 'but' }, { id: 'suffix', label: 'Suffix', value: 'ane' },
];
function Structure({ molecule: m, highlight = [], numbering, count = 5, hydrogens = false, bonds = false }: {
  molecule: Molecule; highlight?: string[]; numbering?: 'forward' | 'reverse'; count?: number; hydrogens?: boolean; bonds?: boolean;
}) {
  const visible = m.atoms.slice(0, count);
  const point = (id: string) => ({ x: 80 + m.layout[id]!.x * 840, y: 55 + m.layout[id]!.y * 260 });
  return <svg viewBox="0 0 1000 360" className="molecule-diagram" role="img" aria-label={`${m.id === 'pentane' ? 'Straight' : 'Branched'} carbon structure, ${count} carbon atoms visible`}>
    {m.bonds.filter(b => visible.some(a => a.id === b.from) && visible.some(a => a.id === b.to)).map(b => {
      const a = point(b.from); const z = point(b.to); const active = bonds || highlight.includes(b.from) && highlight.includes(b.to);
      return <line key={b.id} data-bond-id={b.id} x1={a.x} y1={a.y} x2={z.x} y2={z.y} className={active ? 'chemical-bond highlighted' : 'chemical-bond'} />;
    })}
    {visible.map(a => { const p = point(a.id); const selected = highlight.includes(a.id); const i = m.parentChain.indexOf(a.id);
      return <g key={a.id} data-atom-id={a.id} className={selected ? 'carbon selected' : 'carbon'}>
        <circle cx={p.x} cy={p.y} r={selected ? 49 : 44} />
        <text x={p.x} y={p.y + 13} textAnchor="middle">C{hydrogens && <>H<tspan baselineShift="sub" fontSize="24">{hydrogenCount(m, a.id) > 1 ? hydrogenCount(m, a.id) : ''}</tspan></>}</text>
        {numbering && i >= 0 && <g><rect x={p.x - 25} y={p.y - 91} width="50" height="40" rx="12" />
          <text x={p.x} y={p.y - 60} textAnchor="middle" className="carbon-number">{numbering === 'forward' ? i + 1 : m.parentChain.length - i}</text></g>}
      </g>;
    })}
  </svg>;
}

export default function MoleculeBuilder({ activity, state, onChange }: ActivityProps) {
  if (activity.kind !== 'molecule-builder' || state.kind !== 'molecule-builder') return null;
  const { config } = activity; const { stage } = config;
  const m = config.structures.find(s => s.id === state.structureId)!;
  const update = (patch: Partial<MoleculeState>) => onChange({ ...state, ...patch });
  const candidate = m.candidates.find(c => c.id === state.candidateId);
  const parentVisible = stage === 'numbering' || stage === 'branch' && state.revealed || stage === 'chain' && state.revealed;
  let highlight = parentVisible ? m.parentChain : candidate?.atoms ?? [];
  if (stage === 'branch' && state.revealed) highlight = [m.branchAtomId!];
  if (stage === 'name') highlight = state.focusPart === 'branch' ? [m.branchAtomId!] : state.focusPart === 'position' ? [m.parentChain[1]!] : state.focusPart === 'parent' ? m.parentChain : [];
  let caption = '';
  if (stage === 'discover') caption = `${state.visibleCount} of 5 carbons revealed`;
  if (stage === 'chain') caption = state.revealed ? '4 carbons in a longest chain · Paths B and C are equally long' : candidate ? `${candidate.label}: ${candidate.atoms.length} connected carbons` : 'Which path contains the most connected carbons?';
  if (stage === 'numbering') caption = state.revealed ? 'Choose the lower branch position: 2, not 3' : state.direction ? `Branch position: ${branchPosition(m, state.direction)}` : 'Choose an end to start numbering';
  if (stage === 'branch') caption = state.revealed ? 'One carbon in the branch · –CH₃ · methyl' : 'Which carbon lies outside the main chain?';
  if (stage === 'name') caption = state.nameParts.length === 4 ? '2-methylbutane' : 'Build the name, one structural feature at a time';
  if (stage === 'rearrange') caption = state.revealed ? 'Same formula: C₅H₁₂ · Different carbon connections' : '5 carbons · 12 hydrogens · Compare the connections';
  if (stage === 'isomers') caption = state.revealed ? 'Chain isomers · Same molecular formula, different carbon chains' : 'Same C₅H₁₂. Different chains. What is the relationship?';
  return <section className="chemistry-scene" aria-label={activity.title} data-stage={stage} data-structure={m.id}>
    <header><p className="chemistry-eyebrow">CHEMISTRY / CARBON CONNECTIONS</p><h2>{activity.title}</h2></header>
    <div className={`molecule-stage ${stage === 'isomers' ? 'comparison' : ''}`}>
      {stage === 'isomers' ? config.structures.map(structure => <div className="isomer-card" key={structure.id}>
        <p>{structure.branchAtomId ? 'Branched chain' : 'Straight chain'} <strong>C₅H₁₂</strong></p>
        <Structure molecule={structure} hydrogens />
        <span>{state.revealed ? structure.branchAtomId ? '2-methylbutane' : 'pentane' : 'Compare the carbon connections'}</span>
      </div>) : <Structure molecule={m} highlight={highlight} count={stage === 'discover' ? state.visibleCount : 5}
        numbering={stage === 'numbering' ? state.direction ?? undefined : stage === 'name' && state.focusPart === 'position' ? 'forward' : undefined}
        hydrogens={stage === 'rearrange' || stage === 'branch' && state.revealed} bonds={stage === 'name' && state.focusPart === 'suffix'} />}
    </div>
    <div className="chemistry-controls" style={{ '--control-count': stage === 'name' || stage === 'chain' ? 4 : stage === 'numbering' || stage === 'rearrange' ? 3 : 1 } as CSSProperties}>
      {stage === 'discover' && <button disabled={state.visibleCount === 5} onClick={() => update({ visibleCount: state.visibleCount + 1 })}>Reveal next carbon <small>{state.visibleCount} / 5</small></button>}
      {stage === 'chain' && <>{m.candidates.map(c => <button key={c.id} aria-pressed={state.candidateId === c.id && !state.revealed}
        onClick={() => update({ candidateId: c.id, revealed: false })}>{c.label}<small>Trace this chain</small></button>)}
        <button aria-pressed={state.revealed} onClick={() => update({ revealed: !state.revealed })}>Reveal longest<small>Compare your paths</small></button></>}
      {stage === 'numbering' && <>{(['forward', 'reverse'] as const).map(direction => <button key={direction} aria-pressed={state.direction === direction}
        onClick={() => update({ direction, revealed: false })}>{direction === 'forward' ? 'Left → right' : 'Right → left'}<small>Start counting here</small></button>)}
        <button aria-pressed={state.revealed} onClick={() => update({ revealed: !state.revealed })}>Compare positions<small>2 versus 3</small></button></>}
      {stage === 'branch' && <button aria-pressed={state.revealed} onClick={() => update({ revealed: !state.revealed })}>{state.revealed ? 'Hide branch name' : 'Reveal branch'}<small>Parent chain + branch</small></button>}
      {stage === 'name' && parts.map(part => <button key={part.id} aria-label={`Name part: ${part.label}`} aria-pressed={state.focusPart === part.id}
        onClick={() => update({ focusPart: part.id, nameParts: state.nameParts.includes(part.id) ? state.nameParts : [...state.nameParts, part.id] })}>
        {state.nameParts.includes(part.id) ? part.value : '···'}<small>{part.label}</small></button>)}
      {stage === 'rearrange' && <>{config.structures.map(s => <button key={s.id} aria-pressed={state.structureId === s.id}
        onClick={() => update({ structureId: s.id })}>{s.branchAtomId ? 'Branched chain' : 'Straight chain'}<small>Same five carbons</small></button>)}
        <button aria-pressed={state.revealed} onClick={() => update({ revealed: !state.revealed })}>Compare formula<small>What stays the same?</small></button></>}
      {stage === 'isomers' && <button aria-pressed={state.revealed} onClick={() => update({ revealed: !state.revealed })}>{state.revealed ? 'Hide concept' : 'Reveal the relationship'}<small>Explain what you notice</small></button>}
    </div>
    <p className={`chemistry-caption ${stage === 'name' && state.nameParts.length === 4 ? 'complete-name' : ''}`} aria-live="polite">{caption}</p>
    <p className="chemistry-note">{stage === 'rearrange' || stage === 'isomers' ? 'Compare structures, not a chemical reaction. Hydrogen counts complete carbon valency.' : 'Carbon skeleton · Each C is one carbon atom. Hydrogens are omitted unless shown.'}</p>
  </section>;
}
