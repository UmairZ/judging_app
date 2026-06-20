import { useState } from 'react';
import { useCollection, useDocData, writeDoc, removeDoc, now } from '../data/db';
import type { EnrollmentDoc, ContestantDoc, SessionDoc, PanelDoc, AssignmentDoc, TiebreakDoc } from '../data/types';
import {
  DEFAULT_SCORING_CONFIG,
  enrollmentSummary,
  compareForLeaderboard,
  type ScoringConfig,
  type EnrollmentSummary,
} from '../scoring';
import { tieBreakMean } from '../scoring';
import { DEFAULT_STRUCTURE_CONFIG, generateSlots, slotId, type StructureConfig, type Slot } from '../domain/structure';
import { enrollmentId } from '../domain/ids';
import { C, serif, pct } from '../ui/theme';

interface Row {
  contestantId: string;
  name: string;
  summary: EnrollmentSummary;
  panelSize: number;
}

interface Adjusting {
  order: { id: string; name: string }[];
  note: string;
}

export default function Leaderboard() {
  const enrollments = useCollection<EnrollmentDoc>('enrollments');
  const contestants = useCollection<ContestantDoc>('contestants');
  const sessions = useCollection<SessionDoc>('sessions');
  const panels = useCollection<PanelDoc>('panels');
  const assignments = useCollection<AssignmentDoc>('assignments');
  const tiebreaks = useCollection<TiebreakDoc>('tiebreaks');
  const structure = useDocData<StructureConfig>('config/structure').data ?? DEFAULT_STRUCTURE_CONFIG;
  const cfg: ScoringConfig = useDocData<ScoringConfig>('config/scoring').data ?? DEFAULT_SCORING_CONFIG;

  const slots = generateSlots(structure);
  const [sel, setSel] = useState(0);
  const [adjusting, setAdjusting] = useState<Adjusting | null>(null);
  const slot: Slot | undefined = slots[sel] ?? slots[0];

  const catLabel = (id: string) => structure.categories.find((c) => c.id === id)?.label ?? id;
  const divLabel = (id: string) => structure.divisions.find((d) => d.id === id)?.label ?? id;

  const assignment = assignments.find((a) => a.category === slot?.category && a.division === slot?.division);
  const panel = panels.find((p) => p.id === assignment?.panelId);
  const panelSize = panel?.judgeIds.length ?? 3;

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

  const rows: Row[] = !slot
    ? []
    : enrollments
        .filter((e) => e.category === slot.category && e.division === slot.division)
        .filter((e) => contestants.some((c) => c.id === e.contestantId)) // skip orphaned enrollments
        .map((e) => ({
          contestantId: e.contestantId,
          name: contestants.find((c) => c.id === e.contestantId)?.fullName ?? '—',
          summary: enrollmentSummary(sessions.filter((s) => s.enrollmentId === e.id), cfg),
          panelSize,
        }))
        .sort((a, b) => {
          // A manual override sets the exact order outright; otherwise primary score,
          // with the tie-break order only separating genuinely-tied contestants.
          if (tb?.method === 'override' && tbOrder.length) return tbIdx(a.contestantId) - tbIdx(b.contestantId);
          const c = compareForLeaderboard(a.summary, b.summary);
          if (c !== 0) return c;
          return tbIdx(a.contestantId) - tbIdx(b.contestantId);
        });

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
    await writeDoc(`tiebreaks/${slotId(slot)}`, {
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
    await writeDoc(`tiebreaks/${slotId(slot)}`, {
      category: slot.category, division: slot.division,
      contestantIds: tied,
      method: 'question',
      resolution: { order: [] },
      resolvedBy: 'admin', note: '', createdAt: now(),
    });
  };
  const clearTiebreak = async () => {
    if (slot) await removeDoc(`tiebreaks/${slotId(slot)}`);
  };

  return (
    <div style={{ background: C.cream, borderRadius: 8, boxShadow: '0 6px 22px rgba(20,40,36,.14)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '18px 26px', borderBottom: `1px solid ${C.line}`, background: C.greenDeep }}>
        <img src="/ibn-katheer-logo.svg" alt="" style={{ height: 32, width: 'auto', marginRight: 14, filter: 'brightness(0) invert(1)', opacity: 0.92 }} />
        <div>
          <div style={{ fontFamily: serif, fontSize: 19, fontWeight: 600, color: '#fff' }}>Live Leaderboard</div>
          <div style={{ fontSize: 12, color: '#9DBDB4' }}>Recomputed from synced sessions</div>
        </div>
        {rows.length > 1 && !adjusting && (
          <button onClick={openAdjust} style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, color: '#DCEAE6', background: '#11332D', border: '1px solid #3A6258', borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}>
            Adjust placements
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '14px 26px', borderBottom: `1px solid ${C.line}` }}>
        {slots.map((s, i) => {
          const on = i === sel;
          return (
            <button key={slotId(s)} onClick={() => { setSel(i); setAdjusting(null); }} style={{ fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 6, cursor: 'pointer', border: on ? 'none' : `1px solid ${C.cardLine}`, background: on ? C.gold : '#fff', color: on ? '#06211C' : C.sub }}>
              {catLabel(s.category)} · {divLabel(s.division)}
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
        const partial = r.summary.startedCount < r.panelSize;
        return (
          <div key={r.contestantId} style={{ display: 'grid', gridTemplateColumns: '56px 1fr 120px 110px 110px 150px', alignItems: 'center', padding: '15px 26px', borderBottom: `1px solid #F0EBDD`, background: i === 0 ? '#FCF7E9' : 'transparent' }}>
            <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 700, color: i === 0 ? C.brass : C.sub }}>{rank}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 15.5, fontWeight: 600, color: C.ink }}>{r.name}</span>
              {stillTied && <span style={{ fontSize: 11, fontWeight: 700, color: C.brassDark, background: C.pill, padding: '3px 8px', borderRadius: 999 }}>TIE</span>}
            </div>
            <span style={{ textAlign: 'center', fontFamily: serif, fontSize: 24, fontWeight: 700, color: r.summary.score == null ? '#9A938A' : C.greenDeep }}>
              {r.summary.score == null ? '—' : r.summary.score.toFixed(1)}{partial && r.summary.score != null ? <span style={{ fontSize: 12, color: '#B6AE9C' }}>*</span> : null}
            </span>
            <span style={{ textAlign: 'center', fontSize: 14, color: '#41504B' }}>{pct(r.summary.hBar)}</span>
            <span style={{ textAlign: 'center', fontSize: 14, color: '#41504B' }}>{pct(r.summary.tBar)}</span>
            <span style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: partial ? C.brassDark : C.green }}>
              {r.summary.startedCount} / {r.panelSize}{partial ? ' · moving' : ' judges'}
            </span>
          </div>
        );
      })}
      {rows.some((r) => r.summary.startedCount < r.panelSize) && (
        <div style={{ padding: '12px 26px', fontSize: 12, color: '#9A938A' }}><span style={{ color: '#B6AE9C' }}>*</span> Partial — averages only started sessions; still moving until all judges finish.</div>
      )}
    </div>
  );
}
