// lib/integrity.js
import { createHash } from 'node:crypto';

export function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

export function buildCustodyEntry({ label, type, hash, ingestedAt }) {
  return { label, type, sha256: hash, ingestedAt, status: 'verified-from-intake' };
}
