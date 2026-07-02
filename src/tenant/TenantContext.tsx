import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { compBasePath } from './paths';

export interface Tenant {
  orgId: string;
  compId: string;
  /** Absolute Firestore path for a competition-relative path: tp('judges'), tp(`sessions/${id}`). */
  tp: (rel: string) => string;
}

const Ctx = createContext<Tenant | null>(null);

export function TenantProvider({ orgId, compId, children }: { orgId: string; compId: string; children: ReactNode }) {
  const value = useMemo<Tenant>(() => {
    const base = compBasePath(orgId, compId);
    return { orgId, compId, tp: (rel) => `${base}/${rel}` };
  }, [orgId, compId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTenant(): Tenant {
  const t = useContext(Ctx);
  if (!t) throw new Error('useTenant must be used inside TenantProvider');
  return t;
}
