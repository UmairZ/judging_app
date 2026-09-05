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
 * routes between Home / Organization / Account / competition shells. */
export function PortalRoot() {
  const { user } = useAuth();
  const orgs = useCollection<OrgMirror>(user ? `users/${user.uid}/orgs` : '__no_user__');
  const org = orgs[0];
  const route = parsePortalRoute(window.location.pathname);

  const sidebar = org ? <OrgSidebar orgId={org.id} orgName={org.name} /> : null;

  return <PortalShell sidebar={sidebar}>{renderRoute(route)}</PortalShell>;
}

function renderRoute(route: PortalRoute) {
  if (route === null || route.kind === 'home') return <HomePage />;
  // Task 5 replaces the org/account placeholders; Task 6 replaces the comp shell.
  return <div>coming soon</div>;
}
