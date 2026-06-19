import { C, serif, arabic } from '../ui/theme';

/** Branded judge welcome — device is pre-bound to the judge; no login. */
export default function WelcomeScreen({ name, subtitle, onStart }: { name: string; subtitle: string; onStart: () => void }) {
  return (
    <div style={{ width: '100%', height: '100vh', background: 'radial-gradient(circle at 50% 32%, #FBF8F1, #F1E9D9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 40, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <span style={{ width: 90, height: 1, background: 'linear-gradient(90deg, transparent, #D8C9A4)' }} />
        <span style={{ width: 7, height: 7, background: C.brass, transform: 'rotate(45deg)', display: 'inline-block' }} />
        <span style={{ width: 90, height: 1, background: 'linear-gradient(90deg, #D8C9A4, transparent)' }} />
      </div>

      <img src="/ibn-katheer-logo.svg" alt="Ibn Katheer Qur'an Competition" style={{ width: 200, height: 150, objectFit: 'contain', marginBottom: 18 }} />
      <div style={{ fontFamily: arabic, fontSize: 22, color: C.brassDark, direction: 'rtl', marginBottom: 12 }}>بسم الله</div>
      <div style={{ fontSize: 12.5, letterSpacing: '.22em', textTransform: 'uppercase', color: C.green, fontWeight: 600, marginBottom: 12 }}>2026 Ibn Katheer Qur'an Competition</div>
      <div style={{ fontFamily: serif, fontSize: 44, fontWeight: 600, color: C.greenDeep, marginBottom: 8 }}>Welcome, {name}</div>
      <div style={{ fontSize: 15, color: '#6B6355', marginBottom: 34 }}>{subtitle}</div>

      <button onClick={onStart} style={{ background: C.green, color: '#fff', fontSize: 16, fontWeight: 700, padding: '15px 48px', borderRadius: 6, border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(32,101,96,.28)' }}>
        Get Started
      </button>
    </div>
  );
}
