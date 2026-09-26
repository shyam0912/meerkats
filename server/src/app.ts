import Fastify from 'fastify';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { acknowledgementSchema, MAX_SNAPSHOT_BYTES, saveRequestSchema, sessionResponseSchema, sessionSchema, uuid } from '../../contracts/index.js';
import type { Config } from './config/env.js';
import type { Database } from './db/connection.js';
import { ApiError, sessionService } from './modules/sessions.js';

export function buildApp(db: Database, config: Config, logging = false) {
  const app = Fastify({ logger: logging ? { redact: ['req.headers.authorization', 'req.headers.cookie'], serializers: { req: req => ({ method: req.method, url: req.url }) } } : false,
    bodyLimit: MAX_SNAPSHOT_BYTES + 4096, requestTimeout: 15000 });
  const service = sessionService(db, config);
  app.setValidatorCompiler(({ schema }) => data => {
    const result = (schema as z.ZodType).safeParse(data);
    return result.success ? { value: result.data } : { error: new Error('Invalid request') };
  });
  app.setSerializerCompiler(({ schema }) => data => JSON.stringify((schema as z.ZodType).parse(data)));
  app.setErrorHandler((error, _request, reply) => {
    const err = error as { statusCode?: number; validation?: unknown };
    const status = error instanceof ApiError ? error.statusCode : err.validation || err.statusCode === 400 ? 400 : err.statusCode === 413 ? 413 : 500;
    if (status === 500) app.log.error({ event: 'request_failed' }, 'Internal request failure');
    reply.code(status).send({ error: error instanceof ApiError ? error.code : status === 400 ? 'invalid_request' : status === 413 ? 'payload_too_large' : 'internal_error' });
  });
  app.addHook('onRequest', async (request, reply) => {
    // No permissive CORS; the frontend uses a same-origin development proxy.
    const origin = request.headers.origin;
    if (origin && origin !== config.ALLOWED_ORIGIN) throw new ApiError(403, 'origin_denied');
    if (!['GET', 'HEAD'].includes(request.method) && !request.headers['content-type']?.startsWith('application/json'))
      throw new ApiError(415, 'json_required');
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff');
  });
  const health = z.strictObject({ status: z.literal('ok') });
  app.get('/api/v1/health', { schema: { response: { 200: health } } }, async () => ({ status: 'ok' }));
  app.get('/api/v1/ready', { schema: { response: { 200: health } } }, async () => {
    try { await db.execute(sql`select id from teaching_sessions limit 0`); }
    catch { throw new ApiError(503, 'database_unavailable'); }
    return { status: 'ok' };
  });
  app.register(async secured => {
    secured.addHook('preHandler', async () => { await service.authorize(); });
    secured.post('/api/v1/sessions', { schema: { body: sessionSchema, response: { 200: sessionSchema } } }, async request => service.create(sessionSchema.parse(request.body)));
    secured.get('/api/v1/sessions/:sessionId', { schema: { params: z.object({ sessionId: uuid }), response: { 200: sessionResponseSchema } } }, async request => service.get((request.params as { sessionId: string }).sessionId));
    secured.put('/api/v1/sessions/:sessionId/documents/:documentId', {
      schema: { params: z.object({ sessionId: uuid, documentId: uuid }), body: saveRequestSchema, response: { 200: acknowledgementSchema } },
    }, async request => {
      const { sessionId, documentId } = request.params as { sessionId: string; documentId: string };
      return service.save(sessionId, documentId, saveRequestSchema.parse(request.body));
    });
  });
  return app;
}
