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
import { Text } from '../vendor/text';

/**
 * Scoring config: chrome-only port of src/admin/ScoringConfig.tsx. All data
 * logic below is ported verbatim from that file: same hooks, same handler
 * names, same tp() paths, same clamp semantics. The scoring ENGINE
 * (src/scoring/*) is untouched — `validateScoringConfig`/`weightsSum`/
 * `DEFAULT_SCORING_CONFIG` are reused exactly as the source does. The
 * source's purely-decorative stacked weight bar (hPct/tPct/vPct) has no
 * chrome equivalent in this port and is dropped; the sum/validity summary
 * itself is kept via a Badge.
 *
 * The source gates the whole form (incl. Save) behind `loading` with a
 * "Loading config…" placeholder, so a Save click during the fetch window
 * can never write DEFAULT_SCORING_CONFIG over the live doc — same failure
 * class ContestantsPage.tsx guards its webhook-token generator against.
 * That gate is preserved verbatim here.
 */
function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

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
    await writeDoc(tp('config/scoring'), { ...edited, model: edited.model ?? 'deduction-v1' }, false);
    setSaving(false);
    setSaved(true);
  }

  function num(v: string, fallback: number) {
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }

  return (
    <>
      <Heading>Scoring config</Heading>
      <Text className="mt-2">Changes take effect immediately across all open views — scores recompute everywhere automatically.</Text>

      {loading && <Text className="mt-8">Loading config…</Text>}

      {!loading && (
        <>
          <div className="mt-8">
            <div className="flex items-baseline gap-3">
              <Subheading>Component weights</Subheading>
              <Badge color={valid ? 'green' : 'red'}>{`= ${sum}${valid ? ' ✓' : ` — ${sum < 100 ? 'under' : 'over'}`}`}</Badge>
            </div>
            <Fieldset className="mt-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <Label>Hifz</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={edited.weights.hifz}
                    onChange={(e) => setWeight('hifz', num(e.target.value, edited.weights.hifz))}
                  />
                </Field>
                <Field>
                  <Label>Tajweed</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={edited.weights.tajweed}
                    onChange={(e) => setWeight('tajweed', num(e.target.value, edited.weights.tajweed))}
                  />
                </Field>
                <Field>
                  <Label>Voice</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={edited.weights.voice}
                    onChange={(e) => setWeight('voice', num(e.target.value, edited.weights.voice))}
                  />
                </Field>
              </div>
            </Fieldset>
          </div>

          <Divider className="my-8" />

          <div>
            <Subheading>Hifz base (spread + DQ trigger)</Subheading>
            <Text className="mt-1">One knob, two jobs: lower hifz base spreads scores AND moves the auto-flag DQ trigger.</Text>
            <Fieldset className="mt-4">
              <Field>
                <Label>hifz_base</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={edited.hifz_base}
                  onChange={(e) => setField('hifz_base', clamp(num(e.target.value, edited.hifz_base), 1, 20))}
                />
              </Field>
            </Fieldset>
          </div>

          <Divider className="my-8" />

          <div>
            <Subheading>Component bases</Subheading>
            <Fieldset className="mt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <Label>tajweed_base</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={edited.tajweed_base}
                    onChange={(e) => setField('tajweed_base', clamp(num(e.target.value, edited.tajweed_base), 1, 20))}
                  />
                </Field>
                <Field>
                  <Label>voice_max</Label>
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
          </div>

          <Divider className="my-8" />

          <div>
            <Subheading>Deductions</Subheading>
            <Fieldset className="mt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <Label>Hifz: prompted fixed</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={edited.hifz_deductions.prompted_fixed}
                    onChange={(e) =>
                      setField('hifz_deductions', {
                        ...edited.hifz_deductions,
                        prompted_fixed: clamp(num(e.target.value, edited.hifz_deductions.prompted_fixed), 0, 10),
                      })
                    }
                  />
                </Field>
                <Field>
                  <Label>Hifz: prompted failed</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={edited.hifz_deductions.prompted_failed}
                    onChange={(e) =>
                      setField('hifz_deductions', {
                        ...edited.hifz_deductions,
                        prompted_failed: clamp(num(e.target.value, edited.hifz_deductions.prompted_failed), 0, 10),
                      })
                    }
                  />
                </Field>
                <Field>
                  <Label>Tajweed: major</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={edited.tajweed_deductions.major}
                    onChange={(e) =>
                      setField('tajweed_deductions', {
                        ...edited.tajweed_deductions,
                        major: clamp(num(e.target.value, edited.tajweed_deductions.major), 0, 10),
                      })
                    }
                  />
                </Field>
                <Field>
                  <Label>Tajweed: minor</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={edited.tajweed_deductions.minor}
                    onChange={(e) =>
                      setField('tajweed_deductions', {
                        ...edited.tajweed_deductions,
                        minor: clamp(num(e.target.value, edited.tajweed_deductions.minor), 0, 10),
                      })
                    }
                  />
                </Field>
              </div>
            </Fieldset>
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
            <Text>Scores recompute everywhere automatically — config is read live by all views.</Text>
            <Button onClick={() => void handleSave()} disabled={!valid || saving}>
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save config'}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
