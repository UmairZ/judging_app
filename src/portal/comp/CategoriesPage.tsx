import { useEffect, useRef, useState } from 'react';
import { useDocData, writeDoc } from '../../data/db';
import { useTenant } from '../../tenant/TenantContext';
import { DEFAULT_STRUCTURE_CONFIG, generateSlots, type StructureConfig } from '../../domain/structure';
import { Button } from '../vendor/button';
import { Divider } from '../vendor/divider';
import { Field, Fieldset, Label } from '../vendor/fieldset';
import { Heading, Subheading } from '../vendor/heading';
import { Input } from '../vendor/input';
import { Select } from '../vendor/select';
import { Text } from '../vendor/text';
import { PlusIcon } from '@heroicons/react/16/solid';

/**
 * Categories & Divisions — category-first master-detail (the operator-approved
 * `MockCatMaster` layout). UI-ONLY rework: the stored config keeps its global
 * `divisions` pool + per-category division id references, and this page maps
 * the "divisions live inside categories" presentation onto that shape:
 *
 * - A category's division rows are its referenced pool entries (labels
 *   resolved through the pool).
 * - "Add division" is reuse-first: a Select lists the pool divisions this
 *   category doesn't reference yet (divisions are shared across categories),
 *   and picking one references it. "New division…" (or an empty Select — no
 *   unreferenced pool entries) falls back to a name input: an existing pool
 *   label (exact, case-sensitive match) is referenced; a new name creates a
 *   pool entry AND references it.
 * - "Remove" on a division row drops the reference from THIS category only.
 *   The pool entry stays even if now unreferenced — pruning it could touch
 *   slot history, so unreferenced entries are deliberately kept.
 */
/** Sentinel option value for "New division…" in the reuse Select — cannot
 * collide with pool division ids (those are crypto.randomUUID()s or seeded slugs). */
const NEW_DIVISION = '__new-division__';

export function CategoriesPage() {
  // ── Firestore data ──────────────────────────────────────────────────────
  const { tp } = useTenant();
  const { data: structureData, loading } = useDocData<StructureConfig>(tp('config/structure'));

  // ── Structure local edit state ──────────────────────────────────────────
  const [edited, setEdited] = useState<StructureConfig>(DEFAULT_STRUCTURE_CONFIG);
  const [structureSaved, setStructureSaved] = useState(false);
  const seeded = useRef(false);

  // Seed local edit state ONCE from the loaded doc — never re-seed, or live snapshots
  // (which fire twice with offline cache) would clobber in-progress edits.
  useEffect(() => {
    if (seeded.current || !structureData) return;
    setEdited({ divisions: structureData.divisions, categories: structureData.categories });
    seeded.current = true;
  }, [structureData]);

  const slots = generateSlots(edited);

  // ── Selection (master list → detail panel) ──────────────────────────────
  // null falls through to the first category, so the initial render and a
  // remove-selected both land on "first remaining" without an effect.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedCat = edited.categories.find((c) => c.id === selectedId) ?? edited.categories[0] ?? null;

  // Draft for the "Add division" name input in the detail panel; cleared on
  // add and whenever the selection changes so text never targets the wrong category.
  const [newDivName, setNewDivName] = useState('');
  // Whether the "New division…" fallback (name input) is revealed in place of
  // the reuse Select; reset alongside the draft so it never carries across categories.
  const [creatingDiv, setCreatingDiv] = useState(false);
  function selectCategory(catId: string) {
    setSelectedId(catId);
    setNewDivName('');
    setCreatingDiv(false);
  }

  // ── Category editing ────────────────────────────────────────────────────
  function addCategory() {
    const id = crypto.randomUUID();
    setEdited((prev) => ({
      ...prev,
      categories: [...prev.categories, { id, label: '', minQuestions: 3, divisions: [], zeffyLabels: [''] }],
    }));
    selectCategory(id);
  }
  function removeCategory(catId: string) {
    setEdited((prev) => ({ ...prev, categories: prev.categories.filter((c) => c.id !== catId) }));
    setSelectedId(null); // derived fallback selects the first remaining (or none-state)
    setNewDivName('');
    setCreatingDiv(false);
  }
  function setMinQ(catId: string, v: number) {
    setEdited((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === catId ? { ...c, minQuestions: v } : c)),
    }));
  }
  function setCatLabel(catId: string, label: string) {
    setEdited((prev) => ({ ...prev, categories: prev.categories.map((c) => (c.id === catId ? { ...c, label } : c)) }));
  }
  function setCatDesc(catId: string, desc: string) {
    // the sub-line doubles as the Zeffy match label, so edits keep registration mapping in sync
    setEdited((prev) => ({ ...prev, categories: prev.categories.map((c) => (c.id === catId ? { ...c, zeffyLabels: [desc] } : c)) }));
  }

  // ── Division editing (per category) ─────────────────────────────────────
  // Reference an EXISTING pool division on this category — the reuse path the
  // Select drives (same reference-append as addDivisionByName's reuse branch).
  function addDivisionRef(catId: string, divId: string) {
    setEdited((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === catId && !c.divisions.includes(divId) ? { ...c, divisions: [...c.divisions, divId] } : c,
      ),
    }));
  }
  function addDivisionByName(catId: string) {
    const name = newDivName.trim();
    if (!name) return; // blank/whitespace — no-op, same spirit as the old rename guard
    setEdited((prev) => {
      // Exact (case-sensitive) label match reuses the pool entry; otherwise a
      // new pool entry is created (same id generation as the old addDivision).
      const existing = prev.divisions.find((d) => d.label === name);
      const div = existing ?? { id: crypto.randomUUID(), label: name };
      return {
        divisions: existing ? prev.divisions : [...prev.divisions, div],
        categories: prev.categories.map((c) =>
          c.id === catId && !c.divisions.includes(div.id) ? { ...c, divisions: [...c.divisions, div.id] } : c,
        ),
      };
    });
    setNewDivName('');
    setCreatingDiv(false); // back to the reuse-first Select (when anything is left to reuse)
  }
  function removeDivisionRef(catId: string, divId: string) {
    // Reference removal only — the pool entry stays even if now unreferenced
    // (pruning risks touching slot history).
    setEdited((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === catId ? { ...c, divisions: c.divisions.filter((d) => d !== divId) } : c)),
    }));
  }

  async function saveStructure() {
    await writeDoc(tp('config/structure'), edited, false);
    setStructureSaved(true);
    setTimeout(() => setStructureSaved(false), 2000);
  }

  // ── render helpers ──────────────────────────────────────────────────────
  const catLabel = (id: string) => edited.categories.find((c) => c.id === id)?.label ?? id;
  const divLabel = (id: string) => edited.divisions.find((d) => d.id === id)?.label ?? id;

  return (
    <>
      <Heading>Categories & divisions</Heading>
      <Text className="mt-2">
        Set up the categories contestants compete in and the divisions each one runs — panels attach to the
        resulting slots.
      </Text>

      {/* Same gate as ScoringPage: the whole form (incl. Save) waits for the
          config load, so a Save click during the fetch window can never write
          DEFAULT_STRUCTURE_CONFIG over the live doc (merge: false). */}
      {loading && <Text className="mt-8">Loading structure…</Text>}

      {!loading && (
        <>
          <div className="mt-8 flex flex-wrap gap-8">
            {/* ── Master: category list ─────────────────────────────────── */}
            <div className="w-64 shrink-0">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm/6 text-zinc-500 dark:text-zinc-400">
                  {edited.categories.length} categor{edited.categories.length === 1 ? 'y' : 'ies'}
                </span>
                <Button className="!px-2.5 !py-1 text-sm" onClick={addCategory}>
                  <PlusIcon /> New
                </Button>
              </div>
              {edited.categories.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-zinc-950/10 bg-white dark:border-white/10 dark:bg-zinc-900">
                  {edited.categories.map((c, i) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCategory(c.id)}
                      className={
                        'block w-full cursor-pointer px-4 py-3 text-left ' +
                        (c.id === selectedCat?.id ? 'bg-zinc-100 dark:bg-zinc-800' : '') +
                        (i > 0 ? ' border-t border-zinc-950/5 dark:border-white/5' : '')
                      }
                    >
                      <div className="text-sm/6 font-semibold">{c.label || 'Untitled category'}</div>
                      <div className="text-xs/5 text-zinc-500 dark:text-zinc-400">
                        {c.divisions.length} division{c.divisions.length !== 1 ? 's' : ''} · min {c.minQuestions} Q
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Detail: selected category ─────────────────────────────── */}
            <div className="min-w-0 flex-1 rounded-xl border border-zinc-950/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
              {!selectedCat && <Text>Select a category</Text>}
              {selectedCat && (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <Subheading>{selectedCat.label || 'Untitled category'}</Subheading>
                    <Button plain className="text-red-600" onClick={() => removeCategory(selectedCat.id)}>
                      Remove category
                    </Button>
                  </div>
                  <Fieldset className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field>
                      <Label>Category name</Label>
                      <Input
                        value={selectedCat.label}
                        onChange={(e) => setCatLabel(selectedCat.id, e.target.value)}
                        placeholder="Category name"
                      />
                    </Field>
                    <Field>
                      <Label>Description (Zeffy label)</Label>
                      <Input
                        value={selectedCat.zeffyLabels?.[0] ?? ''}
                        onChange={(e) => setCatDesc(selectedCat.id, e.target.value)}
                        placeholder="Description (Zeffy label)"
                      />
                    </Field>
                    <Field>
                      <Label>Min questions</Label>
                      <Input
                        type="number"
                        min={1}
                        value={selectedCat.minQuestions}
                        onChange={(e) => setMinQ(selectedCat.id, Math.max(1, Number(e.target.value) || 1))}
                      />
                    </Field>
                  </Fieldset>
                  <Divider soft className="my-5" />
                  <Subheading className="!text-sm">Divisions</Subheading>
                  <div className="mt-2 divide-y divide-zinc-950/5 dark:divide-white/5">
                    {selectedCat.divisions.map((divId) => (
                      <div key={divId} className="flex items-center justify-between py-2.5">
                        <span className="text-sm/6 font-medium">{divLabel(divId)}</span>
                        <Button plain className="!py-0.5 text-sm text-red-600" onClick={() => removeDivisionRef(selectedCat.id, divId)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                  {(() => {
                    // Divisions are shared across categories, so reuse is the
                    // primary path: offer the pool entries this category doesn't
                    // reference yet. With nothing left to reuse, skip straight
                    // to the name input.
                    const unreferenced = edited.divisions.filter((d) => !selectedCat.divisions.includes(d.id));
                    const showNameInput = creatingDiv || unreferenced.length === 0;
                    return (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {!showNameInput && (
                          <div className="w-full max-w-56">
                            <Select
                              aria-label="Add a division"
                              value=""
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === NEW_DIVISION) setCreatingDiv(true);
                                else if (v) addDivisionRef(selectedCat.id, v);
                                // controlled value="" — the Select snaps back to the placeholder
                              }}
                            >
                              <option value="" disabled>
                                Add a division…
                              </option>
                              {unreferenced.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.label}
                                </option>
                              ))}
                              <option value={NEW_DIVISION}>New division…</option>
                            </Select>
                          </div>
                        )}
                        {showNameInput && (
                          <>
                            <div className="max-w-48">
                              <Input
                                placeholder="Division name"
                                value={newDivName}
                                onChange={(e) => setNewDivName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') addDivisionByName(selectedCat.id);
                                }}
                              />
                            </div>
                            <Button outline onClick={() => addDivisionByName(selectedCat.id)}>
                              <PlusIcon /> Add division
                            </Button>
                            {creatingDiv && (
                              <Button
                                plain
                                onClick={() => {
                                  setCreatingDiv(false);
                                  setNewDivName('');
                                }}
                              >
                                Cancel
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>

          <Divider className="my-8" />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <Text>
              This config yields <strong className="text-zinc-950 dark:text-white">{slots.length} slot{slots.length !== 1 ? 's' : ''}</strong>
              {slots.length > 0 && <> — {slots.map((s) => `(${catLabel(s.category)}×${divLabel(s.division)})`).join(', ')}</>}. Panels attach
              to these.
            </Text>
            <Button onClick={() => void saveStructure()}>{structureSaved ? '✓ Saved' : 'Save Structure'}</Button>
          </div>
        </>
      )}
    </>
  );
}
