import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APP_NAME,
  CANDIDATE_DOCUMENT_TYPE_CODES,
  CANDIDATE_DOCUMENT_TYPES,
  candidateDocumentTypeLabel,
  createHealthResponse,
  createReadyResponse,
  EMPLOYEE_MARITAL_STATUSES,
  isCandidateDocumentType,
  isCompanyHomeRole,
  isEmployeeMaritalStatus,
  isPremiumFeature,
  maritalStatusSelectOptions,
  mergeCompanyAccess,
  normalizeEmployeeMaritalStatus,
  resolveCompanyHomeRole,
  splitCompanyAccess,
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

test('employee marital statuses are a Spanish select catalog', () => {
  assert.deepEqual(
    [...EMPLOYEE_MARITAL_STATUSES],
    [
      'Soltero/a',
      'Casado/a',
      'Unión libre',
      'Separado/a',
      'Divorciado/a',
      'Viudo/a',
    ],
  );
  assert.equal(normalizeEmployeeMaritalStatus('casado'), 'Casado/a');
  assert.equal(normalizeEmployeeMaritalStatus('Soltero/a'), 'Soltero/a');
  assert.equal(normalizeEmployeeMaritalStatus('otro'), 'otro');
  assert.equal(isEmployeeMaritalStatus('Unión libre'), true);
  assert.equal(isEmployeeMaritalStatus('otro'), false);
  assert.equal(maritalStatusSelectOptions('otro').at(-1)?.value, 'otro');
});

test('premium access can be merged without dropping standard modules', () => {
  assert.deepEqual(
    splitCompanyAccess(
      ['ATS', 'PREMIUM'],
      ['ats.vacancies', 'premium.pdi', 'premium.interview-recording'],
    ),
    {
      modules: ['ATS'],
      features: ['ats.vacancies'],
      premiumFeatures: ['premium.pdi', 'premium.interview-recording'],
    },
  );
  assert.deepEqual(
    mergeCompanyAccess(
      ['ATS'],
      ['ats.vacancies'],
      ['premium.digital-signature'],
    ),
    {
      enabledModules: ['ATS', 'PREMIUM'],
      enabledFeatures: ['ats.vacancies', 'premium.digital-signature'],
    },
  );
  assert.equal(isPremiumFeature('premium.pdi'), true);
  assert.equal(isPremiumFeature('ats.vacancies'), false);
});

test('resolveCompanyHomeRole follows the product HOME matrix', () => {
  assert.equal(resolveCompanyHomeRole(['COLLABORATOR'], false), 'COLLABORATOR');
  assert.equal(resolveCompanyHomeRole(['LEADER'], false), 'LEADER');
  assert.equal(resolveCompanyHomeRole(['COLLABORATOR'], true), 'LEADER');
  assert.equal(resolveCompanyHomeRole(['RECRUITER'], false), 'RECRUITER');
  assert.equal(resolveCompanyHomeRole(['CLIENT_ADMIN'], false), 'CLIENT_ADMIN');
  assert.equal(
    resolveCompanyHomeRole(['PERFORMANCE_MANAGER'], false),
    'PERFORMANCE_MANAGER',
  );
  assert.equal(
    resolveCompanyHomeRole(['CLIENT_ADMIN', 'LEADER', 'RECRUITER'], true),
    'CLIENT_ADMIN',
  );
  assert.equal(
    resolveCompanyHomeRole(['RECRUITER', 'LEADER'], true),
    'RECRUITER',
  );
  assert.equal(resolveCompanyHomeRole([], false), 'COLLABORATOR');
  assert.equal(isCompanyHomeRole('LEADER'), true);
  assert.equal(isCompanyHomeRole('UNKNOWN'), false);
});
