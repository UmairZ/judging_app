import { useState } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useCollection } from '../data/db';
import { useTenant } from '../tenant/TenantContext';
import type { JudgeDoc, PanelDoc, AssignmentDoc } from '../data/types';
import { app, auth } from '../firebase/app';
import { C, serif, initials } from '../ui/theme';

export default function Devices() {
  const { tp } = useTenant();
  const judges = [...useCollection<JudgeDoc>(tp('judges'))].sort((a, b) => a.name.localeCompare(b.name));
  const panels = useCollection<PanelDoc>(tp('panels'));
  const assignments = useCollection<AssignmentDoc>(tp('assignments'));

  const [selectedJudgeId, setSelectedJudgeId] = useState<string | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [statusNote, setStatusNote] = useState<{ text: string; warn: boolean } | null>(null);

  /** Return the panel this judge belongs to, or undefined. */
  const panelFor = (judgeId: string) =>
    panels.find((p) => p.judgeIds.includes(judgeId));

  /** Return a slot-label string for a panel (e.g. "Hifz · Brothers"). */
  const slotsFor = (panelId: string) => {
    const asgns = assignments.filter((a) => a.panelId === panelId);
    if (asgns.length === 0) return null;
    return asgns.map((a) => `${a.category} · ${a.division}`).join(', ');
  };

  const handleProvision = async () => {
    if (!selectedJudgeId) return;
    setProvisioning(true);
    setStatusNote(null);
    try {
      const fn = httpsCallable<{ judgeId: string }, { token: string }>(
        getFunctions(app, 'us-central1'),
        'mintJudgeToken',
      );
      const result = await fn({ judgeId: selectedJudgeId });
      await signInWithCustomToken(auth, result.data.token);
      setStatusNote({ text: 'Device provisioned. Handing over to judge…', warn: false });
    } catch {
      setStatusNote({
        text: 'Device provisioning is being rebuilt for the SaaS model — returns in a later update.',
        warn: true,
      });
    } finally {
      setProvisioning(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>

      {/* LEFT — assign seat card */}
      <div style={{ flex: '0 0 auto', minWidth: 300, maxWidth: 620 }}>
        <div style={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: 10 }}>
          Assign this seat
        </div>

        <div style={{ background: C.cream, borderRadius: 6, boxShadow: '0 6px 22px rgba(20,40,36,.14)', overflow: 'hidden' }}>

          {/* card header */}
          <div style={{ padding: '16px 22px', background: C.greenDeep, display: 'flex', alignItems: 'center' }}>
            <span style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, color: '#fff' }}>Set up this device</span>
            <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, color: '#DCEAE6', border: '1px solid #3A6258', padding: '5px 11px', borderRadius: 999 }}>
              Admin authenticated
            </span>
          </div>

          {/* card body */}
          <div style={{ padding: '20px 22px' }}>
            <p style={{ fontSize: 12.5, color: C.muted, marginBottom: 14, lineHeight: 1.55 }}>
              Bind a judge identity to this laptop. The device stays signed in (survives refresh + offline) and shows only the judge experience until re-provisioned.
            </p>

            <div style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A938A', fontWeight: 600, marginBottom: 10 }}>
              Choose the judge for this seat
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 18 }}>
              {judges.length === 0 && (
                <div style={{ fontSize: 13, color: C.muted, padding: '10px 0' }}>No judges found.</div>
              )}
              {judges.map((judge) => {
                const selected = selectedJudgeId === judge.id;
                const panel = panelFor(judge.id);
                const slots = panel ? slotsFor(panel.id) : null;
                const avatarLetters = initials(judge.name);

                return (
                  <div
                    key={judge.id}
                    role="radio"
                    aria-checked={selected}
                    tabIndex={0}
                    onClick={() => setSelectedJudgeId(judge.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelectedJudgeId(judge.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 13,
                      border: selected ? `2px solid ${C.green}` : `1.5px solid #E0D8C6`,
                      background: '#fff',
                      borderRadius: 10,
                      padding: '12px 15px',
                      cursor: 'pointer',
                      transition: 'border-color .15s',
                    }}
                  >
                    {/* radio dot */}
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        border: selected ? `5px solid ${C.green}` : `2px solid #C5BCA8`,
                        flex: 'none',
                        boxSizing: 'border-box',
                      }}
                    />

                    {/* avatar */}
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        background: selected
                          ? 'linear-gradient(135deg,#DCEAE6,#BcD3CD)'
                          : '#ECE6D8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: serif,
                        fontWeight: 600,
                        color: selected ? C.green : '#A89C82',
                        fontSize: 14,
                        flex: 'none',
                      }}
                    >
                      {avatarLetters}
                    </div>

                    {/* name + panel */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{judge.name}</div>
                      {panel && (
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>
                          {panel.name}{slots ? ` · ${slots}` : ''}
                        </div>
                      )}
                      {!panel && (
                        <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>No panel assigned</div>
                      )}
                    </div>

                    {selected && (
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: C.green, background: C.pillGreen, padding: '4px 10px', borderRadius: 999, flex: 'none' }}>
                        Selected
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* footer row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, color: C.muted }}>
                Connect once at setup to cache the queue &amp; photos for offline.
              </span>
              <button
                disabled={!selectedJudgeId || provisioning}
                onClick={handleProvision}
                style={{
                  marginLeft: 'auto',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  background: !selectedJudgeId || provisioning ? C.muted : C.green,
                  borderRadius: 8,
                  padding: '12px 22px',
                  border: 'none',
                  cursor: !selectedJudgeId || provisioning ? 'not-allowed' : 'pointer',
                  transition: 'background .15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {provisioning ? 'Provisioning…' : 'Provision & hand over →'}
              </button>
            </div>

            {/* inline status / error note */}
            {statusNote && (
              <div
                style={{
                  marginTop: 14,
                  fontSize: 12.5,
                  color: statusNote.warn ? C.brassDark : C.green,
                  background: statusNote.warn ? C.pill : C.pillGreen,
                  border: `1px solid ${statusNote.warn ? '#DcCFAE' : '#B5D4CB'}`,
                  borderRadius: 6,
                  padding: '10px 14px',
                  lineHeight: 1.5,
                }}
              >
                {statusNote.text}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT — what the judge receives */}
      <div style={{ flex: '0 0 auto', minWidth: 280, maxWidth: 420 }}>
        <div style={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: 10 }}>
          What the judge receives
        </div>

        <div style={{ background: C.cream, borderRadius: 6, boxShadow: '0 6px 22px rgba(20,40,36,.14)', padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* point 1 */}
          <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
            <span style={{ width: 30, height: 30, borderRadius: '50%', background: C.pillGreen, color: C.green, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              1
            </span>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: C.greenDeep }}>A judge-scoped session</div>
              <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5, marginTop: 2 }}>
                A custom token stamped with the judge role + ID; persists through refresh and offline.
              </div>
            </div>
          </div>

          {/* point 2 */}
          <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
            <span style={{ width: 30, height: 30, borderRadius: '50%', background: C.pillGreen, color: C.green, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              2
            </span>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: C.greenDeep }}>No resident admin credential</div>
              <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5, marginTop: 2 }}>
                Admin briefly authenticates to provision, then the device falls back to judge mode.
              </div>
            </div>
          </div>

          {/* point 3 */}
          <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
            <span style={{ width: 30, height: 30, borderRadius: '50%', background: C.pillGreen, color: C.green, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              3
            </span>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: C.greenDeep }}>Lands on the welcome screen</div>
              <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5, marginTop: 2 }}>
                &ldquo;Welcome, [Judge Name]&rdquo; &mdash; ready to hand over. No password for the judge.
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
