import { useEffect, useState } from 'react';
import { useCollection, useDocData } from '../data/db';
import { useTenant } from '../tenant/TenantContext';
import type { EnrollmentDoc, ContestantDoc, SessionDoc, PanelDoc, AssignmentDoc, TiebreakDoc } from '../data/types';
import {
  resolveScoringConfig,
  enrollmentSummary,
  compareForLeaderboard,
  tieBreakMean,
  type ScoringConfig,
  type EnrollmentSummary,
} from '../scoring';
import { DEFAULT_STRUCTURE_CONFIG, generateSlots, type StructureConfig } from '../domain/structure';
import { enrollmentId } from '../domain/ids';
import { C, serif, pct } from '../ui/theme';

interface Row {
  contestantId: string;
  name: string;
  summary: EnrollmentSummary;
  panelSize: number;
}

/** Reveal stages per slot: 0 = all hidden, 1 = 3rd shown, 2 = +2nd, 3 = +1st. */
const STEPS_PER_SLOT = 4;

export default function Projector() {
  const { tp } = useTenant();
  const enrollments = useCollection<EnrollmentDoc>(tp('enrollments'));
  const contestants = useCollection<ContestantDoc>(tp('contestants'));
  const sessions = useCollection<SessionDoc>(tp('sessions'));
  const panels = useCollection<PanelDoc>(tp('panels'));
  const assignments = useCollection<AssignmentDoc>(tp('assignments'));
  // Admin placement overrides + sudden-death results. The board MUST honour these:
  // the leaderboard does, and the two must never disagree in front of an audience.
  const tiebreaks = useCollection<TiebreakDoc>(tp('tiebreaks'));
  const structure = useDocData<StructureConfig>(tp('config/structure')).data ?? DEFAULT_STRUCTURE_CONFIG;
  const cfg: ScoringConfig = resolveScoringConfig(useDocData<ScoringConfig>(tp('config/scoring')).data);

  const slots = generateSlots(structure);

  // Award-ceremony walk: one global step counter, arrows only (no auto-advance,
  // no wrap — an accidental key at the end must not jump back to the start).
  // Each slot spends STEPS_PER_SLOT steps: enter hidden, then 3rd → 2nd → 1st.
  const [step, setStep] = useState(0);
  const lastStep = Math.max(0, slots.length * STEPS_PER_SLOT - 1);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setStep((p) => Math.min(p + 1, lastStep));
      else if (e.key === 'ArrowLeft') setStep((p) => Math.max(p - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lastStep]);

  const slotIdx = Math.min(Math.floor(step / STEPS_PER_SLOT), Math.max(0, slots.length - 1));
  const stage = step - slotIdx * STEPS_PER_SLOT; // 0..3 within the slot
  const slot = slots[slotIdx] ?? slots[0];

  const catLabel = (id: string) => structure.categories.find((c) => c.id === id)?.label ?? id;
  const divLabel = (id: string) => structure.divisions.find((d) => d.id === id)?.label ?? id;

  const assignment = assignments.find((a) => a.category === slot?.category && a.division === slot?.division);
  const panel = panels.find((p) => p.id === assignment?.panelId);
  const panelSize = panel?.judgeIds.length ?? 3;

  // Ranking mirrors LeaderboardPage.rankRowsForSlot exactly — an admin override sets
  // the order outright; a completed sudden-death orders the tied contestants; other-
  // wise score decides and the tie-break order only separates genuine ties.
  const tb = tiebreaks.find((t) => t.category === slot?.category && t.division === slot?.division);
  const tbOrder: string[] = (() => {
    const raw = ((tb?.resolution as { order?: string[] } | undefined)?.order) ?? [];
    if (tb?.method !== 'question') return raw;
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
        .map((e) => {
          const sFor = sessions.filter((s) => s.enrollmentId === e.id);
          return {
            contestantId: e.contestantId,
            name: contestants.find((c) => c.id === e.contestantId)?.fullName ?? '—',
            summary: enrollmentSummary(sFor, cfg),
            panelSize,
          };
        })
        .sort((a, b) => {
          if (tb?.method === 'override' && tbOrder.length) return tbIdx(a.contestantId) - tbIdx(b.contestantId);
          const c = compareForLeaderboard(a.summary, b.summary);
          if (c !== 0) return c;
          return tbIdx(a.contestantId) - tbIdx(b.contestantId);
        });

  // ── derived display values ──────────────────────────────────────────────────

  // Ceremony board: top 3 only, revealed 3rd → 2nd → 1st by the arrow walk.
  const [first, second, third] = rows;
  const showThird = stage >= 1;
  const showSecond = stage >= 2;
  const showFirst = stage >= 3;

  // ── helpers ─────────────────────────────────────────────────────────────────

  const scoreStr = (r: Row) =>
    r.summary.score == null ? '—' : r.summary.score.toFixed(1);

  // Component means are only meaningful for the percent-family systems (weighted-v3,
  // escalating-v3); raw-v3 leaves H/T at 0 by design (session.ts), so captioning them
  // here would misleadingly project "Hifz 0% · Tajweed 0%" for every contestant.
  const percentFamily = cfg.model !== 'raw-v3';

  const subLine = (r: Row) =>
    `Hifz ${pct(r.summary.hBar)} · Tajweed ${pct(r.summary.tBar)}`;

  // ── layout tokens ───────────────────────────────────────────────────────────

  // Dark teal palette for the projector board (not in theme.ts — projector only)
  const BG_OUTER = '#0E2E2A';
  const BG_INNER = '#1B514A';
  const BG_CARD = '#143A33';
  const BORDER_CARD = '#2A5249';
  const TEXT_MUTED = '#9DBDB4';
  const TEXT_DIM = '#7FA59C';
  const DIVIDER = '#3A6258';

  /** Silver/bronze card, or its silhouette while unrevealed (rank stays visible). */
  const medalCard = (r: Row | undefined, rank: number, revealed: boolean) => {
    if (!r) return <div key={rank} style={{ flex: 1 }} />;
    return (
      <div
        key={rank}
        style={{
          flex: 1,
          background: BG_CARD,
          border: `1px solid ${BORDER_CARD}`,
          borderRadius: 14,
          padding: '28px 34px',
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          opacity: revealed ? 1 : 0.55,
          transition: 'opacity .5s ease',
        }}
      >
        <span style={{ fontFamily: serif, fontSize: 46, fontWeight: 700, color: TEXT_MUTED, lineHeight: 1 }}>{rank}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: serif, fontSize: 30, fontWeight: 600, color: revealed ? '#fff' : TEXT_DIM }}>
            {revealed ? r.name : '· · ·'}
          </div>
          {revealed && percentFamily && (
            <div style={{ fontSize: 14, color: TEXT_DIM }}>{subLine(r)}</div>
          )}
        </div>
        <span style={{ fontFamily: serif, fontSize: 40, fontWeight: 700, color: revealed ? C.gold : TEXT_DIM }}>
          {revealed ? scoreStr(r) : '—'}
        </span>
      </div>
    );
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: `radial-gradient(circle at 50% 0%, ${BG_INNER}, ${BG_OUTER})`,
        display: 'flex',
        flexDirection: 'column',
        padding: '44px 64px',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* decorative motif – top-right */}
      <div style={{ position: 'absolute', top: 28, right: 40, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 8, height: 8, background: C.brass, transform: 'rotate(45deg)', display: 'inline-block' }} />
        <span style={{ width: 60, height: 1, background: DIVIDER, display: 'inline-block' }} />
      </div>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 6 }}>
        {/* Logo circle */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: C.cream,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <img src="/ibn-katheer-logo.svg" alt="" style={{ width: 30, height: 30, objectFit: 'contain' }} />
        </div>

        {/* Title block */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, letterSpacing: '.22em', textTransform: 'uppercase', color: C.gold, fontWeight: 600, marginBottom: 2 }}>
            2026 Ibn Katheer Qur'an Competition
          </div>
          <div style={{ fontFamily: serif, fontSize: 42, fontWeight: 600, color: '#fff', lineHeight: 1.1 }}>
            {slot ? `${catLabel(slot.category)} · ${divLabel(slot.division)}` : '—'}
          </div>
        </div>

        {/* Standings badge */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: TEXT_MUTED, fontWeight: 600 }}>
            Final standings
          </div>
          <div style={{ fontSize: 13, color: TEXT_DIM }}>
            {rows.length === 0 ? 'No contestants' : 'Top 3'}
          </div>
        </div>
      </div>

      {/* divider */}
      <div style={{ height: 1, background: `linear-gradient(90deg, ${DIVIDER}, transparent)`, margin: '18px 0 0' }} />

      {/* ── CEREMONY BOARD — fills the rest of the screen ─────────────────── */}
      {rows.length > 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 26 }}>
          {/* #1 — gold podium */}
          {first && (
            <div
              style={{
                background: showFirst ? `linear-gradient(160deg, ${C.gold}, ${C.brass})` : BG_CARD,
                border: showFirst ? 'none' : `1px solid ${BORDER_CARD}`,
                borderRadius: 16,
                padding: '34px 40px',
                display: 'flex',
                alignItems: 'center',
                gap: 26,
                opacity: showFirst ? 1 : 0.55,
                transition: 'opacity .5s ease',
              }}
            >
              <span style={{ fontFamily: serif, fontSize: 76, fontWeight: 700, color: showFirst ? '#06211C' : TEXT_MUTED, lineHeight: 1 }}>1</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: serif, fontSize: 40, fontWeight: 600, color: showFirst ? C.ink : TEXT_DIM }}>
                  {showFirst ? first.name : '· · ·'}
                </div>
                {showFirst && percentFamily && (
                  <div style={{ fontSize: 15, color: '#5A4A1C', fontWeight: 600 }}>{subLine(first)}</div>
                )}
              </div>
              <span style={{ fontFamily: serif, fontSize: 60, fontWeight: 700, color: showFirst ? '#06211C' : TEXT_DIM }}>
                {showFirst ? scoreStr(first) : '—'}
              </span>
            </div>
          )}

          {/* #2 and #3 */}
          <div style={{ display: 'flex', gap: 26 }}>
            {medalCard(second, 2, showSecond)}
            {medalCard(third, 3, showThird)}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_DIM, fontSize: 18, fontStyle: 'italic' }}>
          No contestants in this slot yet.
        </div>
      )}

      {/* control hint — subtle, bottom-right */}
      <div style={{ position: 'absolute', bottom: 20, right: 40, fontSize: 12.5, color: TEXT_DIM, opacity: 0.7 }}>
        → reveal · ← back
      </div>
    </div>
  );
}
