import { useState } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from '../../firebase/app';
import { useCollection, writeDoc, removeDoc, now } from '../../data/db';
import { generateJoinCode } from '../../onboarding/logic';
import { useTenant } from '../../tenant/TenantContext';
import type { AssignmentDoc, JoinCodeDoc, JudgeDoc, PanelDoc } from '../../data/types';
import { Badge } from '../vendor/badge';
import { Button } from '../vendor/button';
import { Dialog, DialogActions, DialogDescription, DialogTitle } from '../vendor/dialog';
import { Divider } from '../vendor/divider';
import { Field, Fieldset, Label } from '../vendor/fieldset';
import { Heading, Subheading } from '../vendor/heading';
import { Select } from '../vendor/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../vendor/table';
import { Text } from '../vendor/text';

/** Absolute join link a judge (or the display seat) redeems the code from — verbatim from Devices.tsx. */
function codeLink(orgId: string, compId: string, code: string) {
  return `${window.location.origin}/${orgId}/${compId}/join/${code}`;
}

/**
 * Provisioning: the judge-world door. Ported verbatim (same hooks, same
 * handler names, same tp() paths) from src/admin/Devices.tsx — that file's
 * "Set up this device" (mintJudgeToken hand-off) and "Join codes" (judges
 * bring their own device) sections, unified here as one page. window.confirm
 * on kickMember becomes a Dialog (confirmKickUid) with the same gating text;
 * the join-code Revoke action had no confirm in the source, so it stays a
 * direct action here too — no semantics invented either way.
 */
export function ProvisioningPage() {
  // ── Firestore data — verbatim from Devices.tsx ──────────────────────────
  const { orgId, compId, tp } = useTenant();
  const judges = [...useCollection<JudgeDoc>(tp('judges'))].sort((a, b) => a.name.localeCompare(b.name));
  const panels = useCollection<PanelDoc>(tp('panels'));
  const assignments = useCollection<AssignmentDoc>(tp('assignments'));
  const joinCodes = useCollection<JoinCodeDoc>(tp('joinCodes'));

  const [selectedJudgeId, setSelectedJudgeId] = useState<string | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [statusNote, setStatusNote] = useState<{ text: string; warn: boolean } | null>(null);
  const [kicking, setKicking] = useState<string | null>(null);

  // window.confirm('Kick this device? ...') -> Dialog (confirmKickUid); same
  // gating semantics as the source's kickMember (nothing happens on Cancel).
  const [confirmKickUid, setConfirmKickUid] = useState<string | null>(null);
  const kickMember = async (memberUid: string) => {
    setKicking(memberUid);
    try {
      await httpsCallable(getFunctions(app, 'us-central1'), 'removeMember')({ orgId, compId, memberUid });
    } catch (err) {
      setStatusNote({ text: (err as { message?: string })?.message ?? 'Could not remove the member.', warn: true });
    } finally {
      setKicking(null);
    }
  };

  /** Return the panel this judge belongs to, or undefined. */
  const panelFor = (judgeId: string) => panels.find((p) => p.judgeIds.includes(judgeId));

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
      const fn = httpsCallable<{ orgId: string; compId: string; judgeId: string }, { token: string }>(
        getFunctions(app, 'us-central1'),
        'mintJudgeToken',
      );
      const result = await fn({ orgId, compId, judgeId: selectedJudgeId });
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

  const kickTargetLabel = (() => {
    if (!confirmKickUid) return null;
    const judge = judges.find((j) => j.uid === confirmKickUid);
    return judge ? judge.name : 'Projector / display screen';
  })();

  return (
    <>
      <Heading>Provisioning</Heading>
      <Text className="mt-2">
        Bind a device to a judge for a one-tap hand-off, or generate a join code so judges connect their own device.
      </Text>

      <div className="mt-8">
        <Subheading>Assign this seat</Subheading>
        <Text className="mt-1">
          Bind a judge identity to this laptop. The device stays signed in (survives refresh + offline) and shows
          only the judge experience until re-provisioned.
        </Text>

        <Fieldset className="mt-4">
          <Field>
            <Label>Choose the judge for this seat</Label>
            <Select
              value={selectedJudgeId ?? ''}
              onChange={(e) => setSelectedJudgeId(e.target.value || null)}
            >
              <option value="">Select a judge…</option>
              {judges.map((judge) => {
                const panel = panelFor(judge.id);
                const slots = panel ? slotsFor(panel.id) : null;
                const panelLabel = panel ? ` — ${panel.name}${slots ? ` · ${slots}` : ''}` : ' — No panel assigned';
                return (
                  <option key={judge.id} value={judge.id}>
                    {judge.name}
                    {panelLabel}
                  </option>
                );
              })}
            </Select>
            {judges.length === 0 && <Text className="mt-2">No judges found.</Text>}
          </Field>
        </Fieldset>

        <div className="mt-4 flex items-center gap-3">
          <Button disabled={!selectedJudgeId || provisioning} onClick={() => void handleProvision()}>
            {provisioning ? 'Provisioning…' : 'Provision & hand over'}
          </Button>
          <Text>Connect once at setup to cache the queue &amp; photos for offline.</Text>
        </div>

        {statusNote && (
          <Text className={`mt-3 ${statusNote.warn ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
            {statusNote.text}
          </Text>
        )}
      </div>

      <Divider className="my-8" />

      <div>
        <Subheading>Join codes — judges bring their own device</Subheading>
        <Table className="mt-4 [--gutter:--spacing(6)]">
          <TableHead>
            <TableRow>
              <TableHeader>Seat</TableHeader>
              <TableHeader>Code</TableHeader>
              <TableHeader>State</TableHeader>
              <TableHeader className="text-right">Action</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {judges.map((j) => {
              const code = joinCodes.find((c) => c.role === 'judge' && c.judgeId === j.id);
              return (
                <TableRow key={j.id}>
                  <TableCell>{j.name}</TableCell>
                  <TableCell>{code ? <Badge className="font-mono">{code.id}</Badge> : '—'}</TableCell>
                  <TableCell>{j.uid ? 'Connected ✓' : code ? 'Waiting' : '—'}</TableCell>
                  <TableCell className="text-right">
                    {j.uid ? (
                      <Button plain disabled={kicking === j.uid} onClick={() => setConfirmKickUid(j.uid!)}>
                        {kicking === j.uid ? 'Kicking…' : 'Kick'}
                      </Button>
                    ) : code ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          plain
                          onClick={() => {
                            void navigator.clipboard.writeText(codeLink(orgId, compId, code.id));
                          }}
                        >
                          Copy link
                        </Button>
                        <Button
                          plain
                          className="text-red-600 dark:text-red-400"
                          onClick={() => {
                            void removeDoc(tp(`joinCodes/${code.id}`));
                          }}
                        >
                          Revoke
                        </Button>
                      </div>
                    ) : (
                      <Button
                        outline
                        onClick={() => {
                          void writeDoc(
                            tp(`joinCodes/${generateJoinCode()}`),
                            { role: 'judge', judgeId: j.id, redeemedBy: null, createdAt: now() },
                            false,
                          );
                        }}
                      >
                        Generate code
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {(() => {
              const code = joinCodes.find((c) => c.role === 'display');
              return (
                <TableRow>
                  <TableCell>Projector / display screen</TableCell>
                  <TableCell>{code ? <Badge className="font-mono">{code.id}</Badge> : '—'}</TableCell>
                  <TableCell>{code?.redeemedBy ? 'Connected ✓' : code ? 'Waiting' : '—'}</TableCell>
                  <TableCell className="text-right">
                    {code?.redeemedBy ? (
                      <Button plain disabled={kicking === code.redeemedBy} onClick={() => setConfirmKickUid(code.redeemedBy!)}>
                        {kicking === code.redeemedBy ? 'Kicking…' : 'Kick'}
                      </Button>
                    ) : code ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          plain
                          onClick={() => {
                            void navigator.clipboard.writeText(codeLink(orgId, compId, code.id));
                          }}
                        >
                          Copy link
                        </Button>
                        <Button
                          plain
                          className="text-red-600 dark:text-red-400"
                          onClick={() => {
                            void removeDoc(tp(`joinCodes/${code.id}`));
                          }}
                        >
                          Revoke
                        </Button>
                      </div>
                    ) : (
                      <Button
                        outline
                        onClick={() => {
                          void writeDoc(
                            tp(`joinCodes/${generateJoinCode()}`),
                            { role: 'display', redeemedBy: null, createdAt: now() },
                            false,
                          );
                        }}
                      >
                        Generate code
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })()}
          </TableBody>
        </Table>
      </div>

      {/*
       * THE BOUNDARY FRAME. Spec-mandated exception (Task 12 brief): this is the
       * one place in the entire portal where competition-day styling — the cream
       * card background and deep-green judge-world palette — is allowed, via
       * arbitrary-value Tailwind classes (bg-[#F6EFDA], text-[#16413B]). Nowhere
       * else in src/portal may use inline colors or C dot-star theme imports;
       * this card is the single sanctioned exception, scoped to itself. Content below
       * reuses Devices.tsx's "what the judge receives" hand-off preview verbatim.
       */}
      <div className="mt-8 rounded-xl border bg-[#F6EFDA] p-6">
        <Text className="text-base font-semibold text-[#16413B]">What the judge sees</Text>
        <Text className="mt-1 text-[#16413B]/70">
          Judges get the branded competition-day experience from here on.
        </Text>

        <div className="mt-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-7 flex-none items-center justify-center rounded-full bg-[#16413B]/10 text-sm font-bold text-[#16413B]">
              1
            </span>
            <div>
              <div className="text-sm font-semibold text-[#16413B]">A judge-scoped session</div>
              <div className="mt-0.5 text-sm text-[#16413B]/80">
                A custom token stamped with the judge role + ID; persists through refresh and offline.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex size-7 flex-none items-center justify-center rounded-full bg-[#16413B]/10 text-sm font-bold text-[#16413B]">
              2
            </span>
            <div>
              <div className="text-sm font-semibold text-[#16413B]">No resident admin credential</div>
              <div className="mt-0.5 text-sm text-[#16413B]/80">
                Admin briefly authenticates to provision, then the device falls back to judge mode.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex size-7 flex-none items-center justify-center rounded-full bg-[#16413B]/10 text-sm font-bold text-[#16413B]">
              3
            </span>
            <div>
              <div className="text-sm font-semibold text-[#16413B]">Lands on the welcome screen</div>
              <div className="mt-0.5 text-sm text-[#16413B]/80">
                &ldquo;Welcome, [Judge Name]&rdquo; &mdash; ready to hand over. No password for the judge.
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={confirmKickUid !== null} onClose={() => setConfirmKickUid(null)}>
        <DialogTitle>Kick this device?</DialogTitle>
        <DialogDescription>
          {kickTargetLabel ?? 'This device'} loses access immediately; generate a new code to re-admit.
        </DialogDescription>
        <DialogActions>
          <Button plain onClick={() => setConfirmKickUid(null)}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={() => {
              const uid = confirmKickUid;
              setConfirmKickUid(null);
              if (uid) void kickMember(uid);
            }}
          >
            Kick
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
