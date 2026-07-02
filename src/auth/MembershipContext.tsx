import { createContext, useContext, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useTenant } from '../tenant/TenantContext';
import { useDocData } from '../data/db';
import { resolveMembership, type Membership, type OrgMemberDoc, type CompMemberDoc } from './membership';

type Value = Membership & { loading: boolean };

const Ctx = createContext<Value>({ role: null, judgeId: null, loading: true });

/** Requires a signed-in user (render inside the auth gate) and a TenantProvider. */
export function MembershipProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { orgId, tp } = useTenant();
  const uid = user?.uid ?? '_none_'; // never rendered signed-out; placeholder keeps the doc path valid
  const org = useDocData<OrgMemberDoc>(`orgs/${orgId}/members/${uid}`);
  const comp = useDocData<CompMemberDoc>(tp(`members/${uid}`));
  const loading = org.loading || comp.loading;
  const value: Value = { ...resolveMembership(org.data, comp.data), loading };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useMembership = () => useContext(Ctx);
