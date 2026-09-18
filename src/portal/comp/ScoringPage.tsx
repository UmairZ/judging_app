import { useEffect, useRef, useState } from 'react';
import { useDocData, writeDoc } from '../../data/db';
import { useTenant } from '../../tenant/TenantContext';
import { DEFAULT_SCORING_CONFIG, weightsSum, validateScoringConfig, type ScoringConfig } from '../../scoring';
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
 * Scoring page — plain-language rewrite of the config form (approved steering
 * mock, 2026-09-06). All data logic is unchanged from the chrome-only port of
 * src/admin/ScoringConfig.tsx: same hooks, same handler names, same tp()
 * paths, same clamp semantics, same write shape. The scoring ENGINE
 * (src/scoring/*) is untouched — `validateScoringConfig`/`weightsSum`/
 * `DEFAULT_SCORING_CONFIG` are reused exactly as before. Only the framing
 * changed: judge-mirroring language, no engine jargon (design principle 13).
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

/** Rows mirror the judge's mistake buttons, in the order the judge sees them. */
const MISTAKE_MEANINGS = {
  self_corrected: 'caught and fixed it themselves',
  prompted_fixed: 'needed a hint',
  prompted_failed: 'hint given, still stuck',
  tajweed_major: 'a clear recitation error',
  tajweed_minor: 'a small slip in recitation',
} as const;

export function ScoringPage() {
  const { tp } = useTenant();
  const { data, loading } = useDocData<ScoringConfig>(tp('config/scoring'));
  const [edited, setEdited] = useState<ScoringConfig>(DEFAULT_SCORING_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Seed local state ONCE — re-seeding on every live snapshot would wipe edits.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !data) return;
    setEdited(data);
    seeded.current = true;
  }, [data]);

  const errors = validateScoringConfig(edited);
  const sum = weightsSum(edited);
  const valid = errors.length === 0;

  function setWeight(key: 'hifz' | 'tajweed' | 'voice', v: number) {
    setEdited((prev) => ({
      ...prev,
      percent: { ...prev.percent, weights: { ...prev.percent.weights, [key]: clamp(v, 0, 100) } },
    }));
    setSaved(false);
  }

  // TEMPORARY (Task 2 rebuilds this page): percent-cost writer for the v3 shape.
  function setPercentCost(key: 'prompted' | 'unable' | 'tajweed_major' | 'tajweed_minor', v: number) {
    setEdited((prev) => ({
      ...prev,
      percent: { ...prev.percent, costs: { ...prev.percent.costs, [key]: clamp(v, 0, 100) } },
    }));
    setSaved(false);
  }

  function setField<K extends keyof ScoringConfig>(key: K, v: ScoringConfig[K]) {
    setEdited((prev) => ({ ...prev, [key]: v }));
    setSaved(false);
  }

  async function handleSave() {
    if (!valid || saving) return;
    setSaving(true);
    await writeDoc(tp('config/scoring'), { ...edited, model: edited.model ?? 'weighted-v3' }, false);
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
              {/* TEMPORARY wiring (Task 2 rebuilds this page with all three v3
                  cards): the two existing cards write the v3 model ids. */}
              <SystemCard
                selected={(edited.model ?? 'weighted-v3') === 'weighted-v3'}
                title="Standard deductions"
                onSelect={() => setField('model', 'weighted-v3')}
              >
                Each mistake costs a fixed amount. Simple and predictable — the system used by Ibn Katheer since 2025.
              </SystemCard>
              <SystemCard
                selected={edited.model === 'escalating-v3'}
                title="Escalating penalties"
                onSelect={() => setField('model', 'escalating-v3')}
              >
                Repeated mistakes in the same question cost progressively more, spreading scores across skill levels.
              </SystemCard>
            </div>
          </div>

          <Divider className="my-8" />

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
                    onChange={(e) => setWeight('hifz', num(e.target.value, edited.percent.weights.hifz))}
                  />
                </Field>
                <Field>
                  <Label>Tajweed — recitation</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={edited.percent.weights.tajweed}
                    onChange={(e) => setWeight('tajweed', num(e.target.value, edited.percent.weights.tajweed))}
                  />
                </Field>
                <Field>
                  <Label>Voice &amp; delivery</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={edited.percent.weights.voice}
                    onChange={(e) => setWeight('voice', num(e.target.value, edited.percent.weights.voice))}
                  />
                </Field>
              </div>
            </Fieldset>
            <Fieldset className="mt-4">
              <Field className="max-w-40">
                <Label>Voice scale</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={edited.voice_max}
                  onChange={(e) => setField('voice_max', clamp(num(e.target.value, edited.voice_max), 1, 20))}
                />
              </Field>
              <Text className="mt-2 text-sm">Voice &amp; delivery is rated 0–{edited.voice_max} by the judge.</Text>
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
                  <TableHeader className="text-right">Cost</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Self-corrected</TableCell>
                  <TableCell className="text-zinc-500">{MISTAKE_MEANINGS.self_corrected}</TableCell>
                  {/* Fixed at 0 by the engine — not configurable, so it renders as text. */}
                  <TableCell className="text-right">0 points</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Prompted</TableCell>
                  <TableCell className="text-zinc-500">{MISTAKE_MEANINGS.prompted_fixed}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      aria-label="Prompted cost"
                      className="ml-auto max-w-24"
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={edited.percent.costs.prompted}
                      onChange={(e) => setPercentCost('prompted', num(e.target.value, edited.percent.costs.prompted))}
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Prompted-failed</TableCell>
                  <TableCell className="text-zinc-500">{MISTAKE_MEANINGS.prompted_failed}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      aria-label="Prompted-failed cost"
                      className="ml-auto max-w-24"
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={edited.percent.costs.unable}
                      onChange={(e) => setPercentCost('unable', num(e.target.value, edited.percent.costs.unable))}
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Tajweed major</TableCell>
                  <TableCell className="text-zinc-500">{MISTAKE_MEANINGS.tajweed_major}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      aria-label="Tajweed major cost"
                      className="ml-auto max-w-24"
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={edited.percent.costs.tajweed_major}
                      onChange={(e) => setPercentCost('tajweed_major', num(e.target.value, edited.percent.costs.tajweed_major))}
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Tajweed minor</TableCell>
                  <TableCell className="text-zinc-500">{MISTAKE_MEANINGS.tajweed_minor}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      aria-label="Tajweed minor cost"
                      className="ml-auto max-w-24"
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={edited.percent.costs.tajweed_minor}
                      onChange={(e) => setPercentCost('tajweed_minor', num(e.target.value, edited.percent.costs.tajweed_minor))}
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Text className="mt-3 text-sm text-zinc-500">
              One Prompted mistake costs {edited.percent.costs.prompted}% of that question&apos;s memorization.
            </Text>
            {edited.model === 'escalating-v3' && (
              <Text className="mt-1 text-sm text-zinc-500">
                Each repeated memorization mistake in the same question costs {edited.percent.escalation_step} more
                percentage points than the last. Tajweed costs stay flat.
              </Text>
            )}
          </div>

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
