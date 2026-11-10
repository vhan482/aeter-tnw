import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from './config.js';

test('uses safe local defaults', () => {
  const config = loadConfig({ DATABASE_URL: 'postgresql://user:pass@127.0.0.1:55432/aeter_tnw' });
  assert.equal(config.HOST, '127.0.0.1');
  assert.equal(config.PORT, 3001);
});

test('rejects missing credentials without exposing values', () => {
  assert.throws(() => loadConfig({}), /DATABASE_URL/);
});

test('rejects invalid ports and non-Postgres URLs', () => {
  assert.throws(() => loadConfig({ PORT: '65536', DATABASE_URL: 'postgresql://user:secret@localhost/db' }), /PORT/);
  assert.throws(() => loadConfig({ DATABASE_URL: 'https://example.com/secret' }), /DATABASE_URL/);
});
