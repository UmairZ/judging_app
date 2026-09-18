import { useEffect, useRef, useState } from 'react';
import { useDocData, writeDoc } from '../../data/db';
import { useTenant } from '../../tenant/TenantContext';
import {
  DEFAULT_SCORING_CONFIG,
  KNOWN_MODELS,
  weightsSum,
  resolveScoringConfig,
  validateScoringConfig,
  type ScoringConfig,
} from '../../scoring';
import { Badge } from '../vendor/badge';
import { Button } from '../vendor/button';
import { Divider } from '../vendor/divider';
import { Field, Fieldset, Label } from '../vendor/fieldset';
import { Heading, Subheading } from '../vendor/heading';
import { Input } from '../vendor/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../vendor/table';
import { Text } from '../vendor/text';
import { Explainer } from '../Explainer';

/**
 * Scoring page — three independent v3 systems (spec 2026-09-18) behind one
 * chooser: raw-v3 (points from one pool), weighted-v3 (component weights,
 * percent costs), escalating-v3 (weighted-v3 + repeat penalties, the comp
 * system). Only the selected system's knobs render; "rail" vocabulary never
 * appears user-facing. The scoring ENGINE (src/scoring/*) is untouched here —
 * `validateScoringConfig`/`weightsSum`/`resolveScoringConfig`/
 * `DEFAULT_SCORING_CONFIG` are reused exactly as shipped in Task 1.
 *
 * The whole form (incl. Save) is gated behind `loading` with a
 * "Loading config…" placeholder, so a Save click during the fetch window
 * can never write DEFAULT_SCORING_CONFIG over the live doc — same failure
 * class ContestantsPage.tsx guards its webhook-token generator against.
 * That gate is preserved verbatim here.
 */
function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Scoring-system chooser card. Rendered as a styled button with role=radio
 * semantics rather than vendor radio.tsx: the vendor Radio is a bare dot
 * control (no children), so whole-card selection can't compose from it —
 * the card surface itself must be the interactive radio for the click
 * target and the ring styling to be one element.
 */
function SystemCard({
  selected,
  disabled,
  title,
  badge,
  onSelect,
  children,
}: {
  selected?: boolean;
  disabled?: boolean;
  title: string;
  badge?: React.ReactNode;
  onSelect?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected ?? false}
      aria-disabled={disabled ?? false}
      disabled={disabled}
      onClick={disabled ? undefined : onSelect}
      className={
        'flex-1 rounded-xl border p-5 text-left ' +
        (selected
          ? 'border-zinc-950/25 bg-white ring-2 ring-zinc-950/10 dark:border-white/25 dark:bg-zinc-800 dark:ring-white/10'
          : 'border-zinc-950/10 bg-white dark:border-white/10 dark:bg-zinc-800') +
        (disabled ? ' cursor-not-allowed opacity-60' : ' cursor-pointer')
      }
    >
      <span className="flex items-center gap-3">
        <span
          className={
            'flex size-4.5 flex-none items-center justify-center rounded-full border ' +
            (selected
              ? 'border-zinc-900 bg-zinc-900 dark:border-white dark:bg-white'
              : 'border-zinc-950/20 bg-white dark:border-white/20 dark:bg-zinc-800')
          }
        >
          {selected && <span className="size-1.5 rounded-full bg-white dark:bg-zinc-900" />}
        </span>
        <span className="text-sm/6 font-semibold text-zinc-950 dark:text-white">{title}</span>
        {badge}
      </span>
      <Text className="mt-2 text-sm">{children}</Text>
    </button>
  );
}

/**
 * Rows mirror the judge's mistake buttons, in the order the judge sees them.
 * Names match the judge screen exactly (src/judge/labels.tsx) — "Hesitation",
 * not the old "Self-corrected" — so an organizer recognizes the same word in
 * both places.
 */
const MISTAKE_MEANINGS = {
  hesitation: { label: 'Hesitation', meaning: 'corrected without prompting' },
  prompted: { label: 'Prompted', meaning: 'needed a hint' },
  unable: { label: 'Unable to continue', meaning: 'hint given, still stuck' },
  tajweed_major: { label: 'Tajweed major', meaning: 'a clear recitation error' },
  tajweed_minor: { label: 'Tajweed minor', meaning: 'a small slip in recitation' },
} as const;

export function ScoringPage() {
  const { tp } = useTenant();
  const { data, loading } = useDocData<ScoringConfig>(tp('config/scoring'));
  const [edited, setEdited] = useState<ScoringConfig>(DEFAULT_SCORING_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Seed local state ONCE — re-seeding on every live snapshot would wipe edits.
  // resolveScoringConfig closes the legacy/unknown-model gap: a hand-edited or
  // pre-v3 doc seeds the full DEFAULT_SCORING_CONFIG shape instead of crashing
  // weightsSum on a missing percent sub-object.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !data) return;
    setEdited(resolveScoringConfig(data));
    seeded.current = true;
  }, [data]);

  // Live validation covers the user's edits. When the loaded doc itself carries
  // an unknown/legacy model id, surface that flag too (it describes the SAVED
  // doc, which the seeded `edited` no longer does after resolveScoringConfig) —
  // deduped against the live errors so it never doubles up.
  const editedErrors = validateScoringConfig(edited);
  const docUnknownModel =
    data && !(KNOWN_MODELS as readonly string[]).includes(data.model)
      ? validateScoringConfig(data).find((e) => e.startsWith('unknown scoring system'))
      : undefined;
  const errors =
    docUnknownModel && !editedErrors.includes(docUnknownModel) ? [docUnknownModel, ...editedErrors] : editedErrors;
  const sum = weightsSum(edited);
  const valid = editedErrors.length === 0;

  function patchRaw(patch: Partial<ScoringConfig['raw']>) {
    setEdited((prev) => ({ ...prev, raw: { ...prev.raw, ...patch } }));
    setSaved(false);
  }

  function patchPercent(patch: Partial<ScoringConfig['percent']>) {
    setEdited((prev) => ({ ...prev, percent: { ...prev.percent, ...patch } }));
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

  function num(v: string, fallback: number) {
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }

  return (
    <>
      <Heading>Scoring</Heading>

      {loading && <Text className="mt-8">Loading config…</Text>}

      {!loading && (
        <>
          <div className="mt-8">
            <Explainer title="How scoring works">
              <Text className="text-sm">
                Judges tap a button for each mistake they hear. Every contestant starts at 100; each mistake takes
                points off, weighted by how much each component counts.
              </Text>
              <Text className="text-sm">The scoring system below controls exactly how much each mistake costs.</Text>
            </Explainer>
          </div>

          <Divider className="my-8" />

          <div>
            <Subheading>Scoring system</Subheading>
            <div role="radiogroup" aria-label="Scoring system" className="mt-4 flex flex-col gap-4 sm:flex-row">
              <SystemCard
                selected={edited.model === 'raw-v3'}
                title="Raw deductions"
                onSelect={() => setField('model', 'raw-v3')}
              >
                Every question is worth 100 points. Each mistake takes a set number of points off; the judge&apos;s
                voice rating fills its own slice.
              </SystemCard>
              <SystemCard
                selected={edited.model === 'weighted-v3'}
                title="Percentage weights"
                onSelect={() => setField('model', 'weighted-v3')}
              >
                Each part of the recitation is worth a share of the score. Mistakes cost a percentage of their
                question&apos;s part.
              </SystemCard>
              <SystemCard
                selected={edited.model === 'escalating-v3'}
                title="Percentage weights + escalating penalties"
                onSelect={() => setField('model', 'escalating-v3')}
              >
                Like Percentage weights — and each repeated memorization mistake in the same question costs more
                than the last.
              </SystemCard>
            </div>
          </div>

          <Divider className="my-8" />

          {edited.model === 'raw-v3' ? (
            <div>
              <Subheading>What each mistake costs</Subheading>
              <Text className="mt-1">The same buttons the judge sees, and what each one takes off.</Text>
              <Table className="mt-4 [--gutter:--spacing(6)]">
                <TableHead>
                  <TableRow>
                    <TableHeader>Judge&apos;s button</TableHeader>
                    <TableHeader>Meaning</TableHeader>
                    <TableHeader className="text-right">Points off</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(['hesitation', 'prompted', 'unable', 'tajweed_major', 'tajweed_minor'] as const).map((key) => (
                    <TableRow key={key}>
                      <TableCell className="font-medium">{MISTAKE_MEANINGS[key].label}</TableCell>
                      <TableCell className="text-zinc-500">{MISTAKE_MEANINGS[key].meaning}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          aria-label={`${MISTAKE_MEANINGS[key].label} cost`}
                          className="ml-auto max-w-24"
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={edited.raw.costs[key]}
                          onChange={(e) =>
                            patchRaw({
                              costs: { ...edited.raw.costs, [key]: clamp(num(e.target.value, edited.raw.costs[key]), 0, 100) },
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Fieldset className="mt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <Label>Voice is worth this many of each question&apos;s 100 points</Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={edited.raw.voice_worth}
                      onChange={(e) => patchRaw({ voice_worth: clamp(num(e.target.value, edited.raw.voice_worth), 1, 30) })}
                    />
                  </Field>
                  <Field>
                    <Label>Judges rate voice 0–{edited.voice_max}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={edited.voice_max}
                      onChange={(e) => setField('voice_max', clamp(num(e.target.value, edited.voice_max), 1, 20))}
                    />
                  </Field>
                </div>
              </Fieldset>
              <Text className="mt-3 text-sm text-zinc-500">
                A Prompted mistake costs {edited.raw.costs.prompted} of the question&apos;s 100 points.
              </Text>
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-baseline gap-3">
                  <Subheading>What each part is worth</Subheading>
                  <Badge color={valid && sum === 100 ? 'green' : 'red'}>{`= ${sum}${sum === 100 ? ' ✓' : ` — ${sum < 100 ? 'under' : 'over'}`}`}</Badge>
                </div>
                <Text className="mt-1">Out of the 100 points a contestant starts with.</Text>
                <Fieldset className="mt-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field>
                      <Label>Hifz — memorization</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={edited.percent.weights.hifz}
                        onChange={(e) =>
                          patchPercent({
                            weights: { ...edited.percent.weights, hifz: clamp(num(e.target.value, edited.percent.weights.hifz), 0, 100) },
                          })
                        }
                      />
                    </Field>
                    <Field>
                      <Label>Tajweed — recitation</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={edited.percent.weights.tajweed}
                        onChange={(e) =>
                          patchPercent({
                            weights: {
                              ...edited.percent.weights,
                              tajweed: clamp(num(e.target.value, edited.percent.weights.tajweed), 0, 100),
                            },
                          })
                        }
                      />
                    </Field>
                    <Field>
                      <Label>Voice &amp; delivery</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={edited.percent.weights.voice}
                        onChange={(e) =>
                          patchPercent({
                            weights: { ...edited.percent.weights, voice: clamp(num(e.target.value, edited.percent.weights.voice), 0, 100) },
                          })
                        }
                      />
                    </Field>
                  </div>
                </Fieldset>
              </div>

              <Divider className="my-8" />

              <div>
                <Subheading>What each mistake costs</Subheading>
                <Text className="mt-1">The same buttons the judge sees, and what each one takes off.</Text>
                <Table className="mt-4 [--gutter:--spacing(6)]">
                  <TableHead>
                    <TableRow>
                      <TableHeader>Judge&apos;s button</TableHeader>
                      <TableHeader>Meaning</TableHeader>
                      <TableHeader className="text-right">% of the question&apos;s part</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(['prompted', 'unable', 'tajweed_major', 'tajweed_minor'] as const).map((key) => (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{MISTAKE_MEANINGS[key].label}</TableCell>
                        <TableCell className="text-zinc-500">{MISTAKE_MEANINGS[key].meaning}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            aria-label={`${MISTAKE_MEANINGS[key].label} cost`}
                            className="ml-auto max-w-24"
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={edited.percent.costs[key]}
                            onChange={(e) =>
                              patchPercent({
                                costs: {
                                  ...edited.percent.costs,
                                  [key]: clamp(num(e.target.value, edited.percent.costs[key]), 0, 100),
                                },
                              })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Fieldset className="mt-4">
                  <Field className="max-w-40">
                    <Label>Judges rate voice 0–{edited.voice_max}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={edited.voice_max}
                      onChange={(e) => setField('voice_max', clamp(num(e.target.value, edited.voice_max), 1, 20))}
                    />
                  </Field>
                </Fieldset>
                {edited.model === 'escalating-v3' && (
                  <Fieldset className="mt-4">
                    <Field className="max-w-64">
                      <Label>Each repeat costs this many more percentage points</Label>
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        value={edited.percent.escalation_step}
                        onChange={(e) =>
                          patchPercent({ escalation_step: clamp(num(e.target.value, edited.percent.escalation_step), 0, 50) })
                        }
                      />
                    </Field>
                  </Fieldset>
                )}
                <Text className="mt-3 text-sm text-zinc-500">
                  {edited.model === 'escalating-v3'
                    ? `Two Prompted mistakes in one question cost ${edited.percent.costs.prompted}% + ${
                        edited.percent.costs.prompted + edited.percent.escalation_step
                      }% = ${edited.percent.costs.prompted * 2 + edited.percent.escalation_step}% of that question's memorization.`
                    : `One Prompted mistake costs ${edited.percent.costs.prompted}% of that question's memorization.`}
                </Text>
              </div>
            </>
          )}

          <Divider className="my-8" />

          <div>
            <Subheading>Disqualification trigger</Subheading>
            <Text className="mt-1">
              When a contestant hits a category&apos;s mistake limit — that many hifz mistakes on a single
              question — the judge is asked whether to write off the whole question. Each category sets
              its own limit on the Categories &amp; Divisions page.
            </Text>
          </div>

          {errors.length > 0 && (
            <div className="mt-6 flex flex-col gap-1">
              {errors.map((e) => (
                <Text key={e} className="text-red-600 dark:text-red-500">
                  {e}
                </Text>
              ))}
            </div>
          )}

          <Divider className="my-8" />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <Text>Scores recompute everywhere automatically — settings are read live by all views.</Text>
            <Button onClick={() => void handleSave()} disabled={!valid || saving}>
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
