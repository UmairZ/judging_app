import { useState } from 'react';
import SignInScreen from './SignInScreen';
import { C, serif, arabic } from '../ui/theme';

const FEATURES: { title: string; body: string }[] = [
  { title: 'Live judging', body: 'Judges score on their own phones or provisioned devices — offline-tolerant, synced the moment connectivity returns.' },
  { title: 'Fair scoring', body: 'Hifz, tajweed, and voice weighted your way. Raw deductions are the source of truth; scores recompute instantly when config changes.' },
  { title: 'Instant results', body: 'A live leaderboard and projector mode, recomputed from every synced session — no spreadsheets on finals night.' },
];

export default function LandingPage() {
  const [signIn, setSignIn] = useState(false);
  if (signIn) return <SignInScreen />;

  const cta: React.CSSProperties = { fontSize: 15, fontWeight: 700, padding: '13px 28px', borderRadius: 8, cursor: 'pointer', border: 'none' };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 50% 20%, #FBF8F1, #F1E9D9)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 24px' }}>
      <div style={{ maxWidth: 780, textAlign: 'center', paddingTop: '14vh' }}>
        <div style={{ fontFamily: arabic, fontSize: 20, color: C.brassDark, direction: 'rtl', marginBottom: 14 }}>بسم الله</div>
        <h1 style={{ fontFamily: serif, fontSize: 42, fontWeight: 600, color: C.greenDeep, margin: '0 0 14px', lineHeight: 1.15 }}>
          Run your Qur'an competition, end to end
        </h1>
        <p style={{ fontSize: 16.5, color: C.sub, lineHeight: 1.6, margin: '0 auto 30px', maxWidth: 560 }}>
          Registration to leaderboard: multi-judge scoring, live results, and projector-ready standings — built for memorization contests of any size.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 60 }}>
          <button onClick={() => setSignIn(true)} style={{ ...cta, background: C.green, color: '#fff' }}>Get started — it's free</button>
          <button onClick={() => setSignIn(true)} style={{ ...cta, background: 'transparent', color: C.green, border: `1.5px solid ${C.green}` }}>Sign in</button>
        </div>
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', paddingBottom: 60 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ flex: '1 1 200px', maxWidth: 240, background: C.cream, borderRadius: 10, padding: '18px 20px', textAlign: 'left', boxShadow: '0 4px 16px rgba(20,40,36,.08)' }}>
              <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 600, color: C.greenDeep, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.55 }}>{f.body}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.muted, paddingBottom: 30 }}>
          Open source — run it yourself, or sign up and go.
        </div>
      </div>
    </div>
  );
}
