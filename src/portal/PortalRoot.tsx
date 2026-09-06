import { useAuth } from '../auth/AuthContext';
import { useCollection } from '../data/db';
import { TenantProvider } from '../tenant/TenantContext';
import { AccountPage } from './AccountPage';
import { CompShell } from './comp/CompShell';
import { ContestantsPage } from './comp/ContestantsPage';
import { OverviewPage } from './comp/OverviewPage';
import { HomePage } from './HomePage';
import { OrgSettingsPage } from './OrgSettingsPage';
import { OrgSidebar } from './OrgSidebar';
import { PortalShell } from './PortalShell';
import { parsePortalRoute, type CompSection, type PortalRoute } from './routes';

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

  // Competition routes swap the whole shell (org sidebar -> contextual comp
  // sidebar), rather than nesting inside the org PortalShell below — mirrors
  // how the sidebar prop below swaps for the other routes, just one level up.
  // Only mounted once `org` resolves, so TenantProvider never gets a missing
  // orgId (Task 4's rule: no path ever built from a missing id).
  if (route?.kind === 'comp' && org) {
    return (
      <TenantProvider orgId={org.id} compId={route.compId}>
        <CompShell compId={route.compId} section={route.section}>
          {route.section === 'overview' ? (
            <OverviewPage />
          ) : route.section === 'contestants' ? (
            <ContestantsPage />
          ) : (
            <ComingSoon section={route.section} />
          )}
        </CompShell>
      </TenantProvider>
    );
  }

  return <PortalShell sidebar={<OrgSidebar orgName={org?.name ?? null} />}>{renderRoute(route)}</PortalShell>;
}

function renderRoute(route: PortalRoute) {
  if (route === null || route.kind === 'home') return <HomePage />;
  if (route.kind === 'org') return <OrgSettingsPage />;
  if (route.kind === 'account') return <AccountPage />;
  // Comp route requested before the org has resolved — the branch above
  // takes over once it does.
  return <div>coming soon</div>;
}

/** Tasks 7-12 replace this with the real page for each section. */
function ComingSoon({ section }: { section: Exclude<CompSection, 'overview'> }) {
  return <div>coming soon: {section}</div>;
}
