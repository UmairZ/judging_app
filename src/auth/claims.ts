export type Role = 'admin' | 'judge' | 'display';

export interface JudgeClaims {
  role: 'judge';
  judgeId: string;
}
export interface AdminClaims {
  admin: true;
}
export interface DisplayClaims {
  role: 'display';
}

export function judgeClaims(judgeId: string): JudgeClaims {
  return { role: 'judge', judgeId };
}
export function adminClaims(): AdminClaims {
  return { admin: true };
}
export function displayClaims(): DisplayClaims {
  return { role: 'display' };
}

export function roleFromClaims(claims: Record<string, unknown> | null | undefined): Role | null {
  if (!claims) return null;
  if (claims.admin === true) return 'admin';
  if (claims.role === 'judge' && typeof claims.judgeId === 'string' && claims.judgeId.length > 0) return 'judge';
  if (claims.role === 'display') return 'display';
  return null;
}
