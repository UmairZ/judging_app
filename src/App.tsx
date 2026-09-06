import { useEffect, useMemo } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { MembershipProvider, useMembership } from './auth/MembershipContext';
import { TenantProvider, useTenant } from './tenant/TenantContext';
import { useDocData } from './data/db';
import { parseRoute } from './onboarding/logic';
import SignInScreen from './onboarding/SignInScreen';
import Home02 from './marketing/Home02';
import DemoPage from './marketing/DemoPage';
import About02 from './marketing/About02';
import { PortalRoot } from './portal/PortalRoot';
import { compPath } from './portal/routes';
import { Heading } from './portal/vendor/heading';
import { Text } from './portal/vendor/text';
import { Button } from './portal/vendor/button';
import JoinScreen from './onboarding/JoinScreen';
import JudgeApp from './judge/JudgeApp';
import Projector from './admin/Projector';
import { C, serif } from './ui/theme';

function Routed() {
  const { user, loading } = useAuth();
  // All hooks run unconditionally, before any conditional return — the /portal
  // branch below must never sit between hook calls (Rules of Hooks).
  const route = useMemo(() => parseRoute(window.location.pathname), []);
  // Portal auth gating — Phase C work-in-progress. Exact '/portal' or a
  // '/portal/...' subpath only — a bare startsWith would also claim '/portalfoo'.
  const path = window.location.pathname;
  if (path === '/portal' || path.startsWith('/portal/')) {
    if (loading) return <Splash />;
    if (!user) return <SignInScreen />;
    return <PortalRoot />;
  }
  // Public demo page — resolved before tenant routing ('/demo' would otherwise parse as an org id).
  if (window.location.pathname === '/demo') return <DemoPage />;
  if (window.location.pathname === '/about') return <About02 />;
  if (loading) return <Splash />;
  if (route.kind === 'join') return <JoinScreen orgId={route.orgId} compId={route.compId} code={route.code} />;
  if (!user) return route.kind === 'root' ? <Home02 /> : <SignInScreen />;
  // Signed-in root visits redirect to the portal — the organizer dashboard now lives there.
  if (route.kind === 'root') return <RedirectToPortal />;
  return (
    <TenantProvider orgId={route.orgId} compId={route.compId}>
      <MembershipProvider>
        <RoleGate />
      </MembershipProvider>
    </TenantProvider>
  );
}

function RedirectToPortal() {
  useEffect(() => {
    window.location.replace('/portal');
  }, []);
  return <Splash />;
}

function RoleGate() {
  const { role, loading } = useMembership();
  const { orgId, compId } = useTenant();
  const comp = useDocData<{ name?: string }>(`orgs/${orgId}/competitions/${compId}`);
  if (loading || comp.loading) return <Splash />;
  // Org staff resolve to 'admin' even for a typo'd competition id — writing there
  // would create a ghost tenant. Gate on the competition doc actually existing.
  if (role === 'admin' && !comp.data) return <CompNotFound />;
  if (role === 'admin') return <AdminMoved compId={compId} />;
  if (role === 'judge') return <JudgeApp />;
  if (role === 'display') return <Projector />;
  return <NoAccess />;
}

/** Competition admin now lives in the portal — this replaces the legacy
 * per-competition dashboard chrome at `/{org}/{comp}` for organizers, per
 * Task 13's retirement of the legacy dashboards. Judge/display roles above
 * are untouched. */
function AdminMoved({ compId }: { compId: string }) {
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-900">
      <div className="max-w-md text-center">
        <Heading>Competition admin has moved into the portal</Heading>
        <Text className="mt-3">
          Manage this competition from your organization portal instead of this direct link.
        </Text>
        <div className="mt-6 flex items-center justify-center gap-4">
          <Button href={compPath(compId)}>Open in the portal</Button>
          <Button plain onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

function CompNotFound() {
  return <GateShell title="Competition not found" body="No competition exists at this address. Check the link, or create it from your dashboard." />;
}

function GateShell({ title, body }: { title: string; body: string }) {
  const { signOut, user } = useAuth();
  return (
    <div style={{ height: '100vh', background: 'radial-gradient(circle at 50% 30%, #FBF8F1, #F1E9D9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>
      <div style={{ fontFamily: serif, fontSize: 26, fontWeight: 600, color: C.greenDeep, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: C.sub, maxWidth: 440, lineHeight: 1.5 }}>{body}</div>
      <div style={{ marginTop: 20, fontSize: 12.5, color: C.muted }}>Signed in as {user?.email ?? user?.uid}</div>
      <button onClick={() => void signOut()} style={{ marginTop: 10, background: 'transparent', border: 'none', color: C.green, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontSize: 13.5 }}>Sign out</button>
    </div>
  );
}

function NoAccess() {
  return <GateShell title="No access to this competition" body="This account is not a member of this competition. Ask the organizer for an invite, or sign in with the correct account." />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routed />
    </AuthProvider>
  );
}

function Splash() {
  return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.canvas, color: C.muted, fontFamily: serif }}>Loading…</div>;
}
