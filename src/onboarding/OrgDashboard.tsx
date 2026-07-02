import { useState } from 'react';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { app } from '../firebase/app';
import { useAuth } from '../auth/AuthContext';
import { useCollection } from '../data/db';
import { slugifyOrgId, validateIds } from './logic';
import { C, serif } from '../ui/theme';

interface OrgMirror { role: string; name: string }
interface CompDoc { name: string; status: string }

const fns = getFunctions(app, 'us-central1');
const input: React.CSSProperties = { background: '#fff', border: '1px solid #D8D0BE', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: C.ink, fontFamily: 'inherit', boxSizing: 'border-box', width: '100%', marginBottom: 10 };
const primaryBtn: React.CSSProperties = { background: C.green, color: '#fff', fontSize: 13.5, fontWeight: 700, padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer' };

export default function OrgDashboard() {
  const { user, signOut } = useAuth();
  const orgs = useCollection<OrgMirror>(`users/${user!.uid}/orgs`);
  const [creating, setCreating] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: C.canvas, padding: '40px 24px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ fontFamily: serif, fontSize: 26, fontWeight: 600, color: C.greenDeep }}>Your organizations</div>
          <div style={{ fontSize: 12.5, color: C.muted }}>
            {user?.email ?? user?.uid} · <span onClick={() => void signOut()} style={{ color: C.green, cursor: 'pointer', textDecoration: 'underline' }}>Sign out</span>
          </div>
        </div>

        {orgs.map((o) => <OrgSection key={o.id} orgId={o.id} name={o.name} />)}
        {orgs.length === 0 && !creating && (
          <div style={{ fontSize: 14, color: C.sub, marginBottom: 20 }}>No organizations yet — create one to run your first competition.</div>
        )}

        {creating ? (
          <CreateOrgForm onDone={() => setCreating(false)} />
        ) : (
          <button onClick={() => setCreating(true)} style={primaryBtn}>+ New organization</button>
        )}
      </div>
    </div>
  );
}

function OrgSection({ orgId, name }: { orgId: string; name: string }) {
  const comps = useCollection<CompDoc>(`orgs/${orgId}/competitions`);
  const [adding, setAdding] = useState(false);
  return (
    <div style={{ background: C.cream, borderRadius: 10, padding: '20px 24px', marginBottom: 18, boxShadow: '0 4px 16px rgba(20,40,36,.08)' }}>
      <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, color: C.greenDeep, marginBottom: 12 }}>{name} <span style={{ fontSize: 12, color: C.muted, fontFamily: 'inherit' }}>/{orgId}</span></div>
      {comps.map((c) => (
        <div key={c.id} onClick={() => { window.location.href = `/${orgId}/${c.id}`; }} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#fff', borderRadius: 8, marginBottom: 8, cursor: 'pointer', border: '1px solid #EAE3D3' }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: C.ink }}>{c.name}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{c.status} · /{orgId}/{c.id} →</div>
        </div>
      ))}
      {comps.length === 0 && <div style={{ fontSize: 13, color: C.sub, marginBottom: 8 }}>No competitions yet.</div>}
      {adding ? <CreateCompForm orgId={orgId} onDone={() => setAdding(false)} /> : (
        <button onClick={() => setAdding(true)} style={{ ...primaryBtn, background: 'transparent', color: C.green, border: `1px solid ${C.green}`, padding: '8px 14px' }}>+ New competition</button>
      )}
    </div>
  );
}

function CreateOrgForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [orgId, setOrgId] = useState('');
  const [idTouched, setIdTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateIds(orgId) || !name.trim()) { setError('Give the organization a name and a URL id (letters, numbers, - or _).'); return; }
    setBusy(true); setError('');
    try {
      await httpsCallable(fns, 'createOrg')({ orgId, name: name.trim() });
      onDone();
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not create the organization.');
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} style={{ background: C.cream, borderRadius: 10, padding: '20px 24px', maxWidth: 420 }}>
      <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 600, color: C.greenDeep, marginBottom: 12 }}>New organization</div>
      <input style={input} placeholder="Organization name" value={name} onChange={(e) => { setName(e.target.value); if (!idTouched) setOrgId(slugifyOrgId(e.target.value)); }} autoFocus />
      <input style={input} placeholder="URL id (e.g. ibn-katheer)" value={orgId} onChange={(e) => { setIdTouched(true); setOrgId(e.target.value); }} />
      {error && <div style={{ color: C.fail, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" disabled={busy} style={primaryBtn}>{busy ? 'Creating…' : 'Create'}</button>
        <button type="button" onClick={onDone} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
      </div>
    </form>
  );
}

function CreateCompForm({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [compId, setCompId] = useState('');
  const [idTouched, setIdTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateIds(compId) || !name.trim()) { setError('Give the competition a name and a URL id (letters, numbers, - or _).'); return; }
    setBusy(true); setError('');
    try {
      await httpsCallable(fns, 'createCompetition')({ orgId, compId, name: name.trim() });
      window.location.href = `/${orgId}/${compId}`;
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not create the competition.');
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} style={{ marginTop: 8 }}>
      <input style={input} placeholder="Competition name (e.g. 2027 Ramadan Contest)" value={name} onChange={(e) => { setName(e.target.value); if (!idTouched) setCompId(slugifyOrgId(e.target.value)); }} autoFocus />
      <input style={input} placeholder="URL id (e.g. 2027)" value={compId} onChange={(e) => { setIdTouched(true); setCompId(e.target.value); }} />
      {error && <div style={{ color: C.fail, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" disabled={busy} style={primaryBtn}>{busy ? 'Creating…' : 'Create & open'}</button>
        <button type="button" onClick={onDone} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
      </div>
    </form>
  );
}
