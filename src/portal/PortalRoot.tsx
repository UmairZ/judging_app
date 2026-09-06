import { useAuth } from '../auth/AuthContext';
import { useCollection } from '../data/db';
import { TenantProvider } from '../tenant/TenantContext';
import { AccountPage } from './AccountPage';
import { CategoriesPage } from './comp/CategoriesPage';
import { CompShell } from './comp/CompShell';
import { ContestantsPage } from './comp/ContestantsPage';
import { JudgesPage } from './comp/JudgesPage';
import { LeaderboardPage } from './comp/LeaderboardPage';
import { OverviewPage } from './comp/OverviewPage';
import { ProvisioningPage } from './comp/ProvisioningPage';
import { ScoringPage } from './comp/ScoringPage';
import { HomePage } from './HomePage';
import { usePortalPath } from './nav';
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
 * convention as the legacy dashboard. The sidebar renders unconditionally (with
 * or without an org) so a no-org account never loses its Sign out. */
export function PortalRoot() {
  const { user } = useAuth();
  const orgs = useCollection<OrgMirror>(`users/${user!.uid}/orgs`);
  const org = orgs[0];
  // Reactive path: navigate()/popstate re-render the route in place — no
  // document load, so auth + Firestore subscriptions persist across sections.
  const route = parsePortalRoute(usePortalPath());

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
          ) : route.section === 'categories' ? (
            <CategoriesPage />
          ) : route.section === 'judges' ? (
            <JudgesPage />
          ) : route.section === 'scoring' ? (
            <ScoringPage />
          ) : route.section === 'leaderboard' ? (
            <LeaderboardPage />
          ) : route.section === 'provisioning' ? (
            <ProvisioningPage />
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
