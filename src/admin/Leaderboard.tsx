import { useState, useEffect } from 'react';
import { useCollection, useDocData, writeDoc, removeDoc, now } from '../data/db';
import { useTenant } from '../tenant/TenantContext';
import type { EnrollmentDoc, ContestantDoc, SessionDoc, PanelDoc, AssignmentDoc, TiebreakDoc, JudgeDoc } from '../data/types';
import {
  DEFAULT_SCORING_CONFIG,
  enrollmentSummary,
  compareForLeaderboard,
  sessionScore,
  tieBreakMean,
  type ScoringConfig,
  type EnrollmentSummary,
} from '../scoring';
import { DEFAULT_STRUCTURE_CONFIG, generateSlots, slotId, type StructureConfig, type Slot } from '../domain/structure';
import { enrollmentId } from '../domain/ids';
import { judgesFinishedLabel } from './logic';
import Wordmark from '../ui/Wordmark';
import { C, serif, pct } from '../ui/theme';
import GradingScreen from '../judge/GradingScreen';
import Projector from './Projector';

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

export default function Leaderboard() {
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
    a.download = `ubayy-results-${new Date().toISOString().slice(0, 10)}.csv`;
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
    <div style={{ background: C.cream, borderRadius: 8, boxShadow: '0 6px 22px rgba(20,40,36,.14)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '18px 26px', borderBottom: `1px solid ${C.line}`, background: C.greenDeep }}>
        <div style={{ marginRight: 14 }}><Wordmark size={24} onDark /></div>
        <div>
          <div style={{ fontFamily: serif, fontSize: 19, fontWeight: 600, color: '#fff' }}>Live Leaderboard</div>
          <div style={{ fontSize: 12, color: '#9DBDB4' }}>Recomputed from synced sessions</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button onClick={exportResults} title="Download every slot's standings as CSV" style={{ fontSize: 12.5, fontWeight: 600, color: '#DCEAE6', background: '#11332D', border: '1px solid #3A6258', borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}>
            Export CSV
          </button>
          {rows.length > 1 && !adjusting && (
            <button onClick={openAdjust} style={{ fontSize: 12.5, fontWeight: 600, color: '#DCEAE6', background: '#11332D', border: '1px solid #3A6258', borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}>
              Adjust placements
            </button>
          )}
          <button onClick={() => setProjecting(true)} title="Full-screen standings for the audience" style={{ fontSize: 12.5, fontWeight: 700, color: '#06211C', background: C.gold, border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}>
            ▶ Projector mode
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '14px 26px', borderBottom: `1px solid ${C.line}` }}>
        {slots.map((s, i) => {
          const on = i === sel;
          return (
            <button key={slotId(s)} onClick={() => { setSel(i); setAdjusting(null); }} style={{ fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 6, cursor: 'pointer', border: on ? 'none' : `1px solid ${C.cardLine}`, background: on ? C.gold : '#fff', color: on ? '#06211C' : C.sub }}>
              {catLabel(s.category)} · {divLabel(s.division)} · {rankRowsForSlot(s).length}
            </button>
          );
        })}
      </div>

      {/* status banners */}
      {unresolvedTie && !adjusting && (
        <div style={{ padding: '12px 26px', background: C.pill, borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.brassDark }}>⚖︎ Tie — {tiedIds.size} contestants level</span>
          <span style={{ fontSize: 12.5, color: C.sub }}>after the automatic tie-breakers.</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={startSuddenDeath} style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', background: C.green, border: 'none', borderRadius: 6, padding: '7px 14px', cursor: 'pointer' }}>Start sudden-death →</button>
            <button onClick={openAdjust} style={{ fontSize: 12.5, fontWeight: 600, color: C.sub, background: '#fff', border: `1px solid ${C.cardLine}`, borderRadius: 6, padding: '7px 14px', cursor: 'pointer' }}>Adjust manually</button>
          </div>
        </div>
      )}
      {sdInProgress && !adjusting && (
        <div style={{ padding: '12px 26px', background: C.pill, borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.brassDark }}>⏱ Sudden-death in progress</span>
          <span style={{ fontSize: 12.5, color: C.sub }}>judges are grading the tie-break for {tb!.contestantIds.map((id) => contestants.find((c) => c.id === id)?.fullName ?? '—').join(', ')}.</span>
          <button onClick={clearTiebreak} style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, color: C.fail, background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
        </div>
      )}
      {resolved && !adjusting && (
        <div style={{ padding: '10px 26px', background: C.pillGreen, borderBottom: `1px solid ${C.line}`, fontSize: 12.5, color: C.green, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>Placements set {tb!.method === 'question' ? 'by sudden-death' : 'manually by admin'}{tb!.note ? ` — ${tb!.note}` : ''}.</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 14 }}>
            <button onClick={openAdjust} style={{ fontSize: 12.5, fontWeight: 600, color: C.green, background: 'none', border: 'none', cursor: 'pointer' }}>Adjust</button>
            <button onClick={clearTiebreak} style={{ fontSize: 12.5, fontWeight: 600, color: C.fail, background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
          </div>
        </div>
      )}
      {adjusting && (
        <div style={{ padding: '16px 26px', background: C.parchment, borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 600, color: C.greenDeep, marginBottom: 4 }}>Adjust placements — {slot ? `${catLabel(slot.category)} · ${divLabel(slot.division)}` : ''}</div>
          <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 12 }}>Set the final order by hand (in consultation with the panel). Primary scores are untouched — this only overrides the displayed ranking.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
            {adjusting.order.map((o, idx) => (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 8, padding: '9px 13px' }}>
                <span style={{ fontFamily: serif, fontSize: 16, fontWeight: 700, color: C.brass, width: 20 }}>{idx + 1}</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.ink }}>{o.name}</span>
                <button onClick={() => move(idx, -1)} disabled={idx === 0} style={{ border: `1px solid ${C.cardLine}`, background: '#fff', borderRadius: 6, cursor: idx === 0 ? 'default' : 'pointer', padding: '4px 9px', color: C.sub, opacity: idx === 0 ? 0.4 : 1 }}>↑</button>
                <button onClick={() => move(idx, 1)} disabled={idx === adjusting.order.length - 1} style={{ border: `1px solid ${C.cardLine}`, background: '#fff', borderRadius: 6, cursor: idx === adjusting.order.length - 1 ? 'default' : 'pointer', padding: '4px 9px', color: C.sub, opacity: idx === adjusting.order.length - 1 ? 0.4 : 1 }}>↓</button>
              </div>
            ))}
          </div>
          <input value={adjusting.note} onChange={(e) => setAdjusting((r) => (r ? { ...r, note: e.target.value } : r))} placeholder="Reason (optional) — e.g. sudden-death result, panel decision" style={{ width: '100%', fontSize: 13, padding: '9px 12px', border: `1px solid ${C.cardLine}`, borderRadius: 7, outline: 'none', background: '#fff', marginBottom: 12, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setAdjusting(null)} style={{ fontSize: 13, color: C.sub, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 14px' }}>Cancel</button>
            <button onClick={saveAdjust} style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: C.green, border: 'none', borderRadius: 7, padding: '8px 18px', cursor: 'pointer' }}>Save order</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 120px 110px 110px 150px', alignItems: 'center', padding: '12px 26px', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A938A', fontWeight: 600, borderBottom: `1px solid ${C.line}` }}>
        <span>Rank</span><span>Contestant</span><span style={{ textAlign: 'center' }}>Score</span><span style={{ textAlign: 'center' }}>Hifz</span><span style={{ textAlign: 'center' }}>Tajweed</span><span style={{ textAlign: 'center' }}>Panel</span>
      </div>

      {rows.length === 0 && <div style={{ padding: '36px 26px', textAlign: 'center', color: C.muted, fontSize: 14 }}>No contestants in this slot yet.</div>}

      {rows.map((r, i) => {
        const prev = rows[i - 1];
        const stillTied = tiedIds.has(r.contestantId);
        const tie = prev && compareForLeaderboard(prev.summary, r.summary) === 0 && stillTied;
        const rank = tie ? '—' : i + 1;
        const allFinal = r.panelSize > 0 && r.finalizedCount >= r.panelSize;
        const partial = !allFinal; // score is provisional until every judge has finalized
        const statusText = allFinal
          ? `${judgesFinishedLabel(r.panelSize, r.panelSize)} ✓ FINAL`
          : r.summary.startedCount > 0
            ? `${judgesFinishedLabel(r.finalizedCount, r.panelSize)} · in progress`
            : `${judgesFinishedLabel(0, r.panelSize)} · not started`;
        const statusColor = allFinal ? C.green : r.summary.startedCount > 0 ? C.brassDark : C.muted;
        const open = expandedId === r.contestantId;
        return (
          <div key={r.contestantId}>
            <div onClick={() => setExpandedId(open ? null : r.contestantId)} title="Show judge scores" style={{ display: 'grid', gridTemplateColumns: '56px 1fr 120px 110px 110px 150px', alignItems: 'center', padding: '15px 26px', borderBottom: `1px solid #F0EBDD`, background: open || i === 0 ? '#FCF7E9' : 'transparent', cursor: 'pointer' }}>
              <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 700, color: i === 0 ? C.brass : C.sub }}>{rank}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontSize: 11, color: C.muted, width: 10 }}>{open ? '▾' : '▸'}</span>
                <span style={{ fontSize: 15.5, fontWeight: 600, color: C.ink }}>{r.name}</span>
                {stillTied && <span style={{ fontSize: 11, fontWeight: 700, color: C.brassDark, background: C.pill, padding: '3px 8px', borderRadius: 999 }}>TIE</span>}
              </div>
              <span style={{ textAlign: 'center', fontFamily: serif, fontSize: 24, fontWeight: 700, color: r.summary.score == null ? '#9A938A' : C.greenDeep }}>
                {r.summary.score == null ? '—' : r.summary.score.toFixed(1)}{partial && r.summary.score != null ? <span style={{ fontSize: 12, color: '#B6AE9C' }}>*</span> : null}
              </span>
              <span style={{ textAlign: 'center', fontSize: 14, color: '#41504B' }}>{pct(r.summary.hBar)}</span>
              <span style={{ textAlign: 'center', fontSize: 14, color: '#41504B' }}>{pct(r.summary.tBar)}</span>
              <span style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: statusColor }}>
                {statusText}
              </span>
            </div>
            {open && (
              <div style={{ background: C.parchment, borderBottom: `1px solid ${C.line}`, padding: '12px 26px 15px 92px' }}>
                <div style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: 9 }}>Judge scores — Edit to correct a judge's marks</div>
                {(panel?.judgeIds ?? []).length === 0 && <div style={{ fontSize: 13, color: C.muted }}>No panel assigned to this slot.</div>}
                {[...(panel?.judgeIds ?? [])].sort((a, b) => (judges.find((j) => j.id === a)?.name ?? '').localeCompare(judges.find((j) => j.id === b)?.name ?? '')).map((jid) => {
                  const sess = sessions.find((s) => s.id === `${r.enrollmentId}__${jid}`);
                  const has = !!sess && (sess.questions?.length ?? 0) > 0;
                  const js = has ? sessionScore({ enrollmentId: r.enrollmentId, judgeId: jid, questions: sess!.questions }, cfg) : null;
                  const finalized = sess?.finalizedAt != null;
                  return (
                    <div key={jid} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 8, padding: '9px 14px', marginBottom: 7, maxWidth: 520 }}>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.ink }}>{judges.find((j) => j.id === jid)?.name ?? jid}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: finalized ? C.green : has ? C.brassDark : C.muted }}>{finalized ? 'Graded' : has ? 'In progress' : 'Not started'}</span>
                      <span style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, color: js == null ? C.muted : C.greenDeep, minWidth: 50, textAlign: 'right' }}>{js == null ? '—' : js.toFixed(1)}</span>
                      <button onClick={() => openEdit(r, jid)} style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', background: C.green, border: 'none', borderRadius: 6, padding: '7px 16px', cursor: 'pointer' }}>Edit</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {rows.some((r) => !(r.panelSize > 0 && r.finalizedCount >= r.panelSize)) && (
        <div style={{ padding: '12px 26px', fontSize: 12, color: '#9A938A' }}><span style={{ color: '#B6AE9C' }}>*</span> Provisional — a live average of started sessions; not final until every judge has tapped Finish.</div>
      )}

      {editing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          <Projector />
        </div>
      )}
    </div>
  );
}
