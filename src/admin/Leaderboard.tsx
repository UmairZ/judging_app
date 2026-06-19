import { useState } from 'react';
import { useCollection, useDocData, writeDoc, now } from '../data/db';
import type { EnrollmentDoc, ContestantDoc, SessionDoc, PanelDoc, AssignmentDoc, TiebreakDoc } from '../data/types';
import {
  DEFAULT_SCORING_CONFIG,
  enrollmentSummary,
  compareForLeaderboard,
  type ScoringConfig,
  type EnrollmentSummary,
} from '../scoring';
import { DEFAULT_STRUCTURE_CONFIG, generateSlots, slotId, type StructureConfig, type Slot } from '../domain/structure';
import { C, serif, pct } from '../ui/theme';

interface Row {
  contestantId: string;
  name: string;
  summary: EnrollmentSummary;
  panelSize: number;
}

interface Resolving {
  method: 'question' | 'override';
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
  const [resolving, setResolving] = useState<Resolving | null>(null);
  const slot: Slot | undefined = slots[sel] ?? slots[0];

  const catLabel = (id: string) => structure.categories.find((c) => c.id === id)?.label ?? id;
  const divLabel = (id: string) => structure.divisions.find((d) => d.id === id)?.label ?? id;

  const assignment = assignments.find((a) => a.category === slot?.category && a.division === slot?.division);
  const panel = panels.find((p) => p.id === assignment?.panelId);
  const panelSize = panel?.judgeIds.length ?? 3;

  // tie-break resolution for this slot (if recorded)
  const tb = tiebreaks.find((t) => t.category === slot?.category && t.division === slot?.division);
  const tbOrder: string[] = ((tb?.resolution as { order?: string[] } | undefined)?.order) ?? [];
  const tbIdx = (cid: string) => {
    const i = tbOrder.indexOf(cid);
    return i < 0 ? Number.POSITIVE_INFINITY : i;
  };

  const rows: Row[] = !slot
    ? []
    : enrollments
        .filter((e) => e.category === slot.category && e.division === slot.division)
        .map((e) => ({
          contestantId: e.contestantId,
          name: contestants.find((c) => c.id === e.contestantId)?.fullName ?? '—',
          summary: enrollmentSummary(sessions.filter((s) => s.enrollmentId === e.id), cfg),
          panelSize,
        }))
        .sort((a, b) => {
          const c = compareForLeaderboard(a.summary, b.summary);
          if (c !== 0) return c;
          return tbIdx(a.contestantId) - tbIdx(b.contestantId); // resolved tie order, if any
        });

  // contestants still tied (auto-comparator can't separate them and no tie-break resolves them)
  const tiedIds = new Set<string>();
  for (let i = 1; i < rows.length; i++) {
    if (compareForLeaderboard(rows[i - 1].summary, rows[i].summary) === 0 && tbIdx(rows[i].contestantId) === Number.POSITIVE_INFINITY) {
      tiedIds.add(rows[i - 1].contestantId);
      tiedIds.add(rows[i].contestantId);
    }
  }

  const openResolve = () => {
    const tied = rows.filter((r) => tiedIds.has(r.contestantId));
    setResolving({ method: 'question', order: tied.map((r) => ({ id: r.contestantId, name: r.name })), note: '' });
  };
  const move = (idx: number, dir: -1 | 1) => {
    setResolving((r) => {
      if (!r) return r;
      const j = idx + dir;
      if (j < 0 || j >= r.order.length) return r;
      const order = [...r.order];
      [order[idx], order[j]] = [order[j], order[idx]];
      return { ...r, order };
    });
  };
  const saveResolution = async () => {
    if (!slot || !resolving) return;
    await writeDoc(`tiebreaks/${slotId(slot)}`, {
      category: slot.category,
      division: slot.division,
      contestantIds: resolving.order.map((o) => o.id),
      method: resolving.method,
      resolution: { order: resolving.order.map((o) => o.id) },
      resolvedBy: 'admin',
      note: resolving.note,
      createdAt: now(),
    });
    setResolving(null);
  };

  return (
    <div style={{ background: C.cream, borderRadius: 8, boxShadow: '0 6px 22px rgba(20,40,36,.14)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '18px 26px', borderBottom: `1px solid ${C.line}`, background: C.greenDeep }}>
        <img src="/ibn-katheer-logo.svg" alt="" style={{ height: 32, width: 'auto', marginRight: 14, filter: 'brightness(0) invert(1)', opacity: 0.92 }} />
        <div>
          <div style={{ fontFamily: serif, fontSize: 19, fontWeight: 600, color: '#fff' }}>Live Leaderboard</div>
          <div style={{ fontSize: 12, color: '#9DBDB4' }}>Recomputed from synced sessions</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '14px 26px', borderBottom: `1px solid ${C.line}` }}>
        {slots.map((s, i) => {
          const on = i === sel;
          return (
            <button key={slotId(s)} onClick={() => { setSel(i); setResolving(null); }} style={{ fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 6, cursor: 'pointer', border: on ? 'none' : `1px solid ${C.cardLine}`, background: on ? C.gold : '#fff', color: on ? '#06211C' : C.sub }}>
              {catLabel(s.category)} · {divLabel(s.division)}
            </button>
          );
        })}
      </div>

      {/* tie banner / resolution */}
      {tiedIds.size > 0 && !resolving && (
        <div style={{ padding: '12px 26px', background: C.pill, borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.brassDark }}>⚖︎ Tie at the top tier</span>
          <span style={{ fontSize: 12.5, color: C.sub }}>{tiedIds.size} contestants level after auto tie-breakers.</span>
          <button onClick={openResolve} style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, color: '#fff', background: C.green, border: 'none', borderRadius: 6, padding: '7px 14px', cursor: 'pointer' }}>Resolve tie →</button>
        </div>
      )}
      {tb && tiedIds.size === 0 && (
        <div style={{ padding: '10px 26px', background: C.pillGreen, borderBottom: `1px solid ${C.line}`, fontSize: 12.5, color: C.green }}>
          Tie resolved by {tb.method === 'question' ? 'sudden-death question' : 'judge override'}{tb.note ? ` — ${tb.note}` : ''}.
        </div>
      )}
      {resolving && (
        <div style={{ padding: '16px 26px', background: C.parchment, borderBottom: `1px solid ${C.line}` }}>
          <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 600, color: C.greenDeep, marginBottom: 4 }}>Resolve tie — {slot ? `${catLabel(slot.category)} · ${divLabel(slot.division)}` : ''}</div>
          <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 12 }}>Order the tied set. The order is recorded and applied to the leaderboard; primary scores are untouched.</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['question', 'override'] as const).map((m) => (
              <button key={m} onClick={() => setResolving((r) => (r ? { ...r, method: m } : r))} style={{ fontSize: 12.5, fontWeight: 600, padding: '7px 13px', borderRadius: 6, cursor: 'pointer', border: resolving.method === m ? 'none' : `1.5px solid ${C.cardLine}`, background: resolving.method === m ? C.green : '#fff', color: resolving.method === m ? '#fff' : C.sub }}>
                {m === 'question' ? 'Sudden-death question' : 'Manual override'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
            {resolving.order.map((o, idx) => (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 8, padding: '9px 13px' }}>
                <span style={{ fontFamily: serif, fontSize: 16, fontWeight: 700, color: C.brass, width: 20 }}>{idx + 1}</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.ink }}>{o.name}</span>
                <button onClick={() => move(idx, -1)} disabled={idx === 0} style={{ border: `1px solid ${C.cardLine}`, background: '#fff', borderRadius: 6, cursor: idx === 0 ? 'default' : 'pointer', padding: '4px 9px', color: C.sub, opacity: idx === 0 ? 0.4 : 1 }}>↑</button>
                <button onClick={() => move(idx, 1)} disabled={idx === resolving.order.length - 1} style={{ border: `1px solid ${C.cardLine}`, background: '#fff', borderRadius: 6, cursor: idx === resolving.order.length - 1 ? 'default' : 'pointer', padding: '4px 9px', color: C.sub, opacity: idx === resolving.order.length - 1 ? 0.4 : 1 }}>↓</button>
              </div>
            ))}
          </div>
          <input value={resolving.note} onChange={(e) => setResolving((r) => (r ? { ...r, note: e.target.value } : r))} placeholder="Note (e.g. sudden-death result, reason)" style={{ width: '100%', fontSize: 13, padding: '9px 12px', border: `1px solid ${C.cardLine}`, borderRadius: 7, outline: 'none', background: '#fff', marginBottom: 12, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setResolving(null)} style={{ fontSize: 13, color: C.sub, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 14px' }}>Cancel</button>
            <button onClick={saveResolution} style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: C.green, border: 'none', borderRadius: 7, padding: '8px 18px', cursor: 'pointer' }}>Save ranking</button>
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
