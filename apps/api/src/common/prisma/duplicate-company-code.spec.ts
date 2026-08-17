import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  duplicateCompanyCodeMessage,
  formatDuplicateCompanyCodeMessage,
  resolveDuplicateCompanyCodeModel,
  rethrowDuplicateCompanyCodeConflict,
} from './duplicate-company-code';

function p2002(
  meta: Prisma.PrismaClientKnownRequestError['meta'],
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta,
  });
}

describe('duplicate company code conflicts', () => {
  it('maps each known model to a Spanish message with the code', () => {
    expect(formatDuplicateCompanyCodeMessage('BusinessUnit', 'FIN')).toBe(
      'Ya existe una unidad de negocio con el código FIN.',
    );
    expect(formatDuplicateCompanyCodeMessage('Area', 'FIN')).toBe(
      'Ya existe un área con el código FIN.',
    );
    expect(formatDuplicateCompanyCodeMessage('JobLevel', 'N1')).toBe(
      'Ya existe un nivel de cargo con el código N1.',
    );
    expect(formatDuplicateCompanyCodeMessage('Position', 'DEV')).toBe(
      'Ya existe un cargo con el código DEV.',
    );
    expect(formatDuplicateCompanyCodeMessage('Competency', 'LID')).toBe(
      'Ya existe una competencia con el código LID.',
    );
  });

  it('recognizes companyId+code targets and constraint names', () => {
    expect(
      resolveDuplicateCompanyCodeModel(
        p2002({ modelName: 'Area', target: ['companyId', 'code'] }),
      ),
    ).toBe('Area');
    expect(
      resolveDuplicateCompanyCodeModel(
        p2002({ target: 'positions_companyId_code_key' }),
      ),
    ).toBe('Position');
  });

  it('does not treat other unique constraints as duplicate codes', () => {
    const nameConflict = p2002({
      modelName: 'Area',
      target: ['companyId', 'name'],
    });
    expect(resolveDuplicateCompanyCodeModel(nameConflict)).toBeNull();
    expect(duplicateCompanyCodeMessage(nameConflict, 'FIN')).toBeNull();

    const rankConflict = p2002({
      modelName: 'JobLevel',
      target: ['companyId', 'rank'],
    });
    expect(duplicateCompanyCodeMessage(rankConflict, 'N1')).toBeNull();

    const roleCode = p2002({ target: 'roles_scope_code_key' });
    expect(duplicateCompanyCodeMessage(roleCode, 'CLIENT_ADMIN')).toBeNull();

    const membership = p2002({
      modelName: 'CompanyMembership',
      target: ['userId', 'companyId'],
    });
    expect(duplicateCompanyCodeMessage(membership)).toBeNull();
  });

  it('rethrows non-code P2002 unchanged', () => {
    const nameConflict = p2002({
      modelName: 'Area',
      target: ['companyId', 'name'],
    });
    expect(() =>
      rethrowDuplicateCompanyCodeConflict(nameConflict, 'FIN'),
    ).toThrow(nameConflict);
  });

  it('throws ConflictException for a known code unique', () => {
    const error = p2002({
      modelName: 'BusinessUnit',
      target: ['code', 'companyId'],
    });
    expect(() => rethrowDuplicateCompanyCodeConflict(error, '  FIN  ')).toThrow(
      ConflictException,
    );
    try {
      rethrowDuplicateCompanyCodeConflict(error, '  FIN  ');
    } catch (caught) {
      expect(caught).toBeInstanceOf(ConflictException);
      expect((caught as ConflictException).message).toBe(
        'Ya existe una unidad de negocio con el código FIN.',
      );
    }
  });
});
