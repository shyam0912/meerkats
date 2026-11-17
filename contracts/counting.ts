import { z } from 'zod';

export const COUNTER_RADIUS = 60;
// A little overlap is allowed; every resting counter retains a clear visible area.
export const COUNTER_SEPARATION = 100;
export const countingConfigSchema = z.strictObject({ model: z.literal('quantity-conservation-v1'),
  counterIds: z.array(z.uuid()).length(10).refine(ids => new Set(ids).size === 10), initialQuantity: z.literal(5) });
export const counterSchema = z.strictObject({ id: z.uuid(), x: z.number().finite().min(72).max(1128),
  y: z.number().finite().min(132).max(603) });
export const countingStateSchema = z.strictObject({ kind: z.literal('counting-board'), quantity: z.number().int().min(1).max(10),
  counters: z.array(counterSchema).min(1).max(10), showCount: z.boolean(), language: z.enum(['en', 'ml']),
  countingHelp: z.boolean(), counted: z.number().int().min(0).max(10) }).superRefine((state, ctx) => {
  if (state.counters.length !== state.quantity || new Set(state.counters.map(c => c.id)).size !== state.quantity ||
      state.counted > state.quantity || (!state.countingHelp && state.counted !== 0) ||
      state.counters.some((c, i) => state.counters.slice(i + 1).some(other => Math.hypot(c.x - other.x, c.y - other.y) < COUNTER_SEPARATION - .001)))
    ctx.addIssue({ code: 'custom', message: 'Invalid quantity, counting assistance or counter placement' });
});
export type CountingConfig = z.infer<typeof countingConfigSchema>;
export type CountingState = z.infer<typeof countingStateSchema>;
export type Counter = z.infer<typeof counterSchema>;
export function arrangeCounters(config: CountingConfig, quantity: number): Counter[] {
  return config.counterIds.slice(0, quantity).map((id, i) => {
    const rowLength = quantity <= 5 ? quantity : i < 5 ? 5 : quantity - 5;
    return { id, x: 600 + ((i % 5) - (rowLength - 1) / 2) * 190, y: quantity <= 5 ? 360 : i < 5 ? 260 : 470 };
  });
}
export function initialCountingState(config: CountingConfig): CountingState {
  return { kind: 'counting-board', quantity: 5, counters: arrangeCounters(config, 5), showCount: false,
    language: 'en', countingHelp: false, counted: 0 };
}
export function validCountingState(config: CountingConfig, state: unknown): state is CountingState {
  const parsed = countingStateSchema.safeParse(state);
  return parsed.success && parsed.data.counters.every((counter, i) => counter.id === config.counterIds[i]);
}
/** Only the chosen counter changes. Invalid drops retain the last valid preview. */
export function placeCounter(state: CountingState, id: string, x: number, y: number): CountingState {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return state;
  const counter = state.counters.find(c => c.id === id); if (!counter) return state;
  const point = { x: Math.round(Math.max(72, Math.min(1128, x))), y: Math.round(Math.max(132, Math.min(603, y))) };
  if ((point.x === counter.x && point.y === counter.y) || state.counters.some(c => c.id !== id && Math.hypot(c.x - point.x, c.y - point.y) < COUNTER_SEPARATION)) return state;
  return { ...state, counters: state.counters.map(c => c.id === id ? { ...c, ...point } : c) };
}
