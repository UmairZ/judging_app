import { useEffect, useState } from 'react';
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

export default function Projector() {
  const enrollments = useCollection<EnrollmentDoc>('enrollments');
  const contestants = useCollection<ContestantDoc>('contestants');
  const sessions = useCollection<SessionDoc>('sessions');
  const panels = useCollection<PanelDoc>('panels');
  const assignments = useCollection<AssignmentDoc>('assignments');
  const structure = useDocData<StructureConfig>('config/structure').data ?? DEFAULT_STRUCTURE_CONFIG;
  const cfg: ScoringConfig = useDocData<ScoringConfig>('config/scoring').data ?? DEFAULT_SCORING_CONFIG;

  const slots = generateSlots(structure);
  const [slotIdx, setSlotIdx] = useState(0);

  // Slideshow controls: ← / → step between slots like PowerPoint.
  useEffect(() => {
    if (slots.length <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setSlotIdx((p) => (p + 1) % slots.length);
      else if (e.key === 'ArrowLeft') setSlotIdx((p) => (p - 1 + slots.length) % slots.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slots.length]);

  // Auto-advance 12s after the last change (manual arrow nav resets the timer).
  useEffect(() => {
    if (slots.length <= 1) return;
    const id = setTimeout(() => setSlotIdx((p) => (p + 1) % slots.length), 12_000);
    return () => clearTimeout(id);
  }, [slotIdx, slots.length]);

  const slot = slots[slotIdx] ?? slots[0];
  const nextSlotIdx = slots.length > 0 ? (slotIdx + 1) % slots.length : 0;
  const nextSlot = slots[nextSlotIdx];

  const catLabel = (id: string) => structure.categories.find((c) => c.id === id)?.label ?? id;
  const divLabel = (id: string) => structure.divisions.find((d) => d.id === id)?.label ?? id;

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

  // ── derived display values ──────────────────────────────────────────────────

  const [first, second, third, ...rest] = rows;
  const nextSlotLabel = nextSlot ? `${catLabel(nextSlot.category)} · ${divLabel(nextSlot.division)}` : '';

  // ── helpers ─────────────────────────────────────────────────────────────────

  const scoreStr = (r: Row) =>
    r.summary.score == null ? '—' : r.summary.score.toFixed(1);

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
  const TEXT_RANKED = '#6E8C84';
  const TEXT_RANKED_NAME = '#DCEAE6';
  const TEXT_RANKED_SCORE = '#C7D6D0';
  const TEXT_FOOTER = '#6E8C84';
  const LIVE_DOT = '#6FCBA0';
  const DIVIDER = '#3A6258';

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: `radial-gradient(circle at 50% 0%, ${BG_INNER}, ${BG_OUTER})`,
        display: 'flex',
        flexDirection: 'column',
        padding: '44px 56px',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* decorative motif – top-right */}
      <div
        style={{
          position: 'absolute',
          top: 28,
          right: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
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
          <img
            src="/ibn-katheer-logo.svg"
            alt=""
            style={{ width: 30, height: 30, objectFit: 'contain' }}
          />
        </div>

        {/* Title block */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              letterSpacing: '.22em',
              textTransform: 'uppercase',
              color: C.gold,
              fontWeight: 600,
              marginBottom: 2,
            }}
          >
            2026 Ibn Katheer Qur'an Competition
          </div>
          <div
            style={{
              fontFamily: serif,
              fontSize: 38,
              fontWeight: 600,
              color: '#fff',
              lineHeight: 1.1,
            }}
          >
            {slot ? `${catLabel(slot.category)} · ${divLabel(slot.division)}` : '—'}
          </div>
        </div>

        {/* Standings badge */}
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: 12,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: TEXT_MUTED,
              fontWeight: 600,
            }}
          >
            Standings
          </div>
          <div style={{ fontSize: 13, color: TEXT_DIM }}>
            {rows.length} contestant{rows.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* divider */}
      <div
        style={{
          height: 1,
          background: `linear-gradient(90deg, ${DIVIDER}, transparent)`,
          margin: '18px 0 26px',
        }}
      />

      {/* ── GOLD PODIUM – #1 ──────────────────────────────────────────────── */}
      {first && (
        <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
          <div
            key={first.contestantId}
            style={{
              flex: 1,
              background: `linear-gradient(160deg, ${C.gold}, ${C.brass})`,
              borderRadius: 14,
              padding: '22px 26px',
              display: 'flex',
              alignItems: 'center',
              gap: 20,
            }}
          >
            <span
              style={{
                fontFamily: serif,
                fontSize: 56,
                fontWeight: 700,
                color: '#06211C',
                lineHeight: 1,
              }}
            >
              1
            </span>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: serif,
                  fontSize: 26,
                  fontWeight: 600,
                  color: C.ink,
                }}
              >
                {first.name}
              </div>
              <div style={{ fontSize: 13, color: '#5A4A1C', fontWeight: 600 }}>
                {subLine(first)}
              </div>
            </div>
            <span
              style={{
                fontFamily: serif,
                fontSize: 44,
                fontWeight: 700,
                color: '#06211C',
              }}
            >
              {scoreStr(first)}
            </span>
          </div>
        </div>
      )}

      {/* ── MEDAL CARDS – #2 and #3 ───────────────────────────────────────── */}
      {(second || third) && (
        <div style={{ display: 'flex', gap: 20, marginBottom: 18 }}>
          {[second, third].map((r, idx) => {
            if (!r) return <div key={idx} style={{ flex: 1 }} />;
            const rank = idx + 2;
            return (
              <div
                key={r.contestantId}
                style={{
                  flex: 1,
                  background: BG_CARD,
                  border: `1px solid ${BORDER_CARD}`,
                  borderRadius: 12,
                  padding: '18px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                }}
              >
                <span
                  style={{
                    fontFamily: serif,
                    fontSize: 34,
                    fontWeight: 700,
                    color: TEXT_MUTED,
                  }}
                >
                  {rank}
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: serif,
                      fontSize: 22,
                      fontWeight: 600,
                      color: '#fff',
                    }}
                  >
                    {r.name}
                  </div>
                  <div style={{ fontSize: 12.5, color: TEXT_DIM }}>
                    {subLine(r)}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: serif,
                    fontSize: 30,
                    fontWeight: 700,
                    color: C.gold,
                  }}
                >
                  {scoreStr(r)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── PLAIN RANKED LIST – #4+ ───────────────────────────────────────── */}
      {rest.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rest.map((r, idx) => {
            const rank = idx + 4;
            return (
              <div
                key={r.contestantId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  padding: '12px 24px',
                  background: 'rgba(255,255,255,.03)',
                  borderRadius: 10,
                }}
              >
                <span
                  style={{
                    fontFamily: serif,
                    fontSize: 22,
                    fontWeight: 700,
                    color: TEXT_RANKED,
                    width: 30,
                  }}
                >
                  {rank}
                </span>
                <span
                  style={{
                    fontSize: 19,
                    fontWeight: 600,
                    color: TEXT_RANKED_NAME,
                    flex: 1,
                  }}
                >
                  {r.name}
                </span>
                <span
                  style={{
                    fontFamily: serif,
                    fontSize: 24,
                    fontWeight: 700,
                    color: TEXT_RANKED_SCORE,
                  }}
                >
                  {scoreStr(r)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {rows.length === 0 && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: TEXT_DIM,
            fontSize: 18,
            fontStyle: 'italic',
          }}
        >
          No contestants in this slot yet.
        </div>
      )}

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12.5,
          color: TEXT_FOOTER,
          paddingTop: 16,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: LIVE_DOT,
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        {slots.length > 1 && nextSlot && slotId(nextSlot) !== slotId(slot)
          ? `Live · ← → to change · auto-advances to ${nextSlotLabel}`
          : 'Live'}
      </div>
    </div>
  );
}
