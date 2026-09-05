import { useAuth } from '../auth/AuthContext';
import { useCollection } from '../data/db';
import { HomePage } from './HomePage';
import { OrgSidebar } from './OrgSidebar';
import { PortalShell } from './PortalShell';
import { parsePortalRoute, type PortalRoute } from './routes';

interface OrgMirror {
  role: string;
  name: string;
}

/** Org-level portal entry point: binds the signed-in user's first org, then
 * routes between Home / Organization / Account / competition shells.
 *
 * PortalRoot only ever mounts once App.tsx has confirmed a signed-in `user`
 * (see the /portal branch of Routed()), so `user!` is safe here — same
 * convention as OrgDashboard.tsx. The sidebar renders unconditionally (with
 * or without an org) so a no-org account never loses its Sign out. */
export function PortalRoot() {
  const { user } = useAuth();
  const orgs = useCollection<OrgMirror>(`users/${user!.uid}/orgs`);
  const org = orgs[0];
  const route = parsePortalRoute(window.location.pathname);

  return <PortalShell sidebar={<OrgSidebar orgName={org?.name ?? null} />}>{renderRoute(route)}</PortalShell>;
}

function renderRoute(route: PortalRoute) {
  if (route === null || route.kind === 'home') return <HomePage />;
  // Task 5 replaces the org/account placeholders; Task 6 replaces the comp shell.
  return <div>coming soon</div>;
}
