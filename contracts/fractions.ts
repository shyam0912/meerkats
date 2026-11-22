import { z } from 'zod';

/** One common whole is four units. Canonical order: two halves, four quarters. */
export const FRACTION_WHOLE_UNITS = 4;
export const FRACTION_PIECE_UNITS = [2, 2, 1, 1, 1, 1] as const;
export const fractionLanes = ['top', 'bottom'] as const;
export type FractionLane = typeof fractionLanes[number];
export const fractionConfigSchema = z.strictObject({
  model: z.literal('equal-parts-bars-v1'),
  pieceIds: z.array(z.uuid()).length(6).refine(ids => new Set(ids).size === 6),
});
export const fractionPlacementSchema = z.strictObject({
  lane: z.enum(fractionLanes), start: z.number().int().min(0).max(3),
});
export type FractionPlacement = z.infer<typeof fractionPlacementSchema>;
export const fractionStateSchema = z.strictObject({
  kind: z.literal('fraction-board'),
  pieces: z.array(z.strictObject({ id: z.uuid(), placement: fractionPlacementSchema.nullable() })).length(6),
  language: z.enum(['en', 'ml']), showLabels: z.boolean(), showGuides: z.boolean(),
}).superRefine((state, ctx) => {
  if (new Set(state.pieces.map(p => p.id)).size !== 6)
    ctx.addIssue({ code: 'custom', message: 'Duplicate fraction piece identity' });
  const occupied = new Set<string>();
  state.pieces.forEach((piece, index) => {
    if (!piece.placement) return;
    const units = FRACTION_PIECE_UNITS[index];
    if (units === undefined || piece.placement.start + units > FRACTION_WHOLE_UNITS) {
      ctx.addIssue({ code: 'custom', message: 'Fraction piece outside its whole' }); return;
    }
    for (let slot = piece.placement.start; slot < piece.placement.start + units; slot++) {
      const key = `${piece.placement.lane}:${slot}`;
      if (occupied.has(key)) ctx.addIssue({ code: 'custom', message: 'Overlapping fraction pieces' });
      occupied.add(key);
    }
  });
});
export type FractionConfig = z.infer<typeof fractionConfigSchema>;
export type FractionState = z.infer<typeof fractionStateSchema>;

export function initialFractionState(config: FractionConfig): FractionState {
  const validated = fractionConfigSchema.parse(config);
  return { kind: 'fraction-board', pieces: validated.pieceIds.map(id => ({ id, placement: null })),
    language: 'en', showLabels: false, showGuides: true };
}
export function validFractionState(config: FractionConfig, value: unknown): value is FractionState {
  const definition = fractionConfigSchema.safeParse(config), state = fractionStateSchema.safeParse(value);
  return definition.success && state.success && state.data.pieces.every((piece, index) => piece.id === definition.data.pieceIds[index]);
}
/** For validated state only. Gaps are empty units, never counted as covered length. */
export function fractionOccupancy(state: FractionState, lane: FractionLane, excludeId?: string): boolean[] {
  const occupied = Array<boolean>(FRACTION_WHOLE_UNITS).fill(false);
  state.pieces.forEach((piece, index) => {
    if (piece.id === excludeId || piece.placement?.lane !== lane) return;
    for (let slot = piece.placement.start; slot < piece.placement.start + FRACTION_PIECE_UNITS[index]!; slot++) occupied[slot] = true;
  });
  return occupied;
}
export function fractionLaneUnits(state: FractionState, lane: FractionLane): number {
  return fractionOccupancy(state, lane).filter(Boolean).length;
}
export function canPlaceFraction(config: FractionConfig, state: FractionState, id: string, placement: FractionPlacement | null): boolean {
  if (!validFractionState(config, state)) return false;
  const index = config.pieceIds.indexOf(id);
  if (index < 0) return false;
  if (placement === null) return true;
  const target = fractionPlacementSchema.safeParse(placement);
  if (!target.success || target.data.start + FRACTION_PIECE_UNITS[index]! > FRACTION_WHOLE_UNITS) return false;
  const occupied = fractionOccupancy(state, target.data.lane, id);
  return occupied.slice(target.data.start, target.data.start + FRACTION_PIECE_UNITS[index]!).every(value => !value);
}
/** A completed valid placement changes one piece. Invalid/no-op requests preserve the exact state. */
export function placeFractionPiece(config: FractionConfig, state: FractionState, id: string, placement: FractionPlacement | null): FractionState {
  if (!canPlaceFraction(config, state, id, placement)) return state;
  const previous = state.pieces[config.pieceIds.indexOf(id)]!.placement;
  if (previous === null ? placement === null : placement !== null && previous.lane === placement.lane && previous.start === placement.start) return state;
  return { ...state, pieces: state.pieces.map(piece => piece.id === id
    ? { ...piece, placement: placement && { ...placement } } : piece) };
}
