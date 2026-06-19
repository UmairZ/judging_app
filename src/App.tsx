import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import JudgeApp from './judge/JudgeApp';
import AdminApp from './admin/AdminApp';
import { C, serif, arabic } from './ui/theme';

function Routed() {
  const { role, loading } = useAuth();
  const [preview, setPreview] = useState<null | 'judge' | 'admin'>(null);

  if (loading) return <Splash />;
  // Real auth (production): role drives the app.
  if (role === 'admin') return <AdminApp />;
  if (role === 'judge') return <JudgeApp />;
  // Dev preview (no auth yet): navigate either app to review the build.
  if (preview === 'judge') return <JudgeApp />;
  if (preview === 'admin') return <AdminApp onExit={() => setPreview(null)} />;
  return <DevLanding onJudge={() => setPreview('judge')} onAdmin={() => setPreview('admin')} />;
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

function DevLanding({ onJudge, onAdmin }: { onJudge: () => void; onAdmin: () => void }) {
  const btn = { fontSize: 16, fontWeight: 700, padding: '15px 40px', borderRadius: 6, border: 'none', cursor: 'pointer', color: '#fff' };
  return (
    <div style={{ height: '100vh', background: 'radial-gradient(circle at 50% 32%, #FBF8F1, #F1E9D9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <img src="/ibn-katheer-logo.svg" alt="" style={{ width: 180, height: 135, objectFit: 'contain', marginBottom: 16 }} />
      <div style={{ fontFamily: arabic, fontSize: 20, color: C.brassDark, direction: 'rtl', marginBottom: 10 }}>بسم الله</div>
      <div style={{ fontSize: 12.5, letterSpacing: '.22em', textTransform: 'uppercase', color: C.green, fontWeight: 600, marginBottom: 8 }}>2026 Ibn Katheer Qur'an Competition</div>
      <div style={{ fontFamily: serif, fontSize: 34, fontWeight: 600, color: C.greenDeep, marginBottom: 6 }}>Judging System</div>
      <div style={{ fontSize: 14, color: C.sub, marginBottom: 30 }}>Dev preview — choose an app to review</div>
      <div style={{ display: 'flex', gap: 14 }}>
        <button onClick={onJudge} style={{ ...btn, background: C.green }}>Judge app</button>
        <button onClick={onAdmin} style={{ ...btn, background: C.brassDark }}>Admin app</button>
      </div>
    </div>
  );
}
