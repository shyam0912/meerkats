import { acknowledgementSchema, sessionResponseSchema, sessionSchema, type SaveRequest, type SessionIdentity } from '../../contracts';
export class SaveError extends Error {
  status: number;
  constructor(status: number) { super(status === 409 ? 'Server conflict: local work retained' : 'Server save unavailable'); this.status = status; }
}
async function request(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(`/api/v1${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new SaveError(response.status);
  return response.json() as Promise<unknown>;
}
export const api = {
  create: async (identity: SessionIdentity) => sessionSchema.parse(await request('/sessions', 'POST', identity)),
  get: async (id: string) => sessionResponseSchema.parse(await request(`/sessions/${id}`)),
  save: async (sessionId: string, input: SaveRequest) => acknowledgementSchema.parse(await request(`/sessions/${sessionId}/documents/${input.document.id}`, 'PUT', input)),
};
export type SessionApi = typeof api;
