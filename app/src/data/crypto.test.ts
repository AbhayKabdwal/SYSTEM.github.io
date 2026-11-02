import { describe, expect, it } from 'vitest';
import {
  createVaultKeys,
  generateRecoveryCode,
  normalizeRecoveryCode,
  open,
  rewrapWithPassphrase,
  rotateRecoveryCode,
  seal,
  toDeviceKey,
  unlockWithPassphrase,
  unlockWithRecovery,
  WrongSecretError,
} from './crypto';

// Low iteration count keeps tests fast; production uses PBKDF2_ITERATIONS.
const ITER = 1000;

describe('vault crypto', () => {
  it('seals and opens with the data key, and ciphertext hides the plaintext', async () => {
    const { dataKey } = await createVaultKeys('correct horse battery', ITER);
    const sealed = await seal(dataKey, { secret: 'bench 140kg' });
    expect(atob(sealed.ciphertext)).not.toContain('bench');
    expect(await open(dataKey, sealed)).toEqual({ secret: 'bench 140kg' });
  });

  it('unlocks with the passphrase and with the recovery code', async () => {
    const { dataKey, recoveryCode, record } = await createVaultKeys('correct horse battery', ITER);
    const sealed = await seal(dataKey, 42);
    expect(await open(await unlockWithPassphrase(record, 'correct horse battery'), sealed)).toBe(42);
    expect(await open(await unlockWithRecovery(record, recoveryCode.toLowerCase().replace(/-/g, ' ')), sealed)).toBe(42);
  });

  it('rejects wrong secrets', async () => {
    const { record } = await createVaultKeys('correct horse battery', ITER);
    await expect(unlockWithPassphrase(record, 'wrong horse battery')).rejects.toBeInstanceOf(WrongSecretError);
    await expect(unlockWithRecovery(record, generateRecoveryCode())).rejects.toBeInstanceOf(WrongSecretError);
  });

  it('changes passphrase without changing the data key', async () => {
    const { dataKey, recoveryCode, record } = await createVaultKeys('old passphrase!!', ITER);
    const sealed = await seal(dataKey, 'x');
    const k = await unlockWithPassphrase(record, 'old passphrase!!', true);
    const next = await rewrapWithPassphrase(record, k, 'new passphrase!!');
    expect(await open(await unlockWithPassphrase(next, 'new passphrase!!'), sealed)).toBe('x');
    await expect(unlockWithPassphrase(next, 'old passphrase!!')).rejects.toBeInstanceOf(WrongSecretError);
    // Recovery code still works.
    expect(await open(await unlockWithRecovery(next, recoveryCode), sealed)).toBe('x');
  });

  it('rotating the recovery code invalidates the old one', async () => {
    const { dataKey, recoveryCode, record } = await createVaultKeys('passphrase here', ITER);
    const rotated = await rotateRecoveryCode(record, dataKey);
    await expect(unlockWithRecovery(rotated.record, recoveryCode)).rejects.toBeInstanceOf(WrongSecretError);
    await expect(unlockWithRecovery(rotated.record, rotated.recoveryCode)).resolves.toBeTruthy();
  });

  it('device keys are not exportable', async () => {
    const { dataKey } = await createVaultKeys('passphrase here', ITER);
    const dev = await toDeviceKey(dataKey);
    expect(dev.extractable).toBe(false);
    await expect(globalThis.crypto.subtle.exportKey('raw', dev)).rejects.toThrow();
  });

  it('recovery codes are 32 Crockford chars in groups and normalise typos', () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(normalizeRecoveryCode('o0il-L1')).toBe('001111');
  });
});
