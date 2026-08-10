import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APP_NAME,
  createHealthResponse,
  createReadyResponse,
} from './index.ts';

test('APP_NAME is defined', () => {
  assert.equal(APP_NAME, 'talento');
});

test('createHealthResponse returns ok', () => {
  assert.deepEqual(createHealthResponse(), { status: 'ok' });
});

test('createReadyResponse reflects readiness', () => {
  assert.deepEqual(createReadyResponse(true), { status: 'ready' });
  assert.deepEqual(createReadyResponse(false), { status: 'not_ready' });
});
