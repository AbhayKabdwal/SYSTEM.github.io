// End-to-end encryption for the synced vault, WebCrypto only.
//
//   data key (random AES-256-GCM)  encrypts the vault snapshot
//   ├─ wrapped by a key derived from the vault passphrase (PBKDF2-SHA256)
//   └─ wrapped by a key derived from the one-time recovery code (HKDF-SHA256)
//
// The server stores only the ciphertext and the two wrapped copies. Neither the
// passphrase nor the recovery code ever leaves the device, so losing both loses the data.

const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

export const PBKDF2_ITERATIONS = 600_000;
const GCM = 'AES-GCM';

export function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

const random = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** Stored server-side next to the vault. Contains no secrets. */
export interface VaultKeyRecord {
  kdf_iterations: number;
  pass_salt: string;
  pass_iv: string;
  pass_wrapped: string;
  rec_salt: string;
  rec_iv: string;
  rec_wrapped: string;
}

export interface Sealed {
  iv: string;
  ciphertext: string;
}

export const generateDataKey = () =>
  subtle().generateKey({ name: GCM, length: 256 }, true, ['encrypt', 'decrypt']) as Promise<CryptoKey>;

async function kekFromPassphrase(passphrase: string, salt: Uint8Array, iterations: number) {
  const base = await subtle().importKey('raw', enc.encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: GCM, length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

/** Crockford base32: no I, L, O, U, so codes survive being read aloud or handwritten. */
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateRecoveryCode(): string {
  const bytes = random(20);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out.match(/.{4}/g)!.join('-');
}

export const normalizeRecoveryCode = (code: string) =>
  code.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');

async function kekFromRecovery(code: string, salt: Uint8Array) {
  const base = await subtle().importKey('raw', enc.encode(normalizeRecoveryCode(code)), 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('system-vault-recovery') },
    base,
    { name: GCM, length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

async function wrap(dataKey: CryptoKey, kek: CryptoKey) {
  const iv = random(12);
  const wrapped = await subtle().wrapKey('raw', dataKey, kek, { name: GCM, iv });
  return { iv: toB64(iv), wrapped: toB64(wrapped) };
}

async function unwrap(wrapped: string, iv: string, kek: CryptoKey, extractable: boolean) {
  return subtle().unwrapKey('raw', fromB64(wrapped), kek, { name: GCM, iv: fromB64(iv) }, { name: GCM, length: 256 }, extractable, [
    'encrypt',
    'decrypt',
  ]);
}

async function passFields(dataKey: CryptoKey, passphrase: string, iterations = PBKDF2_ITERATIONS) {
  const salt = random(16);
  const w = await wrap(dataKey, await kekFromPassphrase(passphrase, salt, iterations));
  return { kdf_iterations: iterations, pass_salt: toB64(salt), pass_iv: w.iv, pass_wrapped: w.wrapped };
}

async function recoveryFields(dataKey: CryptoKey, code: string) {
  const salt = random(16);
  const w = await wrap(dataKey, await kekFromRecovery(code, salt));
  return { rec_salt: toB64(salt), rec_iv: w.iv, rec_wrapped: w.wrapped };
}

export async function createVaultKeys(passphrase: string, iterations = PBKDF2_ITERATIONS) {
  const dataKey = await generateDataKey();
  const recoveryCode = generateRecoveryCode();
  const record: VaultKeyRecord = {
    ...(await passFields(dataKey, passphrase, iterations)),
    ...(await recoveryFields(dataKey, recoveryCode)),
  };
  return { dataKey, recoveryCode, record };
}

export class WrongSecretError extends Error {
  constructor() {
    super('Wrong passphrase or recovery code');
  }
}

/** `extractable` only when the key must be re-wrapped (passphrase change / recovery). */
export async function unlockWithPassphrase(record: VaultKeyRecord, passphrase: string, extractable = false) {
  const kek = await kekFromPassphrase(passphrase, fromB64(record.pass_salt), record.kdf_iterations);
  try {
    return await unwrap(record.pass_wrapped, record.pass_iv, kek, extractable);
  } catch {
    throw new WrongSecretError();
  }
}

export async function unlockWithRecovery(record: VaultKeyRecord, code: string, extractable = false) {
  const kek = await kekFromRecovery(code, fromB64(record.rec_salt));
  try {
    return await unwrap(record.rec_wrapped, record.rec_iv, kek, extractable);
  } catch {
    throw new WrongSecretError();
  }
}

/** New passphrase wrap for an extractable data key; the recovery wrap is untouched. */
export async function rewrapWithPassphrase(record: VaultKeyRecord, dataKey: CryptoKey, passphrase: string): Promise<VaultKeyRecord> {
  return { ...record, ...(await passFields(dataKey, passphrase, record.kdf_iterations)) };
}

/** Issues a new recovery code and invalidates the old one. */
export async function rotateRecoveryCode(record: VaultKeyRecord, dataKey: CryptoKey) {
  const recoveryCode = generateRecoveryCode();
  return { recoveryCode, record: { ...record, ...(await recoveryFields(dataKey, recoveryCode)) } };
}

/** Same key material, usable but not exportable: what we keep on the device. */
export async function toDeviceKey(dataKey: CryptoKey): Promise<CryptoKey> {
  if (!dataKey.extractable) return dataKey;
  const raw = await subtle().exportKey('raw', dataKey);
  return subtle().importKey('raw', raw, { name: GCM }, false, ['encrypt', 'decrypt']);
}

export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = random(12);
  const ct = await subtle().encrypt({ name: GCM, iv }, key, enc.encode(JSON.stringify(value)));
  return { iv: toB64(iv), ciphertext: toB64(ct) };
}

export async function open<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  const pt = await subtle().decrypt({ name: GCM, iv: fromB64(sealed.iv) }, key, fromB64(sealed.ciphertext));
  return JSON.parse(dec.decode(pt)) as T;
}

/** Binary payloads (photos): 12-byte IV followed by the ciphertext. */
export async function sealBytes(key: CryptoKey, data: ArrayBuffer): Promise<Uint8Array> {
  const iv = random(12);
  const ct = new Uint8Array(await subtle().encrypt({ name: GCM, iv }, key, data));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return out;
}

export async function openBytes(key: CryptoKey, sealed: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
  const bytes = sealed instanceof Uint8Array ? sealed : new Uint8Array(sealed);
  return subtle().decrypt({ name: GCM, iv: bytes.slice(0, 12) }, key, bytes.slice(12));
}
