import { useState } from 'react';
import { useCollection, useDocData } from '../data/db';
import type { EnrollmentDoc, ContestantDoc, SessionDoc, PanelDoc, AssignmentDoc } from '../data/types';
import {
  DEFAULT_SCORING_CONFIG,
  enrollmentSummary,
  compareForLeaderboard,
  type ScoringConfig,
  type EnrollmentSummary,
} from '../scoring';
import { DEFAULT_STRUCTURE_CONFIG, generateSlots, slotId, type StructureConfig } from '../domain/structure';
import { C, serif, pct } from '../ui/theme';

interface Row {
  contestantId: string;
  name: string;
  summary: EnrollmentSummary;
  panelSize: number;
}

export default function Leaderboard() {
  const enrollments = useCollection<EnrollmentDoc>('enrollments');
  const contestants = useCollection<ContestantDoc>('contestants');
  const sessions = useCollection<SessionDoc>('sessions');
  const panels = useCollection<PanelDoc>('panels');
  const assignments = useCollection<AssignmentDoc>('assignments');
  const structure = useDocData<StructureConfig>('config/structure').data ?? DEFAULT_STRUCTURE_CONFIG;
  const cfg: ScoringConfig = useDocData<ScoringConfig>('config/scoring').data ?? DEFAULT_SCORING_CONFIG;

  const slots = generateSlots(structure);
  const [sel, setSel] = useState(0);
  const slot = slots[sel] ?? slots[0];

  const catLabel = (id: string) => structure.categories.find((c) => c.id === id)?.label ?? id;
  const divLabel = (id: string) => structure.divisions.find((d) => d.id === id)?.label ?? id;

  // panel size for this slot (expected session count) → completeness
  const assignment = assignments.find((a) => a.category === slot?.category && a.division === slot?.division);
  const panel = panels.find((p) => p.id === assignment?.panelId);
  const panelSize = panel?.judgeIds.length ?? 3;

  const rows: Row[] = !slot
    ? []
    : enrollments
        .filter((e) => e.category === slot.category && e.division === slot.division)
        .map((e) => {
          const sFor = sessions.filter((s) => s.enrollmentId === e.id);
          return {
            contestantId: e.contestantId,
            name: contestants.find((c) => c.id === e.contestantId)?.fullName ?? '—',
            summary: enrollmentSummary(sFor, cfg),
            panelSize,
          };
        })
        .sort((a, b) => compareForLeaderboard(a.summary, b.summary));

  return (
    <div style={{ background: C.cream, borderRadius: 8, boxShadow: '0 6px 22px rgba(20,40,36,.14)', overflow: 'hidden' }}>
      {/* topbar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '18px 26px', borderBottom: `1px solid ${C.line}`, background: C.greenDeep }}>
        <img src="/ibn-katheer-logo.svg" alt="" style={{ height: 32, width: 'auto', marginRight: 14, filter: 'brightness(0) invert(1)', opacity: 0.92 }} />
        <div>
          <div style={{ fontFamily: serif, fontSize: 19, fontWeight: 600, color: '#fff' }}>Live Leaderboard</div>
          <div style={{ fontSize: 12, color: '#9DBDB4' }}>Recomputed from synced sessions</div>
        </div>
      </div>

      {/* slot tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '14px 26px', borderBottom: `1px solid ${C.line}` }}>
        {slots.map((s, i) => {
          const on = i === sel;
          return (
            <button
              key={slotId(s)}
              onClick={() => setSel(i)}
              style={{ fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 6, cursor: 'pointer', border: on ? 'none' : `1px solid ${C.cardLine}`, background: on ? C.gold : '#fff', color: on ? '#06211C' : C.sub }}
            >
              {catLabel(s.category)} · {divLabel(s.division)}
            </button>
          );
        })}
      </div>

      {/* table header */}
      <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 120px 110px 110px 150px', alignItems: 'center', padding: '12px 26px', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A938A', fontWeight: 600, borderBottom: `1px solid ${C.line}` }}>
        <span>Rank</span><span>Contestant</span><span style={{ textAlign: 'center' }}>Score</span><span style={{ textAlign: 'center' }}>Hifz</span><span style={{ textAlign: 'center' }}>Tajweed</span><span style={{ textAlign: 'center' }}>Panel</span>
      </div>

      {rows.length === 0 && (
        <div style={{ padding: '36px 26px', textAlign: 'center', color: C.muted, fontSize: 14 }}>No contestants in this slot yet.</div>
      )}

      {rows.map((r, i) => {
        const prev = rows[i - 1];
        const tie = prev && compareForLeaderboard(prev.summary, r.summary) === 0;
        const rank = tie ? '—' : i + 1;
        const partial = r.summary.startedCount < r.panelSize;
        return (
          <div key={r.contestantId} style={{ display: 'grid', gridTemplateColumns: '56px 1fr 120px 110px 110px 150px', alignItems: 'center', padding: '15px 26px', borderBottom: `1px solid #F0EBDD`, background: i === 0 ? '#FCF7E9' : 'transparent' }}>
            <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 700, color: i === 0 ? C.brass : C.sub }}>{rank}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 15.5, fontWeight: 600, color: C.ink }}>{r.name}</span>
              {tie && <span style={{ fontSize: 11, fontWeight: 700, color: C.brassDark, background: C.pill, padding: '3px 8px', borderRadius: 999 }}>TIE</span>}
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
