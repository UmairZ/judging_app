import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useCollection, useDocData, writeDoc, now } from '../../data/db';
import { auth } from '../../firebase/app';
import { useTenant } from '../../tenant/TenantContext';
import { DEFAULT_STRUCTURE_CONFIG, type StructureConfig } from '../../domain/structure';
import { parseWorkbook, poolId, type ParsedSheet, type PoolRow } from '../../intake/questionBank';
import { assignPool, PoolExhaustedError, type BankRow } from '../../domain/assignment';
import { loadDataset, getJuz, getPage, getPassage } from '../../quran';
import { Badge } from '../vendor/badge';
import { Button } from '../vendor/button';
import { Dialog, DialogActions, DialogDescription, DialogTitle } from '../vendor/dialog';
import { Divider } from '../vendor/divider';
import { Field, Fieldset, Label } from '../vendor/fieldset';
import { Heading, Subheading } from '../vendor/heading';
import { Input } from '../vendor/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../vendor/table';
import { Text } from '../vendor/text';
import { Explainer } from '../Explainer';

/**
 * Questions — the operator's question-bank page (spec 2026-09-18 phase E):
 *
 * 1. Upload the question workbook (.xlsx): each sheet named "Juz a-b" parses
 *    into a per-category/side pool (src/intake/questionBank, Task 2); the
 *    preview shows every sheet's match before anything is written. Confirm
 *    writes one `questionPools/{categoryId_side}` doc per matched sheet.
 * 2. Pools & capacity: per category/side, questions available vs needed
 *    (enrolled × the category's Number of questions).
 * 3. Passage length (mushaf lines) — `config/questions {passage_lines}`,
 *    read by the judge reveal and by the crossing enrichment below.
 * 4. Assignment: the seeded both-pools draw (src/domain/assignment, Task 3).
 *    Assign covers UNASSIGNED enrollments only; Reshuffle redraws everyone
 *    and locks the moment any judging session exists.
 *
 * The 2MB mushaf dataset stays out of the portal bundle: `loadDataset()` is
 * only called inside the assign handler (dynamic-import chunk). Before any
 * drawing, every pool row is validated via `getPage` — the accessor that
 * THROWS on a nonexistent surah:ayah (`getJuz` silently accepts bad refs) —
 * and invalid refs surface as a red per-pool error instead of assigning.
 */

interface PoolDoc {
  categoryId: string;
  side: 'begin' | 'end';
  range: [number, number];
  rows: PoolRow[];
}

interface EnrollmentDoc {
  contestantId: string;
  category: string;
  division: string;
}

interface ContestantDoc {
  fullName: string;
}

interface QuestionsConfig {
  passage_lines: number;
}

interface QuestionSetDoc {
  enrollmentId: string;
  begin?: PoolRow[];
  end?: PoolRow[];
}

/** Default passage length (spec §1 / Decision 5): 7 mushaf lines. */
const DEFAULT_PASSAGE_LINES = 7;

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

/** 'Juz a–b' (en dash), collapsing a single-juz range to 'Juz a'. */
function rangeLabel(range: [number, number] | undefined): string {
  if (!range) return '—';
  const [a, b] = range;
  return a === b ? `Juz ${a}` : `Juz ${a}–${b}`;
}

/** mulberry32 PRNG seeded from crypto.getRandomValues — one stream per assign click. */
function seededRng(): () => number {
  const seed = new Uint32Array(1);
  crypto.getRandomValues(seed);
  let a = seed[0];
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function QuestionsPage() {
  const { tp } = useTenant();
  const { data: structureData, loading: structureLoading } = useDocData<StructureConfig>(tp('config/structure'));
  const { data: questionsCfg, loading: cfgLoading } = useDocData<QuestionsConfig>(tp('config/questions'));
  const pools = useCollection<PoolDoc>(tp('questionPools'));
  const enrollments = useCollection<EnrollmentDoc>(tp('enrollments'));
  const sets = useCollection<QuestionSetDoc>(tp('questionSets'));
  const contestants = useCollection<ContestantDoc>(tp('contestants'));
  const sessions = useCollection<{ judgeId: string }>(tp('sessions'));

  const categories = structureData?.categories ?? DEFAULT_STRUCTURE_CONFIG.categories;

  // ── upload state ────────────────────────────────────────────────────────
  const [preview, setPreview] = useState<ParsedSheet[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── passage length (ScoringPage save pattern: seed once, explicit Save) ──
  const [passageLines, setPassageLines] = useState(DEFAULT_PASSAGE_LINES);
  const [linesSaving, setLinesSaving] = useState(false);
  const [linesSaved, setLinesSaved] = useState(false);
  const seededLines = useRef(false);
  useEffect(() => {
    if (seededLines.current || !questionsCfg) return;
    setPassageLines(clamp(questionsCfg.passage_lines, 1, 15));
    seededLines.current = true;
  }, [questionsCfg]);

  // ── assignment state ────────────────────────────────────────────────────
  const [assigning, setAssigning] = useState(false);
  const [assignErrors, setAssignErrors] = useState<string[]>([]);
  const [confirmReshuffle, setConfirmReshuffle] = useState(false);

  const loading = structureLoading || cfgLoading;
  const setIds = new Set(sets.map((s) => s.id));
  const unassigned = enrollments.filter((e) => !setIds.has(e.id));
  const judgingStarted = sessions.length > 0;

  const catLabel = (id: string | null) => categories.find((c) => c.id === id)?.label ?? id ?? '?';
  const contestantName = (e: { id: string; contestantId: string }) =>
    contestants.find((c) => c.id === e.contestantId)?.fullName ?? e.id;

  // ── upload flow ─────────────────────────────────────────────────────────
  async function handleFile(ev: ChangeEvent<HTMLInputElement>) {
    const input = ev.target;
    const file = input.files?.[0];
    if (!file) return;
    setImportedCount(null);
    setUploadError(null);
    // Without the catch, a corrupt/non-xlsx file would throw into a voided
    // promise and the operator would see nothing happen at all.
    try {
      const buf = await file.arrayBuffer();
      input.value = ''; // allow re-choosing the same file
      setPreview(parseWorkbook(buf, categories));
    } catch (err) {
      setPreview(null);
      setUploadError(
        `Could not read that file — choose the question workbook (.xlsx). (${err instanceof Error ? err.message : String(err)})`,
      );
    }
  }

  const matchedSheets = (preview ?? []).filter((s) => s.categoryId !== null && s.side !== null);

  async function handleImport() {
    if (importing || matchedSheets.length === 0) return;
    setImporting(true);
    setUploadError(null);
    // A rejected write must never leave the page silently stuck mid-import:
    // surface the failure (naming the sheet) and keep the preview so the
    // operator can simply press Import again — rewriting a pool is idempotent.
    let written = 0;
    try {
      for (const s of matchedSheets) {
        await writeDoc(
          tp(`questionPools/${poolId(s.categoryId!, s.side!)}`),
          {
            categoryId: s.categoryId,
            side: s.side,
            range: s.range,
            rows: s.rows,
            uploadedAt: now(),
            uploadedBy: auth.currentUser?.uid ?? null,
          },
          false,
        );
        written += 1;
      }
      setImportedCount(matchedSheets.length);
      setPreview(null);
    } catch (err) {
      const failed = matchedSheets[written];
      setUploadError(
        `Import failed at “${failed?.sheetName ?? '?'}” — ${written} of ${matchedSheets.length} pools written. ` +
          `Press Import again to retry. (${err instanceof Error ? err.message : String(err)})`,
      );
    } finally {
      setImporting(false);
    }
  }

  // ── capacity rows (per category × side) ─────────────────────────────────
  const capacityRows = categories.flatMap((cat) => {
    const enrolled = enrollments.filter((e) => e.category === cat.id).length;
    const needed = enrolled * cat.minQuestions;
    return (['begin', 'end'] as const).map((side) => {
      const pool = pools.find((p) => p.id === poolId(cat.id, side));
      const available = pool?.rows.length ?? 0;
      return { cat, side, pool, enrolled, needed, available };
    });
  });

  // ── assignment ──────────────────────────────────────────────────────────
  async function runAssign(includeAssigned: boolean) {
    if (assigning) return;
    // Reshuffle race guard: a session created while the confirm dialog sat open
    // must not get every contestant's questions wiped — re-check at run time
    // (the confirm button is also disabled, but state can move between renders).
    if (includeAssigned && judgingStarted) return;
    setAssigning(true);
    setAssignErrors([]);
    try {
      const dataset = await loadDataset();
      // Crossing flags must match what the judge reveal will render, so enrich
      // with the SAVED config value — never an unsaved field edit.
      const effectiveLines = clamp(questionsCfg?.passage_lines ?? DEFAULT_PASSAGE_LINES, 1, 15);
      const targets = includeAssigned ? enrollments : unassigned;
      const errors: string[] = [];
      const writes: { path: string; data: Record<string, unknown> }[] = [];

      // No-reuse across draws: an incremental assign must not hand a late
      // enrollment a row some existing set of the same category already holds
      // (assignPool only guarantees no reuse WITHIN one call). Reshuffle
      // rewrites everyone, so nothing is "held" there.
      const enrollById = new Map(enrollments.map((e) => [e.id, e]));
      const heldByCategory = new Map<string, Set<string>>();
      if (!includeAssigned) {
        for (const s of sets) {
          const category = enrollById.get(s.id)?.category;
          if (!category) continue;
          let held = heldByCategory.get(category);
          if (!held) {
            held = new Set();
            heldByCategory.set(category, held);
          }
          for (const r of [...(s.begin ?? []), ...(s.end ?? [])]) held.add(`${r.surah}:${r.ayah}`);
        }
      }

      const byCategory = new Map<string, typeof targets>();
      for (const e of targets) {
        byCategory.set(e.category, [...(byCategory.get(e.category) ?? []), e]);
      }

      for (const [categoryId, list] of byCategory) {
        const cat = categories.find((c) => c.id === categoryId);
        if (!cat) {
          errors.push(`category "${categoryId}" is not in the structure (${list.length} enrollment(s) skipped)`);
          continue;
        }
        const ids = list.map((e) => e.id);
        const needed = ids.length * cat.minQuestions;

        // Validate + enrich both pools before drawing anything.
        const enriched: Partial<Record<'begin' | 'end', BankRow[]>> = {};
        const ranges: Partial<Record<'begin' | 'end', [number, number]>> = {};
        let blocked = false;
        for (const side of ['begin', 'end'] as const) {
          const pool = pools.find((p) => p.id === poolId(categoryId, side));
          if (!pool) {
            errors.push(`${cat.label} · ${side}: no pool uploaded`);
            blocked = true;
            continue;
          }
          ranges[side] = pool.range;
          const invalid: string[] = [];
          const rows: BankRow[] = [];
          for (const row of pool.rows) {
            try {
              // getPage THROWS on a nonexistent surah:ayah — getJuz would silently
              // bucket a bad ref, so this is the validation gate (ledger ruling 1).
              getPage(dataset, row.surah, row.ayah);
            } catch {
              invalid.push(row.ref);
              continue;
            }
            const juz = getJuz(dataset, row.surah, row.ayah);
            const passage = getPassage(dataset, row.surah, row.ayah, effectiveLines);
            const crosses = passage.lines.some((l) => l.surah !== row.surah);
            rows.push({ ...row, juz, crosses });
          }
          if (invalid.length > 0) {
            errors.push(`${cat.label} · ${side}: invalid reference${invalid.length === 1 ? '' : 's'} — ${invalid.join(', ')}`);
            blocked = true;
            continue;
          }
          // Drop rows already held by this category's existing sets (see above)
          // BEFORE the exhaustion check, so "available" is what can be drawn.
          const held = heldByCategory.get(categoryId);
          if (held && held.size > 0) {
            const remaining = rows.filter((r) => !held.has(`${r.surah}:${r.ayah}`));
            rows.length = 0;
            rows.push(...remaining);
          }
          if (rows.length < needed) {
            // Pre-checked here (assignPool would throw the same up front) so BOTH
            // short pools get named in one pass instead of failing on the first.
            errors.push(`${cat.label} · ${side}: pool exhausted — ${needed} needed, only ${rows.length} available`);
            blocked = true;
            continue;
          }
          enriched[side] = rows;
        }
        if (blocked) continue;

        const rng = seededRng();
        let beginAssign: Map<string, BankRow[]>;
        let endAssign: Map<string, BankRow[]>;
        try {
          beginAssign = assignPool(enriched.begin!, ids, cat.minQuestions, rng);
          endAssign = assignPool(enriched.end!, ids, cat.minQuestions, rng);
        } catch (err) {
          if (err instanceof PoolExhaustedError) {
            errors.push(`${cat.label}: pool exhausted — ${err.needed} needed, only ${err.available} available`);
            continue;
          }
          throw err;
        }

        for (const id of ids) {
          writes.push({
            path: tp(`questionSets/${id}`),
            data: {
              enrollmentId: id,
              begin: beginAssign.get(id)!,
              end: endAssign.get(id)!,
              beginLabel: rangeLabel(ranges.begin),
              endLabel: rangeLabel(ranges.end),
              assignedAt: now(),
              assignedBy: auth.currentUser?.uid ?? null,
            },
          });
        }
      }

      setAssignErrors(errors);
      // A rejected write must never resolve the busy state with no visible error:
      // sets already written keep (writes are per-enrollment and complete docs),
      // and the incremental assign covers the remainder on the next click.
      let saved = 0;
      try {
        for (const w of writes) {
          await writeDoc(w.path, w.data, false);
          saved += 1;
        }
      } catch (err) {
        setAssignErrors([
          ...errors,
          `Saving question sets failed after ${saved} of ${writes.length} — ` +
            `contestants already saved keep their sets; press Assign questions again to draw the rest. ` +
            `(${err instanceof Error ? err.message : String(err)})`,
        ]);
      }
    } finally {
      setAssigning(false);
    }
  }

  const sortedEnrollments = [...enrollments].sort((a, b) => contestantName(a).localeCompare(contestantName(b)));

  return (
    <>
      <Heading>Questions</Heading>

      {loading && <Text className="mt-8">Loading questions…</Text>}

      {!loading && (
        <>
          <div className="mt-8">
            <Explainer title="How questions work">
              <Text className="text-sm">
                Upload the question workbook once — each sheet named “Juz a-b” becomes a pool of starting ayat for
                one category, from the beginning or the end of its memorization. Review the preview, then import.
              </Text>
              <Text className="text-sm">
                Assign draws each contestant&apos;s questions from their category&apos;s two pools — no repeats within a
                draw, spread across the juz range, harder surah-crossing passages balanced fairly. Judges see the
                assigned passages on their reveal screen.
              </Text>
            </Explainer>
          </div>

          <Divider className="my-8" />

          {/* ── Upload card ──────────────────────────────────────────────── */}
          <div>
            <Subheading>Question workbook</Subheading>
            <Text className="mt-1">
              An .xlsx with one sheet per pool — “Juz 1-5” is the beginning pool of the 5-juz category, “Juz 26-30”
              its end pool. Column A holds each ayah reference (ending “surah:ayah”), column B the ayah text.
            </Text>
            <input
              type="file"
              aria-label="Question workbook"
              accept=".xlsx,.xls"
              onChange={(e) => void handleFile(e)}
              className="mt-4 block text-sm/6 text-zinc-500 file:mr-3 file:rounded-lg file:border file:border-zinc-950/10 file:bg-white file:px-3 file:py-1.5 file:text-sm/6 file:font-medium file:text-zinc-950 dark:text-zinc-400 dark:file:border-white/15 dark:file:bg-zinc-800 dark:file:text-white"
            />
            {uploadError && <Text className="mt-3 text-sm text-red-600 dark:text-red-500">{uploadError}</Text>}
            {importedCount !== null && (
              <Text className="mt-3 text-sm text-green-700 dark:text-green-400">
                ✓ Imported {importedCount} pool{importedCount === 1 ? '' : 's'}.
              </Text>
            )}

            {preview && (
              <div className="mt-4">
                <Table className="[--gutter:--spacing(6)]">
                  <TableHead>
                    <TableRow>
                      <TableHeader>Sheet</TableHeader>
                      <TableHeader>Pool</TableHeader>
                      <TableHeader className="text-right">Questions</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.map((s) => (
                      <TableRow key={s.sheetName}>
                        <TableCell className="font-medium">{s.sheetName}</TableCell>
                        <TableCell>
                          {s.categoryId !== null && s.side !== null ? (
                            <span>
                              {catLabel(s.categoryId)} · {s.side}
                            </span>
                          ) : (
                            <Badge color="red">Not recognized</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{s.rows.length}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {preview.some((s) => s.errors.length > 0) && (
                  <div className="mt-3 flex flex-col gap-1">
                    {preview.flatMap((s) =>
                      s.errors.map((err) => (
                        // rowIndex is the 0-based array index — operators think in
                        // Excel rows, so always show rowIndex + 1 (ledger ruling 2).
                        <Text key={`${s.sheetName}:${err.rowIndex}`} className="text-sm text-red-600 dark:text-red-500">
                          {s.sheetName} — Excel row {err.rowIndex + 1}: “{err.cell}” — {err.reason}
                        </Text>
                      )),
                    )}
                  </div>
                )}
                <div className="mt-4 flex items-center gap-3">
                  <Button color="green" disabled={importing || matchedSheets.length === 0} onClick={() => void handleImport()}>
                    {importing
                      ? 'Importing…'
                      : `Import ${matchedSheets.length} pool${matchedSheets.length === 1 ? '' : 's'}`}
                  </Button>
                  <Button plain onClick={() => setPreview(null)}>
                    Cancel
                  </Button>
                  {matchedSheets.length < preview.length && (
                    <Text className="text-sm text-zinc-500">Unrecognized sheets are skipped.</Text>
                  )}
                </div>
              </div>
            )}
          </div>

          <Divider className="my-8" />

          {/* ── Pools & capacity ─────────────────────────────────────────── */}
          <div>
            <Subheading>Pools &amp; capacity</Subheading>
            <Text className="mt-1">
              Needed = enrolled contestants × the category&apos;s Number of questions (set on Categories &amp; Divisions).
            </Text>
            <Table className="mt-4 [--gutter:--spacing(6)]">
              <TableHead>
                <TableRow>
                  <TableHeader>Category</TableHeader>
                  <TableHeader>Side</TableHeader>
                  <TableHeader>Juz</TableHeader>
                  <TableHeader className="text-right">Questions</TableHeader>
                  <TableHeader className="text-right">Needed</TableHeader>
                  <TableHeader>Status</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {capacityRows.map(({ cat, side, pool, needed, available }) => (
                  <TableRow key={`${cat.id}_${side}`}>
                    <TableCell className="font-medium">{cat.label}</TableCell>
                    <TableCell className="text-zinc-500">{side}</TableCell>
                    <TableCell className="text-zinc-500">{rangeLabel(pool?.range)}</TableCell>
                    <TableCell className="text-right">{available}</TableCell>
                    <TableCell className="text-right">{needed}</TableCell>
                    <TableCell>
                      {!pool && needed > 0 ? (
                        <Badge color="red">no pool</Badge>
                      ) : !pool ? (
                        <span className="text-zinc-400">—</span>
                      ) : available < needed ? (
                        <Badge color="red">short by {needed - available}</Badge>
                      ) : (
                        <Badge color="green">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Divider className="my-8" />

          {/* ── Passage length ───────────────────────────────────────────── */}
          <div className="flex flex-wrap items-end gap-4">
            <Fieldset>
              <Field className="max-w-48">
                <Label>Passage length (mushaf lines)</Label>
                <Input
                  type="number"
                  min={1}
                  max={15}
                  value={passageLines}
                  onChange={(e) => {
                    setPassageLines(clamp(Number(e.target.value) || 1, 1, 15));
                    setLinesSaved(false);
                  }}
                />
              </Field>
            </Fieldset>
            <Button
              disabled={linesSaving}
              onClick={() => {
                if (linesSaving) return;
                setLinesSaving(true);
                void writeDoc(tp('config/questions'), { passage_lines: passageLines }, false).then(() => {
                  setLinesSaving(false);
                  setLinesSaved(true);
                });
              }}
            >
              {linesSaving ? 'Saving…' : linesSaved ? '✓ Saved' : 'Save'}
            </Button>
            <Text className="basis-full text-sm text-zinc-500">
              How many printed mushaf lines each question&apos;s passage runs — judges see exactly this many lines on
              the reveal, and surah-crossing difficulty is measured against it.
            </Text>
          </div>

          <Divider className="my-8" />

          {/* ── Assignment ───────────────────────────────────────────────── */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Subheading>Assignment</Subheading>
              <Button
                color="green"
                disabled={assigning || unassigned.length === 0}
                onClick={() => void runAssign(false)}
              >
                {assigning ? 'Assigning…' : 'Assign questions'}
              </Button>
            </div>
            <Text className="mt-1">
              Draws questions for the {unassigned.length} contestant{unassigned.length === 1 ? '' : 's'} without a
              set — contestants who already have questions keep them.
            </Text>

            {assignErrors.length > 0 && (
              <div className="mt-4 flex flex-col gap-1">
                {assignErrors.map((e) => (
                  <Text key={e} className="text-red-600 dark:text-red-500">
                    {e}
                  </Text>
                ))}
              </div>
            )}

            <Table className="mt-4 [--gutter:--spacing(6)]">
              <TableHead>
                <TableRow>
                  <TableHeader>Contestant</TableHeader>
                  <TableHeader>Category</TableHeader>
                  <TableHeader>Status</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedEnrollments.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{contestantName(e)}</TableCell>
                    <TableCell className="text-zinc-500">{catLabel(e.category)}</TableCell>
                    <TableCell>
                      {(() => {
                        const set = sets.find((s) => s.id === e.id);
                        return set ? (
                          <span className="inline-flex items-center gap-2">
                            <Badge color="green">Assigned</Badge>
                            <span className="text-zinc-500">
                              {set.begin?.length ?? 0} + {set.end?.length ?? 0}
                            </span>
                          </span>
                        ) : (
                          <Badge color="zinc">Not assigned</Badge>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
                {enrollments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-zinc-500">
                      No enrollments yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <Divider soft className="my-6" />

            {/* Destructive, bottom of context (design principles 2 & 5). */}
            <Button
              outline
              className="!border-red-600/30 !text-red-600 dark:!border-red-400/40 dark:!text-red-400"
              disabled={judgingStarted || assigning}
              onClick={() => setConfirmReshuffle(true)}
            >
              Reshuffle all questions
            </Button>
            <Text className="mt-2 text-sm text-zinc-500">
              {judgingStarted
                ? 'Locked: judging has started — recorded sessions reference the assigned questions.'
                : 'Throws away every contestant’s questions and draws fresh ones for everyone.'}
            </Text>
          </div>

          <Dialog open={confirmReshuffle} onClose={() => setConfirmReshuffle(false)}>
            <DialogTitle>Reshuffle all questions?</DialogTitle>
            <DialogDescription>
              Every contestant — including those already assigned — gets a fresh draw. This cannot be undone.
            </DialogDescription>
            <DialogActions>
              <Button plain onClick={() => setConfirmReshuffle(false)}>
                Cancel
              </Button>
              <Button
                color="red"
                disabled={judgingStarted}
                onClick={() => {
                  setConfirmReshuffle(false);
                  void runAssign(true);
                }}
              >
                Reshuffle everything
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </>
  );
}
