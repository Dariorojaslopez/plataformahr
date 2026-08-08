import assert from 'node:assert/strict';
import test from 'node:test';
import { APP_NAME, createHealthResponse } from './index.ts';

test('APP_NAME is defined', () => {
  assert.equal(APP_NAME, 'talento-sin-clave');
});

test('createHealthResponse returns ok', () => {
  assert.deepEqual(createHealthResponse(), { status: 'ok' });
});
