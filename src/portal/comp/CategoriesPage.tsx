import { useEffect, useRef, useState } from 'react';
import { useDocData, writeDoc } from '../../data/db';
import { useTenant } from '../../tenant/TenantContext';
import { DEFAULT_STRUCTURE_CONFIG, generateSlots, type StructureConfig, type Division, type Category } from '../../domain/structure';
import { Button } from '../vendor/button';
import { Divider } from '../vendor/divider';
import { Field, Fieldset, Label } from '../vendor/fieldset';
import { Heading, Subheading } from '../vendor/heading';
import { Input } from '../vendor/input';
import { Switch } from '../vendor/switch';
import { Text } from '../vendor/text';

/**
 * Categories & Divisions: the structure-config editor half of
 * src/admin/StructurePanels.tsx (`section="structure"`) — the panels/judges
 * half of that file is Task 9's ComingSoon page, not this one. All data
 * logic below is ported verbatim from that file: same hooks, same handler
 * names, same tp() paths.
 */
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

  // ── Division editing ────────────────────────────────────────────────────
  function addDivision() {
    setEdited((prev) => ({ ...prev, divisions: [...prev.divisions, { id: crypto.randomUUID(), label: 'New division' }] }));
  }
  function removeDivision(divId: string) {
    setEdited((prev) => ({
      divisions: prev.divisions.filter((d) => d.id !== divId),
      categories: prev.categories.map((c) => ({ ...c, divisions: c.divisions.filter((d) => d !== divId) })),
    }));
  }
  function renameDivision(divId: string, label: string) {
    setEdited((prev) => ({
      ...prev,
      divisions: prev.divisions.map((d) => (d.id === divId ? { ...d, label } : d)),
    }));
  }

  // Free-typing buffer per division, so the input can hold transient blank/whitespace
  // while the user is editing without ever committing that into `edited` (mirrors the
  // source's commitRenameDiv guard: `if (!editingDivLabel.trim()) { …revert…; return; }`,
  // which committed the TRIMMED value and otherwise left the prior label untouched).
  const [divDrafts, setDivDrafts] = useState<Record<string, string>>({});
  const divInputValue = (div: Division) => divDrafts[div.id] ?? div.label;
  const setDivDraft = (divId: string, value: string) => setDivDrafts((prev) => ({ ...prev, [divId]: value }));
  const commitDivRename = (divId: string) => {
    const draft = divDrafts[divId];
    if (draft !== undefined) {
      const trimmed = draft.trim();
      if (trimmed) renameDivision(divId, trimmed);
      // else: blank/whitespace — revert, same as the source; `edited` is left untouched.
    }
    setDivDrafts((prev) => {
      const next = { ...prev };
      delete next[divId];
      return next;
    });
  };

  // ── Category editing ────────────────────────────────────────────────────
  function addCategory() {
    setEdited((prev) => ({
      ...prev,
      categories: [...prev.categories, { id: crypto.randomUUID(), label: '', minQuestions: 3, divisions: [], zeffyLabels: [''] }],
    }));
  }
  function removeCategory(catId: string) {
    setEdited((prev) => ({ ...prev, categories: prev.categories.filter((c) => c.id !== catId) }));
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
  function toggleCatDivision(catId: string, divId: string) {
    setEdited((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => {
        if (c.id !== catId) return c;
        const has = c.divisions.includes(divId);
        return { ...c, divisions: has ? c.divisions.filter((d) => d !== divId) : [...c.divisions, divId] };
      }),
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
      <div className="mt-8">
        <Subheading>Divisions</Subheading>
        <Fieldset className="mt-4">
          {edited.divisions.map((div: Division) => (
            <Field key={div.id} className="flex items-end gap-3">
              <div className="min-w-0 flex-1">
                <Label>Division name</Label>
                <Input
                  value={divInputValue(div)}
                  onChange={(e) => setDivDraft(div.id, e.target.value)}
                  onBlur={() => commitDivRename(div.id)}
                />
              </div>
              <Button outline onClick={() => removeDivision(div.id)}>
                Remove
              </Button>
            </Field>
          ))}
          <Button outline onClick={addDivision}>
            + Add division
          </Button>
        </Fieldset>
      </div>

      <Divider className="my-8" />

      <div>
        <Subheading>Categories</Subheading>
        <div className="mt-4 flex flex-col gap-6">
          {edited.categories.map((cat: Category) => (
            <div key={cat.id} className="rounded-lg border border-zinc-950/10 p-5 dark:border-white/10">
              <Fieldset>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <Label>Category name</Label>
                    <Input value={cat.label} onChange={(e) => setCatLabel(cat.id, e.target.value)} placeholder="Category name" />
                  </Field>
                  <Field>
                    <Label>Description (Zeffy label)</Label>
                    <Input
                      value={cat.zeffyLabels?.[0] ?? ''}
                      onChange={(e) => setCatDesc(cat.id, e.target.value)}
                      placeholder="Description (Zeffy label)"
                    />
                  </Field>
                </div>

                <Field className="mt-6">
                  <Label>Min questions</Label>
                  <Input
                    type="number"
                    min={1}
                    value={cat.minQuestions}
                    onChange={(e) => setMinQ(cat.id, Math.max(1, Number(e.target.value) || 1))}
                  />
                </Field>

                <Field className="mt-6">
                  <Label>Divisions</Label>
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                    {edited.divisions.map((div: Division) => (
                      <span key={div.id} className="flex items-center gap-2">
                        <Switch checked={cat.divisions.includes(div.id)} onChange={() => toggleCatDivision(cat.id, div.id)} />
                        <Text>{div.label}</Text>
                      </span>
                    ))}
                  </div>
                </Field>
              </Fieldset>

              <div className="mt-6 flex justify-end">
                <Button outline onClick={() => removeCategory(cat.id)}>
                  Remove category
                </Button>
              </div>
            </div>
          ))}

          <Button outline onClick={addCategory}>
            + Add category
          </Button>
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
