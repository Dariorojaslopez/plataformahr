import { PasswordHashingService } from './password-hashing.service';

describe('PasswordHashingService', () => {
  const service = new PasswordHashingService();

  it('hashes and verifies a password with Argon2id', async () => {
    const hash = await service.hash('correct-horse-battery');
    expect(hash).not.toContain('correct-horse-battery');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(service.verify(hash, 'correct-horse-battery')).resolves.toBe(
      true,
    );
  });

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('secret-value');
    await expect(service.verify(hash, 'wrong-value')).resolves.toBe(false);
  });

  it('returns false for an invalid hash payload', async () => {
    await expect(service.verify('not-a-valid-hash', 'anything')).resolves.toBe(
      false,
    );
  });
});
