import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** Explicit Argon2id parameters (OWASP-aligned defaults for interactive logins). */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordHashingService {
  async hash(value: string): Promise<string> {
    return argon2.hash(value, ARGON2_OPTIONS);
  }

  async verify(hash: string, value: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, value);
    } catch {
      return false;
    }
  }
}
