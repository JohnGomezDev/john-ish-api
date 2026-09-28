import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { IHasher } from './hasher.interface';

const SALT_ROUNDS = 12;

@Injectable()
export class BcryptHasherImpl implements IHasher {
  async hash(raw: string): Promise<string> {
    return bcrypt.hash(raw, SALT_ROUNDS);
  }

  async compare(raw: string, hash: string): Promise<boolean> {
    return bcrypt.compare(raw, hash);
  }
}
