import { Fragment, useEffect, useState } from 'react';
import { useCollection, useDocData, writeDoc, removeDoc, now } from '../../data/db';
import { useTenant } from '../../tenant/TenantContext';
import type { EnrollmentDoc, ContestantDoc, SessionDoc, PanelDoc, AssignmentDoc, TiebreakDoc, JudgeDoc } from '../../data/types';
import {
  DEFAULT_SCORING_CONFIG,
  enrollmentSummary,
  compareForLeaderboard,
  sessionScore,
  tieBreakMean,
  type ScoringConfig,
  type EnrollmentSummary,
} from '../../scoring';
import { DEFAULT_STRUCTURE_CONFIG, generateSlots, slotId, type StructureConfig, type Slot } from '../../domain/structure';
import { enrollmentId } from '../../domain/ids';
import GradingScreen from '../../judge/GradingScreen';
import Projector from '../../admin/Projector';
import { Badge } from '../vendor/badge';
import { Button } from '../vendor/button';
import { Field, Fieldset, Label } from '../vendor/fieldset';
import { Heading, Subheading } from '../vendor/heading';
import { Input } from '../vendor/input';
import { Select } from '../vendor/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../vendor/table';
import { Text } from '../vendor/text';

/** `${Math.round(f * 100)}%` — src/ui/theme.ts's `pct()`, reimplemented locally
 * since portal files may not import theme.ts (same convention as
 * ContestantsPage.tsx's local `initials()`). */
function pct(f: number): string {
  return `${Math.round(f * 100)}%`;
}

interface Row {
  contestantId: string;
  enrollmentId: string;
  name: string;
  summary: EnrollmentSummary;
  panelSize: number;
  finalizedCount: number; // judges who tapped Finish (finalizedAt set)
}

interface Adjusting {
  order: { id: string; name: string }[];
  note: string;
}

interface Editing {
  enrollmentId: string;
  judgeId: string;
  name: string;
  slotLabel: string;
  minQuestions: number;
  meta: { position: number; total: number; panelName: string; judgeIndex: number; panelSize: number; startedCount: number };
}

/**
 * Leaderboard: chrome-only port of the retired admin Leaderboard screen. All data logic
 * below is ported verbatim from that file: same hooks, same handler names,
 * same tp() paths, same scoring imports (enrollmentSummary/
 * compareForLeaderboard/sessionScore/tieBreakMean). The scoring ENGINE and
 * GradingScreen/Projector (judge-world components) are untouched and reused
 * exactly as the source does.
 *
 * "Projector mode" here is the source's ACTUAL mechanism, verified against
 * the retired admin chrome (which only mounted the Leaderboard tab — no
 * route/window.open exists there) and `src/admin/Projector.tsx`: a local
 * `projecting` boolean that renders a full-screen <Projector/> overlay in
 * place, with Esc to exit. There is no `?projector=1` URL anywhere in this
 * codebase; that mechanism is not invented here.
 *
 * The source has no `window.confirm` anywhere (Adjust placements, sudden-death,
 * and clear-tiebreak are all confirm-free), so no Dialog is introduced for
 * this port — none of those actions needed one to preserve semantics.
 *
 * Category filter: rendered as a `Select` over `slots` (category×division
 * combinations from `generateSlots`), not Navbar-tabs — the default structure
 * config alone already yields 6 slots (4 categories × their divisions), and
 * structure is org-editable, so tabs would not scale evenly.
 *
 * Neither `structure` nor `cfg` (config/scoring) is gated on `.loading` here —
 * the source doesn't gate them either, it falls straight back to
 * DEFAULT_STRUCTURE_CONFIG / DEFAULT_SCORING_CONFIG. Nothing to preserve there.
 */
export function LeaderboardPage() {
  const { tp } = useTenant();
  const enrollments = useCollection<EnrollmentDoc>(tp('enrollments'));
  const contestants = useCollection<ContestantDoc>(tp('contestants'));
  const sessions = useCollection<SessionDoc>(tp('sessions'));
  const panels = useCollection<PanelDoc>(tp('panels'));
  const assignments = useCollection<AssignmentDoc>(tp('assignments'));
  const tiebreaks = useCollection<TiebreakDoc>(tp('tiebreaks'));
  const judges = useCollection<JudgeDoc>(tp('judges'));
  const structure = useDocData<StructureConfig>(tp('config/structure')).data ?? DEFAULT_STRUCTURE_CONFIG;
  const cfg: ScoringConfig = useDocData<ScoringConfig>(tp('config/scoring')).data ?? DEFAULT_SCORING_CONFIG;

  const slots = generateSlots(structure);
  const [sel, setSel] = useState(0);
  const [adjusting, setAdjusting] = useState<Adjusting | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [projecting, setProjecting] = useState(false);
  const slot: Slot | undefined = slots[sel] ?? slots[0];

  // Projector mode: Esc exits.
  useEffect(() => {
    if (!projecting) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setProjecting(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [projecting]);

  const catLabel = (id: string) => structure.categories.find((c) => c.id === id)?.label ?? id;
  const divLabel = (id: string) => structure.divisions.find((d) => d.id === id)?.label ?? id;

  const assignment = assignments.find((a) => a.category === slot?.category && a.division === slot?.division);
  const panel = panels.find((p) => p.id === assignment?.panelId);

  // tie-break resolution for this slot (if recorded)
  const tb = tiebreaks.find((t) => t.category === slot?.category && t.division === slot?.division);
  const rawOrder: string[] = ((tb?.resolution as { order?: string[] } | undefined)?.order) ?? [];
  // A sudden-death's order is computed live from the panel's tie-break grades; empty
  // (= still in progress) until every tied contestant has at least one grade in.
  const tbOrder: string[] = (() => {
    if (tb?.method !== 'question') return rawOrder;
    const scored = (tb.contestantIds ?? []).map((cid) => ({
      cid,
      m: tieBreakMean(sessions.filter((s) => s.enrollmentId === enrollmentId(cid, tb.category)), cfg),
    }));
    if (scored.length === 0 || scored.some((x) => x.m == null)) return [];
    return [...scored].sort((a, b) => (b.m as number) - (a.m as number)).map((x) => x.cid);
  })();
  const tbIdx = (cid: string) => {
    const i = tbOrder.indexOf(cid);
    return i < 0 ? Number.POSITIVE_INFINITY : i;
  };

  // Per-slot ranked rows — the single source of truth for both the on-screen board and the CSV export.
  const rankRowsForSlot = (sl: Slot): Row[] => {
    const t = tiebreaks.find((x) => x.category === sl.category && x.division === sl.division);
    const raw = ((t?.resolution as { order?: string[] } | undefined)?.order) ?? [];
    let order = raw;
    if (t?.method === 'question') {
      const scored = (t.contestantIds ?? []).map((cid) => ({ cid, m: tieBreakMean(sessions.filter((s) => s.enrollmentId === enrollmentId(cid, sl.category)), cfg) }));
      order = scored.length === 0 || scored.some((x) => x.m == null) ? [] : [...scored].sort((a, b) => (b.m as number) - (a.m as number)).map((x) => x.cid);
    }
    const idx = (cid: string) => { const i = order.indexOf(cid); return i < 0 ? Number.POSITIVE_INFINITY : i; };
    const ps = panels.find((p) => p.id === assignments.find((a) => a.category === sl.category && a.division === sl.division)?.panelId)?.judgeIds.length ?? 3;
    return enrollments
      .filter((e) => e.category === sl.category && e.division === sl.division)
      .filter((e) => contestants.some((c) => c.id === e.contestantId)) // skip orphaned enrollments
      .map((e) => ({
        contestantId: e.contestantId,
        enrollmentId: e.id,
        name: contestants.find((c) => c.id === e.contestantId)?.fullName ?? '—',
        summary: enrollmentSummary(sessions.filter((s) => s.enrollmentId === e.id), cfg),
        panelSize: ps,
        finalizedCount: sessions.filter((s) => s.enrollmentId === e.id && s.finalizedAt != null).length,
      }))
      .sort((a, b) => {
        // A manual override sets the exact order outright; otherwise primary score,
        // with the tie-break order only separating genuinely-tied contestants.
        if (t?.method === 'override' && order.length) return idx(a.contestantId) - idx(b.contestantId);
        const c = compareForLeaderboard(a.summary, b.summary);
        if (c !== 0) return c;
        return idx(a.contestantId) - idx(b.contestantId);
      });
  };

  const rows: Row[] = slot ? rankRowsForSlot(slot) : [];

  // contestants still tied (auto-comparator can't separate them and no tie-break resolves them)
  const tiedIds = new Set<string>();
  for (let i = 1; i < rows.length; i++) {
    if (compareForLeaderboard(rows[i - 1].summary, rows[i].summary) === 0 && tbIdx(rows[i].contestantId) === Number.POSITIVE_INFINITY) {
      tiedIds.add(rows[i - 1].contestantId);
      tiedIds.add(rows[i].contestantId);
    }
  }

  // sudden-death in progress: judges still grading the tie-break (no computed order yet)
  const sdInProgress = !!tb && tb.method === 'question' && tbOrder.length === 0;
  // resolved: an explicit order exists (admin override, or a completed sudden-death)
  const resolved = !!tb && tbOrder.length > 0;
  const unresolvedTie = tiedIds.size > 0 && !sdInProgress && !resolved;

  // Manual override (any time, any contestants in the slot) — admin's final say.
  const openAdjust = () => {
    setAdjusting({ order: rows.map((r) => ({ id: r.contestantId, name: r.name })), note: tb?.note ?? '' });
  };
  const move = (idx: number, dir: -1 | 1) => {
    setAdjusting((r) => {
      if (!r) return r;
      const j = idx + dir;
      if (j < 0 || j >= r.order.length) return r;
      const order = [...r.order];
      [order[idx], order[j]] = [order[j], order[idx]];
      return { ...r, order };
    });
  };
  const saveAdjust = async () => {
    if (!slot || !adjusting) return;
    await writeDoc(tp(`tiebreaks/${slotId(slot)}`), {
      category: slot.category, division: slot.division,
      contestantIds: adjusting.order.map((o) => o.id),
      method: 'override',
      resolution: { order: adjusting.order.map((o) => o.id) },
      resolvedBy: 'admin', note: adjusting.note, createdAt: now(),
    });
    setAdjusting(null);
  };
  // Admin kicks off a sudden-death; the panel judges grade it (computed ranking lands later).
  const startSuddenDeath = async () => {
    if (!slot) return;
    const tied = rows.filter((r) => tiedIds.has(r.contestantId)).map((r) => r.contestantId);
    await writeDoc(tp(`tiebreaks/${slotId(slot)}`), {
      category: slot.category, division: slot.division,
      contestantIds: tied,
      method: 'question',
      resolution: { order: [] },
      resolvedBy: 'admin', note: '', createdAt: now(),
    });
  };
  const clearTiebreak = async () => {
    if (slot) await removeDoc(tp(`tiebreaks/${slotId(slot)}`));
  };

  const exportResults = () => {
    const out: string[][] = [['Category', 'Division', 'Rank', 'Contestant', 'Score', 'Hifz %', 'Tajweed %', 'Finalized', 'Status']];
    for (const s of slots) {
      rankRowsForSlot(s).forEach((r, i) => {
        const allFinal = r.panelSize > 0 && r.finalizedCount >= r.panelSize;
        out.push([
          catLabel(s.category), divLabel(s.division), String(i + 1), r.name,
          r.summary.score == null ? '' : r.summary.score.toFixed(1),
          String(Math.round(r.summary.hBar * 100)), String(Math.round(r.summary.tBar * 100)),
          `${r.finalizedCount}/${r.panelSize}`, allFinal ? 'Final' : r.summary.startedCount > 0 ? 'In progress' : 'Not started',
        ]);
      });
    }
    const csv = out.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ibn-katheer-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  // Open one judge's session for the admin to correct (reuses the grading screen).
  const openEdit = (r: Row, jid: string) => {
    if (!slot || !panel) return;
    setEditing({
      enrollmentId: r.enrollmentId,
      judgeId: jid,
      name: r.name,
      slotLabel: `${catLabel(slot.category)} · ${divLabel(slot.division)}`,
      minQuestions: structure.categories.find((c) => c.id === slot.category)?.minQuestions ?? 4,
      meta: { position: 0, total: 0, panelName: panel.name, judgeIndex: panel.judgeIds.indexOf(jid) + 1, panelSize: panel.judgeIds.length, startedCount: r.summary.startedCount },
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Heading>Live Leaderboard</Heading>
          <Text className="mt-1">Recomputed from synced sessions</Text>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button outline onClick={exportResults} title="Download every slot's standings as CSV">
            Export CSV
          </Button>
          {rows.length > 1 && !adjusting && (
            <Button outline onClick={openAdjust}>
              Adjust placements
            </Button>
          )}
          <Button onClick={() => setProjecting(true)} title="Full-screen standings for the audience">
            ▶ Projector mode
          </Button>
        </div>
      </div>

      <div className="mt-6 max-w-xs">
        <Fieldset>
          <Field>
            <Label>Category · Division</Label>
            <Select
              value={String(sel)}
              onChange={(e) => { setSel(Number(e.target.value)); setAdjusting(null); }}
            >
              {slots.map((s, i) => (
                <option key={slotId(s)} value={i}>
                  {catLabel(s.category)} · {divLabel(s.division)}
                </option>
              ))}
            </Select>
          </Field>
        </Fieldset>
      </div>

      {/* status banners */}
      {unresolvedTie && !adjusting && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-400/10 p-4 dark:border-amber-400/20 dark:bg-amber-400/10">
          <Badge color="amber">⚖︎ Tie — {tiedIds.size} contestants level</Badge>
          <Text>after the automatic tie-breakers.</Text>
          <div className="ml-auto flex gap-2">
            <Button onClick={() => void startSuddenDeath()}>Start sudden-death →</Button>
            <Button outline onClick={openAdjust}>Adjust manually</Button>
          </div>
        </div>
      )}
      {sdInProgress && !adjusting && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-400/10 p-4 dark:border-amber-400/20 dark:bg-amber-400/10">
          <Badge color="amber">⏱ Sudden-death in progress</Badge>
          <Text>
            judges are grading the tie-break for {tb!.contestantIds.map((id) => contestants.find((c) => c.id === id)?.fullName ?? '—').join(', ')}.
          </Text>
          <Button plain className="ml-auto text-red-600 dark:text-red-500" onClick={() => void clearTiebreak()}>
            Cancel
          </Button>
        </div>
      )}
      {resolved && !adjusting && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/10 p-4 dark:border-green-500/20 dark:bg-green-500/10">
          <Text>
            Placements set {tb!.method === 'question' ? 'by sudden-death' : 'manually by admin'}{tb!.note ? ` — ${tb!.note}` : ''}.
          </Text>
          <div className="ml-auto flex gap-4">
            <Button plain onClick={openAdjust}>Adjust</Button>
            <Button plain className="text-red-600 dark:text-red-500" onClick={() => void clearTiebreak()}>Clear</Button>
          </div>
        </div>
      )}
      {adjusting && (
        <div className="mt-4 rounded-lg border border-zinc-950/10 p-5 dark:border-white/10">
          <Subheading>Adjust placements — {slot ? `${catLabel(slot.category)} · ${divLabel(slot.division)}` : ''}</Subheading>
          <Text className="mt-1">
            Set the final order by hand (in consultation with the panel). Primary scores are untouched — this only overrides the displayed ranking.
          </Text>
          <div className="mt-4 flex flex-col gap-2">
            {adjusting.order.map((o, idx) => (
              <div key={o.id} className="flex items-center gap-3 rounded-lg border border-zinc-950/10 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5">
                <span className="w-6 text-lg font-bold">{idx + 1}</span>
                <span className="flex-1 text-sm font-semibold">{o.name}</span>
                <Button outline onClick={() => move(idx, -1)} disabled={idx === 0}>↑</Button>
                <Button outline onClick={() => move(idx, 1)} disabled={idx === adjusting.order.length - 1}>↓</Button>
              </div>
            ))}
          </div>
          <Fieldset className="mt-4">
            <Field>
              <Label>Reason (optional)</Label>
              <Input
                value={adjusting.note}
                onChange={(e) => setAdjusting((r) => (r ? { ...r, note: e.target.value } : r))}
                placeholder="e.g. sudden-death result, panel decision"
              />
            </Field>
          </Fieldset>
          <div className="mt-4 flex justify-end gap-3">
            <Button plain onClick={() => setAdjusting(null)}>Cancel</Button>
            <Button onClick={() => void saveAdjust()}>Save order</Button>
          </div>
        </div>
      )}

      <Table className="mt-6 [--gutter:--spacing(6)]">
        <TableHead>
          <TableRow>
            <TableHeader>Rank</TableHeader>
            <TableHeader>Contestant</TableHeader>
            <TableHeader>Score</TableHeader>
            <TableHeader>Hifz</TableHeader>
            <TableHeader>Tajweed</TableHeader>
            <TableHeader>Panel</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6}>
                <Text>No contestants in this slot yet.</Text>
              </TableCell>
            </TableRow>
          )}
          {rows.map((r, i) => {
            const prev = rows[i - 1];
            const stillTied = tiedIds.has(r.contestantId);
            const tie = prev && compareForLeaderboard(prev.summary, r.summary) === 0 && stillTied;
            const rank = tie ? '—' : i + 1;
            const allFinal = r.panelSize > 0 && r.finalizedCount >= r.panelSize;
            const partial = !allFinal; // score is provisional until every judge has finalized
            const statusText = allFinal
              ? `${r.panelSize} / ${r.panelSize} ✓ FINAL`
              : r.summary.startedCount > 0
                ? `${r.finalizedCount} / ${r.panelSize} · in progress`
                : `0 / ${r.panelSize} · not started`;
            const statusColor = allFinal ? 'green' : r.summary.startedCount > 0 ? 'amber' : 'zinc';
            const open = expandedId === r.contestantId;
            return (
              <Fragment key={r.contestantId}>
                <TableRow className="cursor-pointer" title="Show judge scores" onClick={() => setExpandedId(open ? null : r.contestantId)}>
                  <TableCell className="font-semibold">{rank}</TableCell>
                  <TableCell>
                    <span className="font-medium">{r.name}</span>
                    {stillTied && (
                      <Badge color="amber" className="ml-2">TIE</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.summary.score == null ? '—' : r.summary.score.toFixed(1)}
                    {partial && r.summary.score != null ? <span className="text-zinc-400">*</span> : null}
                  </TableCell>
                  <TableCell>{pct(r.summary.hBar)}</TableCell>
                  <TableCell>{pct(r.summary.tBar)}</TableCell>
                  <TableCell>
                    <Badge color={statusColor}>{statusText}</Badge>
                  </TableCell>
                </TableRow>
                {open && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Text className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                        Judge scores — Edit to correct a judge&apos;s marks
                      </Text>
                      {(panel?.judgeIds ?? []).length === 0 && (
                        <Text className="mt-2">No panel assigned to this slot.</Text>
                      )}
                      <div className="mt-2 flex max-w-xl flex-col gap-2">
                        {[...(panel?.judgeIds ?? [])]
                          .sort((a, b) => (judges.find((j) => j.id === a)?.name ?? '').localeCompare(judges.find((j) => j.id === b)?.name ?? ''))
                          .map((jid) => {
                            const sess = sessions.find((s) => s.id === `${r.enrollmentId}__${jid}`);
                            const has = !!sess && (sess.questions?.length ?? 0) > 0;
                            const js = has ? sessionScore({ enrollmentId: r.enrollmentId, judgeId: jid, questions: sess!.questions }, cfg) : null;
                            const finalized = sess?.finalizedAt != null;
                            return (
                              <div key={jid} className="flex items-center gap-3 rounded-lg border border-zinc-950/10 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5">
                                <span className="flex-1 text-sm font-semibold">{judges.find((j) => j.id === jid)?.name ?? jid}</span>
                                <Badge color={finalized ? 'green' : has ? 'amber' : 'zinc'}>{finalized ? 'Graded' : has ? 'In progress' : 'Not started'}</Badge>
                                <span className="min-w-[50px] text-right text-sm font-bold">{js == null ? '—' : js.toFixed(1)}</span>
                                <Button onClick={() => openEdit(r, jid)}>Edit</Button>
                              </div>
                            );
                          })}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
      {rows.some((r) => !(r.panelSize > 0 && r.finalizedCount >= r.panelSize)) && (
        <Text className="mt-4 text-xs text-zinc-500">
          <span className="text-zinc-400">*</span> Provisional — a live average of started sessions; not final until every judge has tapped Finish.
        </Text>
      )}

      {editing && (
        <div className="fixed inset-0 z-[100]">
          <GradingScreen
            contestant={{ name: editing.name, slotLabel: editing.slotLabel }}
            enrollmentId={editing.enrollmentId}
            judgeId={editing.judgeId}
            minQuestions={editing.minQuestions}
            meta={editing.meta}
            onEnd={() => setEditing(null)}
          />
        </div>
      )}

      {projecting && (
        <div className="fixed inset-0 z-[200]">
          <Projector />
        </div>
      )}
    </>
  );
}
