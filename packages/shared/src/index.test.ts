import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APP_NAME,
  CANDIDATE_DOCUMENT_TYPE_CODES,
  CANDIDATE_DOCUMENT_TYPES,
  candidateDocumentTypeLabel,
  createHealthResponse,
  createReadyResponse,
  isCandidateDocumentType,
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

test('candidate document types use stable codes and Spanish labels', () => {
  assert.deepEqual(
    CANDIDATE_DOCUMENT_TYPES.map((item) => item.code),
    ['TI', 'CC', 'CE', 'PASSPORT'],
  );
  assert.deepEqual(CANDIDATE_DOCUMENT_TYPE_CODES, ['TI', 'CC', 'CE', 'PASSPORT']);
  assert.equal(
    candidateDocumentTypeLabel('CC'),
    'Cédula de Ciudadanía',
  );
  assert.equal(candidateDocumentTypeLabel('PASSPORT'), 'Pasaporte');
  assert.equal(candidateDocumentTypeLabel('Cedula'), 'Cedula');
  assert.equal(candidateDocumentTypeLabel(null), null);
  assert.equal(isCandidateDocumentType('CC'), true);
  assert.equal(isCandidateDocumentType('DNI'), false);
});
