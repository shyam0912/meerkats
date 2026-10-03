import { z } from 'zod';

const key = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
const path = z.array(key).min(2).max(8);
export const namePartSchema = z.enum(['position', 'branch', 'parent', 'suffix']);
export const moleculeStateSchema = z.strictObject({ kind: z.literal('molecule-builder'),
  structureId: key, visibleCount: z.number().int().min(1).max(8), candidateId: key.nullable(),
  direction: z.enum(['forward', 'reverse']).nullable(), revealed: z.boolean(),
  nameParts: z.array(namePartSchema).max(4).refine(v => new Set(v).size === v.length),
  focusPart: namePartSchema.nullable() });
export type MoleculeState = z.infer<typeof moleculeStateSchema>;

const structureBase = z.strictObject({ id: key,
  atoms: z.array(z.strictObject({ id: key, element: z.literal('C') })).min(2).max(8),
  bonds: z.array(z.strictObject({ id: key, from: key, to: key, order: z.literal(1) })).min(1).max(7),
  // Layout is presentation data, never atom identity or chemical connectivity.
  layout: z.record(key, z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })),
  parentChain: path, branchAtomId: key.nullable(),
  candidates: z.array(z.strictObject({ id: key, label: z.string().min(1).max(30), atoms: path })).max(4),
});
export type Molecule = z.infer<typeof structureBase>;
export function neighbors(m: Molecule, atom: string): string[] {
  return m.bonds.flatMap(b => b.from === atom ? [b.to] : b.to === atom ? [b.from] : []);
}
export function continuous(m: Molecule, atoms: string[]): boolean {
  return new Set(atoms).size === atoms.length && atoms.every((a, i) => m.atoms.some(v => v.id === a) &&
    (i === 0 || neighbors(m, a).includes(atoms[i - 1]!)));
}
export function longestLength(m: Molecule): number {
  const walk = (id: string, visited: string[]): number => Math.max(visited.length,
    ...neighbors(m, id).filter(n => !visited.includes(n)).map(n => walk(n, [...visited, n])));
  return Math.max(...m.atoms.map(a => walk(a.id, [a.id])));
}
export function hydrogenCount(m: Molecule, atom: string): number { return 4 - neighbors(m, atom).length; }
export function formula(m: Molecule): string { return `C${m.atoms.length}H${m.atoms.reduce((n, a) => n + hydrogenCount(m, a.id), 0)}`; }
// Canonical tree signature ignores IDs/layout: used only for these bounded acyclic structures.
export function topology(m: Molecule): string {
  const root = (id: string, previous = ''): string => `(${neighbors(m, id).filter(n => n !== previous).map(n => root(n, id)).sort().join('')})`;
  return m.atoms.map(a => root(a.id)).sort()[0]!;
}
export function branchPosition(m: Molecule, direction: 'forward' | 'reverse'): number {
  const attachment = m.branchAtomId ? neighbors(m, m.branchAtomId)[0] : undefined;
  const index = m.parentChain.indexOf(attachment ?? '');
  return index < 0 ? 0 : direction === 'forward' ? index + 1 : m.parentChain.length - index;
}
export const moleculeSchema = structureBase.superRefine((m, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  const ids = new Set(m.atoms.map(a => a.id));
  if (ids.size !== m.atoms.length || new Set(m.bonds.map(b => b.id)).size !== m.bonds.length) fail('Duplicate atom or bond identity');
  if (Object.keys(m.layout).length !== ids.size || [...ids].some(id => !m.layout[id])) fail('Layout must cover exactly the atoms');
  if (m.bonds.some(b => !ids.has(b.from) || !ids.has(b.to) || b.from === b.to) ||
    new Set(m.bonds.map(b => [b.from, b.to].sort().join('/'))).size !== m.bonds.length) { fail('Invalid bond endpoints'); return; }
  const seen = new Set<string>();
  const visit = (id: string) => { if (seen.has(id)) return; seen.add(id); neighbors(m, id).forEach(visit); };
  visit(m.atoms[0]!.id);
  if (seen.size !== ids.size || m.bonds.length !== ids.size - 1 || m.atoms.some(a => neighbors(m, a.id).length > 4)) {
    fail('Only connected acyclic saturated carbon structures are supported'); return;
  }
  if (!continuous(m, m.parentChain) || m.parentChain.length !== longestLength(m)) fail('Parent chain must be a longest continuous path');
  const outside = m.atoms.filter(a => !m.parentChain.includes(a.id));
  if (m.branchAtomId === null ? outside.length !== 0 : outside.length !== 1 || outside[0]?.id !== m.branchAtomId || neighbors(m, m.branchAtomId).length !== 1)
    fail('This lesson supports an unbranched chain or one methyl branch');
  if (new Set(m.candidates.map(c => c.id)).size !== m.candidates.length || m.candidates.some(c => !continuous(m, c.atoms))) fail('Invalid candidate chain');
});

export const moleculeConfigSchema = z.strictObject({
  stage: z.enum(['discover', 'chain', 'numbering', 'branch', 'name', 'rearrange', 'isomers']),
  structures: z.array(moleculeSchema).min(1).max(2),
}).superRefine((config, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  const { structures, stage } = config;
  if (new Set(structures.map(m => m.id)).size !== structures.length) fail('Duplicate structure identity');
  // Phase 5 is deliberately a C5H12 lesson, not a general nomenclature engine.
  if (structures.some(m => m.atoms.length !== 5 || formula(m) !== 'C5H12')) fail('Reference lesson requires C5H12');
  if (stage === 'rearrange' || stage === 'isomers') {
    if (structures.length !== 2 || structures[0]?.branchAtomId !== null || !structures[1]?.branchAtomId ||
      structures[0].atoms.map(a => a.id).sort().join() !== structures[1].atoms.map(a => a.id).sort().join()) fail('Isomer pair requires stable carbon identities and different chain structures');
    // All molecules must pass graph validation before recursion.
    if (structures.every(m => moleculeSchema.safeParse(m).success) && structures.length === 2 && topology(structures[0]!) === topology(structures[1]!)) fail('Arrangements must be different chain isomers');
  } else {
    if (structures.length !== 1) fail('This step requires one structure');
    if (stage === 'discover' ? structures[0]?.branchAtomId !== null : !structures[0]?.branchAtomId) fail('Incorrect structure for teaching step');
    if (stage === 'chain' && (!structures[0]?.candidates.some(c => c.atoms.length === 4) || !structures[0]?.candidates.some(c => c.atoms.length < 4))) fail('Chain step needs a shorter and a longest candidate');
  }
});
export type MoleculeConfig = z.infer<typeof moleculeConfigSchema>;
export function initialMoleculeState(config: MoleculeConfig): MoleculeState {
  return { kind: 'molecule-builder', structureId: config.structures[0]!.id,
    visibleCount: config.stage === 'discover' ? 1 : 5, candidateId: null, direction: null,
    revealed: false, nameParts: [], focusPart: null };
}
export function validMoleculeState(config: MoleculeConfig, state: MoleculeState): boolean {
  if (!moleculeStateSchema.safeParse(state).success) return false;
  const m = config.structures.find(v => v.id === state.structureId);
  if (!m || state.visibleCount > m.atoms.length) return false;
  const stage = config.stage;
  return (stage === 'discover' || state.visibleCount === 5) &&
    (state.candidateId === null || stage === 'chain' && m.candidates.some(c => c.id === state.candidateId)) &&
    (state.direction === null || stage === 'numbering') &&
    (!state.revealed || ['chain', 'numbering', 'branch', 'rearrange', 'isomers'].includes(stage)) &&
    (stage === 'name' || state.nameParts.length === 0 && state.focusPart === null) &&
    (state.focusPart === null || state.nameParts.includes(state.focusPart));
}
