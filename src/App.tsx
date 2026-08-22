import { useMemo } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { MembershipProvider, useMembership } from './auth/MembershipContext';
import { TenantProvider, useTenant } from './tenant/TenantContext';
import { useDocData } from './data/db';
import { parseRoute } from './onboarding/logic';
import SignInScreen from './onboarding/SignInScreen';
import Landing from './marketing/Landing';
import OrgDashboard from './onboarding/OrgDashboard';
import JoinScreen from './onboarding/JoinScreen';
import JudgeApp from './judge/JudgeApp';
import AdminApp from './admin/AdminApp';
import Projector from './admin/Projector';
import { C, serif } from './ui/theme';

function Routed() {
  const { user, loading } = useAuth();
  const route = useMemo(() => parseRoute(window.location.pathname), []);
  // No dedicated /signin route exists yet; the landing page's "Sign in" link
  // points at /?signin=1, which this flag picks up to show SignInScreen in place
  // of the marketing page without introducing a new route kind.
  const wantsSignIn = useMemo(() => new URLSearchParams(window.location.search).get('signin') === '1', []);
  if (loading) return <Splash />;
  if (route.kind === 'join') return <JoinScreen orgId={route.orgId} compId={route.compId} code={route.code} />;
  if (!user) return route.kind === 'root' && !wantsSignIn ? <Landing /> : <SignInScreen />;
  if (route.kind === 'root') return <OrgDashboard />;
  return (
    <TenantProvider orgId={route.orgId} compId={route.compId}>
      <MembershipProvider>
        <RoleGate />
      </MembershipProvider>
    </TenantProvider>
  );
}

function RoleGate() {
  const { role, loading } = useMembership();
  const { orgId, compId } = useTenant();
  const comp = useDocData<{ name?: string }>(`orgs/${orgId}/competitions/${compId}`);
  if (loading || comp.loading) return <Splash />;
  // Org staff resolve to 'admin' even for a typo'd competition id — writing there
  // would create a ghost tenant. Gate on the competition doc actually existing.
  if (role === 'admin' && !comp.data) return <CompNotFound />;
  if (role === 'admin') return <AdminApp />;
  if (role === 'judge') return <JudgeApp />;
  if (role === 'display') return <Projector />;
  return <NoAccess />;
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
