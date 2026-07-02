import { SEG, parseTenantPath } from '../tenant/paths';

// Unambiguous code alphabet: no I, L, O, 0, 1.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_RE = new RegExp(`^[${ALPHABET}]{8}$`);

function randomCode(length: number): string {
  const out: string[] = [];
  while (out.length < length) {
    const bytes = new Uint8Array(length * 2);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      // Rejection sampling: drop bytes past the largest multiple of 31 to keep the draw uniform.
      if (b >= 248 || out.length >= length) continue;
      out.push(ALPHABET[b % ALPHABET.length]);
    }
  }
  return out.join('');
}

/** 8-char join code (~40 bits — plenty for short-lived, revocable codes). */
export function generateJoinCode(): string {
  return randomCode(8);
}

/** 24-char webhook secret (~119 bits) — the security boundary for per-tenant Zeffy. */
export function generateWebhookToken(): string {
  return randomCode(24);
}

/** Suggest a URL-safe org id from a display name; user can edit before submitting. */
export function slugifyOrgId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 128);
  return slug || 'org';
}

export function validateIds(...ids: string[]): boolean {
  return ids.every((id) => SEG.test(id));
}

/** Auth uid for an organizer-provisioned device — tenant-qualified so seats never collide across tenants. */
export function provisionedUid(orgId: string, compId: string, judgeId: string): string {
  if ([orgId, compId, judgeId].some((id) => id.includes('__'))) throw new Error('ids may not contain __');
  const uid = `${orgId}__${compId}__${judgeId}`;
  if (uid.length > 128) throw new Error('uid too long');
  return uid;
}

export interface JoinCodeDoc {
  role: string;
  judgeId?: string;
  redeemedBy: string | null;
}

/** Decide whether a join code is redeemable; the callable maps thrown messages to HttpsError codes. */
export function validateRedeem(code: JoinCodeDoc | null): { role: 'judge' | 'display'; judgeId: string | null } {
  if (!code) throw new Error('not-found');
  if (code.redeemedBy) throw new Error('already-redeemed');
  if (code.role === 'judge') {
    if (typeof code.judgeId !== 'string' || !code.judgeId) throw new Error('corrupt-code');
    return { role: 'judge', judgeId: code.judgeId };
  }
  if (code.role === 'display') return { role: 'display', judgeId: null };
  throw new Error('corrupt-code');
}

export type Route =
  | { kind: 'root' }
  | { kind: 'tenant'; orgId: string; compId: string }
  | { kind: 'join'; orgId: string; compId: string; code: string | null };

export function parseRoute(pathname: string): Route {
  const t = parseTenantPath(pathname);
  if (!t) return { kind: 'root' };
  const segs = pathname.split('/').filter(Boolean);
  if (segs[2] === 'join') {
    const code = segs[3] && JOIN_CODE_RE.test(segs[3]) ? segs[3] : null;
    return { kind: 'join', ...t, code };
  }
  return { kind: 'tenant', ...t };
}
