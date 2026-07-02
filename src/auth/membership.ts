export type Role = 'admin' | 'judge' | 'display';

export interface OrgMemberDoc {
  role: 'owner' | 'admin';
}
export interface CompMemberDoc {
  role: 'judge' | 'display';
  judgeId?: string;
}
export interface Membership {
  role: Role | null;
  /** The judge seat this uid is bound to (from the member doc, NOT the auth uid). */
  judgeId: string | null;
}

export function resolveMembership(org: OrgMemberDoc | null, comp: CompMemberDoc | null): Membership {
  if (org && (org.role === 'owner' || org.role === 'admin')) return { role: 'admin', judgeId: null };
  if (comp?.role === 'judge' && typeof comp.judgeId === 'string' && comp.judgeId.length > 0) {
    return { role: 'judge', judgeId: comp.judgeId };
  }
  if (comp?.role === 'display') return { role: 'display', judgeId: null };
  return { role: null, judgeId: null };
}
