import { fingerprint } from '../../shared/core.js';
import type { ItemInput } from '../types';
export { normaliseUrl, validateItem } from '../../shared/core.js';
export async function makeDedupeKey(item: ItemInput): Promise<string> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(fingerprint(item)),
  );
  return [...new Uint8Array(hash)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}
