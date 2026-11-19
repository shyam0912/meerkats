import { z } from 'zod';

export const plantSlots = ['root', 'stem', 'leaf-left', 'leaf-right', 'flower'] as const;
export type PlantSlot = typeof plantSlots[number];
export const plantConfigSchema = z.strictObject({ model: z.literal('flowering-plant-parts-v1'),
  partIds: z.array(z.uuid()).length(5).refine(ids => new Set(ids).size === 5) });
export const plantStateSchema = z.strictObject({ kind: z.literal('plant-builder'),
  parts: z.array(z.strictObject({ id: z.uuid(), slot: z.enum(plantSlots).nullable() })).length(5),
  selectedPartId: z.uuid().nullable(), language: z.enum(['en', 'ml']), showLabels: z.boolean(),
  demonstration: z.enum(['water', 'light']).nullable(), water: z.enum(['available', 'limited']), light: z.enum(['daylight', 'no-light'])
}).superRefine((state, ctx) => {
  const occupied = state.parts.flatMap(p => p.slot ? [p.slot] : []);
  if (new Set(state.parts.map(p => p.id)).size !== 5 || new Set(occupied).size !== occupied.length ||
      (state.selectedPartId !== null && !state.parts.some(p => p.id === state.selectedPartId)) ||
      state.parts.some((p, i) => p.slot !== null && !acceptsPlantSlot(i, p.slot)))
    ctx.addIssue({ code: 'custom', message: 'Invalid plant identity or occupied/incompatible target' });
});
export type PlantConfig = z.infer<typeof plantConfigSchema>;
export type PlantState = z.infer<typeof plantStateSchema>;
export function acceptsPlantSlot(index: number, slot: PlantSlot) {
  return index === 2 || index === 3 ? slot === 'leaf-left' || slot === 'leaf-right' : plantSlots[index] === slot;
}
export function initialPlantState(config: PlantConfig): PlantState {
  return { kind: 'plant-builder', parts: config.partIds.map(id => ({ id, slot: null })), selectedPartId: null,
    language: 'en', showLabels: true, demonstration: null, water: 'available', light: 'daylight' };
}
export function validPlantState(config: PlantConfig, value: unknown): value is PlantState {
  const result = plantStateSchema.safeParse(value);
  return result.success && result.data.parts.every((p, i) => p.id === config.partIds[i]);
}
export function placePlantPart(state: PlantState, id: string, slot: PlantSlot | null): PlantState {
  const index = state.parts.findIndex(p => p.id === id);
  if (index < 0 || state.parts[index]!.slot === slot || (slot !== null &&
      (!acceptsPlantSlot(index, slot) || state.parts.some(p => p.id !== id && p.slot === slot)))) return state;
  return { ...state, selectedPartId: id, parts: state.parts.map(p => p.id === id ? { ...p, slot } : p) };
}
export function wholePlant(state: PlantState): PlantState {
  return { ...state, parts: state.parts.map((p, i) => ({ ...p, slot: plantSlots[i]! })) };
}
export const plantTargets: Record<PlantSlot, { x: number; y: number }> = {
  root: { x: 760, y: 510 }, stem: { x: 760, y: 342 }, 'leaf-left': { x: 650, y: 300 },
  'leaf-right': { x: 870, y: 365 }, flower: { x: 760, y: 178 },
};
/** A bounded snap radius; occupied targets never displace another part. */
export function plantDropTarget(state: PlantState, id: string, x: number, y: number): PlantSlot | null {
  const index = state.parts.findIndex(p => p.id === id);
  return plantSlots.filter(slot => acceptsPlantSlot(index, slot) && !state.parts.some(p => p.id !== id && p.slot === slot))
    .map(slot => ({ slot, distance: Math.hypot(x - plantTargets[slot].x, y - plantTargets[slot].y) }))
    .filter(p => p.distance <= 85).sort((a, b) => a.distance - b.distance)[0]?.slot ?? null;
}
