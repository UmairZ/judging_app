import { validateIds } from '../onboarding/logic';

export type CompSection = 'overview' | 'contestants' | 'categories' | 'judges' | 'scoring' | 'leaderboard' | 'provisioning';

export type PortalRoute =
  | { kind: 'home' }
  | { kind: 'org' }
  | { kind: 'account' }
  | { kind: 'comp'; compId: string; section: CompSection }
  | null;

const COMP_SECTIONS: CompSection[] = [
  'overview',
  'contestants',
  'categories',
  'judges',
  'scoring',
  'leaderboard',
  'provisioning',
];

/**
 * Parse a portal route pathname into its components.
 *
 * Handles routes like:
 * - /portal -> { kind: 'home' }
 * - /portal/org -> { kind: 'org' }
 * - /portal/account -> { kind: 'account' }
 * - /portal/c/{compId} -> { kind: 'comp', compId, section: 'overview' }
 * - /portal/c/{compId}/{section} -> { kind: 'comp', compId, section }
 *
 * Returns null for unrecognized paths.
 */
export function parsePortalRoute(pathname: string): PortalRoute {
  // Exact '/portal' or a '/portal/...' subpath only — a bare startsWith
  // would also claim paths like '/portalfoo' (mirrors App.tsx's gate).
  if (pathname !== '/portal' && !pathname.startsWith('/portal/')) {
    return null;
  }

  const segments = pathname.split('/').filter(Boolean);

  // /portal
  if (segments.length === 1 && segments[0] === 'portal') {
    return { kind: 'home' };
  }

  // /portal/org
  if (segments.length === 2 && segments[0] === 'portal' && segments[1] === 'org') {
    return { kind: 'org' };
  }

  // /portal/account
  if (segments.length === 2 && segments[0] === 'portal' && segments[1] === 'account') {
    return { kind: 'account' };
  }

  // /portal/c/{compId} or /portal/c/{compId}/{section}
  if (segments.length >= 3 && segments[0] === 'portal' && segments[1] === 'c') {
    const compId = segments[2];

    // Validate compId
    if (!validateIds(compId)) {
      return null;
    }

    // Determine section (default to 'overview')
    const sectionStr = segments[3] || 'overview';
    if (!COMP_SECTIONS.includes(sectionStr as CompSection)) {
      return null;
    }

    return {
      kind: 'comp',
      compId,
      section: sectionStr as CompSection,
    };
  }

  return null;
}

/**
 * Build a portal route path for a competition.
 *
 * @param compId - the competition ID
 * @param section - the section to navigate to (defaults to 'overview')
 * @returns the pathname for this route
 */
export function compPath(compId: string, section: CompSection = 'overview'): string {
  if (section === 'overview') {
    return `/portal/c/${compId}`;
  }
  return `/portal/c/${compId}/${section}`;
}
