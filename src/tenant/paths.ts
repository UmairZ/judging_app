// Safe charset for org/competition ids — mirrors the judgeId constraint in functions.
export const SEG = /^[A-Za-z0-9_-]{1,128}$/;

/** Parse `/{orgId}/{compId}[/…]` from a location pathname. */
export function parseTenantPath(pathname: string): { orgId: string; compId: string } | null {
  const [orgId, compId] = pathname.split('/').filter(Boolean);
  if (!orgId || !compId || !SEG.test(orgId) || !SEG.test(compId)) return null;
  return { orgId, compId };
}

/** Firestore base path for one competition (the tenant unit). */
export function compBasePath(orgId: string, compId: string): string {
  return `orgs/${orgId}/competitions/${compId}`;
}
