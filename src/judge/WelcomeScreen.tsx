import { JUDGE } from './sampleQueue';

const serif = "'Spectral', serif";

/** Branded judge welcome — device is pre-bound to the judge; no login. */
export default function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ width: '100%', height: '100vh', background: 'radial-gradient(circle at 50% 32%, #FBF8F1, #F1E9D9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 40, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <span style={{ width: 90, height: 1, background: 'linear-gradient(90deg, transparent, #D8C9A4)' }} />
        <span style={{ width: 7, height: 7, background: '#B99644', transform: 'rotate(45deg)', display: 'inline-block' }} />
        <span style={{ width: 90, height: 1, background: 'linear-gradient(90deg, #D8C9A4, transparent)' }} />
      </div>

      <img src="/ibn-katheer-logo.svg" alt="Ibn Katheer Qur'an Competition" style={{ width: 200, height: 150, objectFit: 'contain', marginBottom: 18 }} />
      <div style={{ fontFamily: "'El Messiri', sans-serif", fontSize: 22, color: '#9C7C34', direction: 'rtl', marginBottom: 12 }}>بسم الله</div>
      <div style={{ fontSize: 12.5, letterSpacing: '.22em', textTransform: 'uppercase', color: '#206560', fontWeight: 600, marginBottom: 12 }}>2026 Ibn Katheer Qur'an Competition</div>
      <div style={{ fontFamily: serif, fontSize: 44, fontWeight: 600, color: '#16413B', marginBottom: 8 }}>Welcome, {JUDGE.name}</div>
      <div style={{ fontSize: 15, color: '#6B6355', marginBottom: 34 }}>{JUDGE.panel} · {JUDGE.slotLabel}</div>

      <button onClick={onStart} style={{ background: '#206560', color: '#fff', fontSize: 16, fontWeight: 700, padding: '15px 48px', borderRadius: 6, border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(32,101,96,.28)' }}>
        Get Started
      </button>
    </div>
  );
}
