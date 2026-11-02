import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

// Node 18 has WebCrypto but doesn't expose it as a global.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
