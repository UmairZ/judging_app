import { useEffect, useState, useRef } from 'react';
import { useDocData, writeDoc } from '../data/db';
import { useTenant } from '../tenant/TenantContext';
import {
  DEFAULT_SCORING_CONFIG,
  weightsSum,
  validateScoringConfig,
  type ScoringConfig,
} from '../scoring';
import { C, serif } from '../ui/theme';

// ─── helpers ────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function NumStepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 13, color: C.sub, minWidth: 110 }}>{label}</span>
      <button
        onClick={() => onChange(clamp(value - step, min, max))}
        style={{
          width: 30, height: 30, borderRadius: 6, border: `1px solid ${C.cardLine}`,
          background: '#fff', cursor: 'pointer', fontSize: 16, color: C.sub,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >−</button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(clamp(v, min, max));
        }}
        style={{
          width: 60, textAlign: 'center', fontFamily: serif, fontSize: 18, fontWeight: 700,
          color: C.ink, border: `1px solid ${C.cardLine}`, borderRadius: 6,
          padding: '4px 6px', background: C.parchment, outline: 'none',
        }}
      />
      <button
        onClick={() => onChange(clamp(value + step, min, max))}
        style={{
          width: 30, height: 30, borderRadius: 6, border: `1px solid ${C.cardLine}`,
          background: '#fff', cursor: 'pointer', fontSize: 16, color: C.sub,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >+</button>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function ScoringConfig() {
  const { tp } = useTenant();
  const { data, loading } = useDocData<ScoringConfig>(tp('config/scoring'));
  const [edited, setEdited] = useState<ScoringConfig>(DEFAULT_SCORING_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Seed local state ONCE — re-seeding on every live snapshot would wipe slider edits.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !data) return;
    setEdited(data);
    seeded.current = true;
  }, [data]);

  const errors = validateScoringConfig(edited);
  const sum = weightsSum(edited);
  const valid = errors.length === 0;

  // Derived bar widths (sum may not be 100 while editing)
  const total = sum > 0 ? sum : 1;
  const hPct = (edited.weights.hifz / total) * 100;
  const tPct = (edited.weights.tajweed / total) * 100;
  const vPct = (edited.weights.voice / total) * 100;

  function setWeight(key: 'hifz' | 'tajweed' | 'voice', v: number) {
    setEdited((prev) => ({ ...prev, weights: { ...prev.weights, [key]: clamp(v, 0, 100) } }));
    setSaved(false);
  }

  function setField<K extends keyof ScoringConfig>(key: K, v: ScoringConfig[K]) {
    setEdited((prev) => ({ ...prev, [key]: v }));
    setSaved(false);
  }

  async function handleSave() {
    if (!valid || saving) return;
    setSaving(true);
    await writeDoc(tp('config/scoring'), edited, false);
    setSaving(false);
    setSaved(true);
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: C.cream, borderRadius: 8,
      boxShadow: '0 6px 22px rgba(20,40,36,.14)', overflow: 'hidden',
    }}>
      {/* top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '18px 26px',
        borderBottom: `1px solid ${C.line}`, background: C.greenDeep,
      }}>
        <img src="/ibn-katheer-logo.svg" alt="" style={{
          height: 32, width: 'auto', marginRight: 14,
          filter: 'brightness(0) invert(1)', opacity: 0.92,
        }} />
        <div>
          <div style={{ fontFamily: serif, fontSize: 19, fontWeight: 600, color: '#fff' }}>
            Scoring config · live
          </div>
          <div style={{ fontSize: 12, color: '#9DBDB4' }}>
            Changes take effect immediately across all open views
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ padding: '32px 26px', textAlign: 'center', color: C.muted, fontSize: 14 }}>
          Loading config…
        </div>
      )}

      {!loading && (
        <div style={{ padding: '28px 26px', display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* ── Component weights ───────────────────────────────────────────── */}
          <section>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
              <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 600, color: C.ink }}>
                Component weights
              </div>
              {/* sum badge */}
              <span style={{
                fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                background: valid ? C.pillGreen : C.failBg,
                color: valid ? C.green : C.fail,
                border: `1px solid ${valid ? '#B5D6CE' : '#E6CCC2'}`,
              }}>
                = {sum}{valid ? ' ✓' : ` — ${sum < 100 ? 'under' : 'over'}`}
              </span>
            </div>

            {/* stacked bar */}
            <div style={{
              display: 'flex', height: 14, borderRadius: 7,
              overflow: 'hidden', marginBottom: 20, background: C.line,
            }}>
              <div style={{ width: `${hPct}%`, background: C.hifzBar, transition: 'width .2s' }} />
              <div style={{ width: `${tPct}%`, background: C.tajBar, transition: 'width .2s' }} />
              <div style={{ width: `${vPct}%`, background: C.voiceBar, transition: 'width .2s' }} />
            </div>

            {/* legend */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
              {([
                ['Hifz', C.hifzBar],
                ['Tajweed', C.tajBar],
                ['Voice', C.voiceBar],
              ] as const).map(([label, color]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: color, display: 'inline-block' }} />
                  <span style={{ fontSize: 12, color: C.sub }}>{label}</span>
                </div>
              ))}
            </div>

            {/* sliders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {(
                [
                  ['Hifz', 'hifz', C.hifzBar],
                  ['Tajweed', 'tajweed', C.tajBar],
                  ['Voice', 'voice', C.voiceBar],
                ] as const
              ).map(([label, key, color]) => (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: C.sub, fontWeight: 600 }}>{label}</span>
                    <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 700, color: C.ink }}>
                      {edited.weights[key]}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={edited.weights[key]}
                    onChange={(e) => setWeight(key, parseInt(e.target.value, 10))}
                    style={{
                      width: '100%', accentColor: color, cursor: 'pointer', height: 6,
                    }}
                  />
                </div>
              ))}
            </div>

            {/* validation errors */}
            {errors.length > 0 && (
              <div style={{
                marginTop: 14, padding: '10px 14px', borderRadius: 6,
                background: C.failBg, border: `1px solid ${C.failLine}`,
              }}>
                {errors.map((e) => (
                  <div key={e} style={{ fontSize: 13, color: C.fail }}>{e}</div>
                ))}
              </div>
            )}
          </section>

          {/* ── Hifz base ────────────────────────────────────────────────────── */}
          <section style={{
            padding: '18px 20px', borderRadius: 8,
            border: `1px solid ${C.cardLine}`, background: C.parchment,
          }}>
            <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 4 }}>
              Hifz base (spread + DQ trigger)
            </div>
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
              One knob, two jobs: lower hifz base spreads scores AND moves the auto-flag DQ trigger.
            </div>
            <NumStepper
              label="hifz_base"
              value={edited.hifz_base}
              min={1}
              max={20}
              onChange={(v) => setField('hifz_base', v)}
            />
          </section>

          {/* ── Other bases ──────────────────────────────────────────────────── */}
          <section>
            <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 16 }}>
              Component bases
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <NumStepper
                label="tajweed_base"
                value={edited.tajweed_base}
                min={1}
                max={20}
                onChange={(v) => setField('tajweed_base', v)}
              />
              <NumStepper
                label="voice_max"
                value={edited.voice_max}
                min={1}
                max={20}
                onChange={(v) => setField('voice_max', v)}
              />
            </div>
          </section>

          {/* ── Deductions ───────────────────────────────────────────────────── */}
          <section>
            <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 16 }}>
              Deductions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <NumStepper
                label="Hifz: prompted fixed"
                value={edited.hifz_deductions.prompted_fixed}
                min={0}
                max={10}
                step={0.5}
                onChange={(v) =>
                  setField('hifz_deductions', { ...edited.hifz_deductions, prompted_fixed: v })
                }
              />
              <NumStepper
                label="Hifz: prompted failed"
                value={edited.hifz_deductions.prompted_failed}
                min={0}
                max={10}
                step={0.5}
                onChange={(v) =>
                  setField('hifz_deductions', { ...edited.hifz_deductions, prompted_failed: v })
                }
              />
              <NumStepper
                label="Tajweed: major"
                value={edited.tajweed_deductions.major}
                min={0}
                max={10}
                step={0.5}
                onChange={(v) =>
                  setField('tajweed_deductions', { ...edited.tajweed_deductions, major: v })
                }
              />
              <NumStepper
                label="Tajweed: minor"
                value={edited.tajweed_deductions.minor}
                min={0}
                max={10}
                step={0.5}
                onChange={(v) =>
                  setField('tajweed_deductions', { ...edited.tajweed_deductions, minor: v })
                }
              />
            </div>
          </section>

          {/* ── Save ─────────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={handleSave}
              disabled={!valid || saving}
              style={{
                padding: '11px 28px', borderRadius: 7, border: 'none', cursor: valid && !saving ? 'pointer' : 'not-allowed',
                background: valid ? C.green : C.muted, color: '#fff',
                fontFamily: serif, fontSize: 15, fontWeight: 700,
                opacity: valid && !saving ? 1 : 0.55,
                transition: 'background .15s, opacity .15s',
              }}
            >
              {saving ? 'Saving…' : 'Save config'}
            </button>
            {saved && !saving && (
              <span style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>Saved ✓</span>
            )}
            <span style={{ fontSize: 12, color: C.muted, marginLeft: 'auto' }}>
              Scores recompute everywhere automatically — config is read live by all views.
            </span>
          </div>

        </div>
      )}
    </div>
  );
}
