import { webcrypto } from 'node:crypto';

// happy-dom ships a `crypto` stub without SubtleCrypto, and the app's E2E
// encryption is built entirely on `crypto.subtle`.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
}
