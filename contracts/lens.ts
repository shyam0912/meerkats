import { z } from 'zod';

// Centimetres. Positive object distance is a magnitude; lens sign is explicit.
export const lensStateSchema = z.strictObject({ kind: z.literal('thin-lens'),
  lens: z.enum(['convex', 'concave']), distance: z.number().finite().min(5).max(120),
  focalLength: z.number().finite().min(10).max(50) });
export type LensState = z.infer<typeof lensStateSchema>;
export const initialLensState: LensState = { kind: 'thin-lens', lens: 'convex', distance: 75, focalLength: 25 };
export const lensConfigSchema = z.strictObject({ model: z.literal('ideal-thin-lens-v1') });
