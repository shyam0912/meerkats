import { describe, it, expect } from 'vitest';
import { parseEnv } from '../src/config/env.js';
const valid = { NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:password@127.0.0.1:55433/test',
  DEV_IDENTITY_ENABLED: 'true', DEV_USER_ID: '11111111-1111-4111-8111-111111111111',
  DEV_SCHOOL_ID: '22222222-2222-4222-8222-222222222222', ALLOWED_ORIGIN: 'http://127.0.0.1:5173' };
describe('environment boundary', () => {
  it('accepts explicit local development identity', () => expect(parseEnv(valid).HOST).toBe('127.0.0.1'));
  it('refuses production development identity', () => expect(() => parseEnv({ ...valid, NODE_ENV: 'production' })).toThrow('forbidden'));
  it('requires explicit identity enablement', () => expect(() => parseEnv({ ...valid, DEV_IDENTITY_ENABLED: undefined })).toThrow());
  it('rejects nonloopback binding, remote DB and wildcard origin', () => {
    for (const change of [{ HOST: '0.0.0.0' }, { DATABASE_URL: 'postgresql://test:secret@example.com/db' }, { ALLOWED_ORIGIN: '*' }])
      expect(() => parseEnv({ ...valid, ...change })).toThrow();
  });
  it('does not include credentials in validation errors', () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: 'postgresql://test:private-secret@example.com/db' })).toThrow('Invalid environment: DATABASE_URL');
    expect(() => parseEnv({ ...valid, DATABASE_URL: 'invalid-url-with-private-secret' })).toThrow('Invalid environment: DATABASE_URL');
    expect(() => parseEnv({ ...valid, ALLOWED_ORIGIN: 'not-a-url' })).toThrow('Invalid environment: ALLOWED_ORIGIN');
  });
});
