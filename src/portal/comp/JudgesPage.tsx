import { Fragment, useState } from 'react';
import { useCollection, useDocData, writeDoc, removeDoc } from '../../data/db';
import { useTenant } from '../../tenant/TenantContext';
import type { JudgeDoc, PanelDoc, AssignmentDoc } from '../../data/types';
import { DEFAULT_STRUCTURE_CONFIG, generateSlots, slotId, type StructureConfig } from '../../domain/structure';
import { Badge } from '../vendor/badge';
import { Button } from '../vendor/button';
import { Dialog, DialogActions, DialogDescription, DialogTitle } from '../vendor/dialog';
import { Divider } from '../vendor/divider';
import { Field, Fieldset, Label } from '../vendor/fieldset';
import { Heading, Subheading } from '../vendor/heading';
import { Input } from '../vendor/input';
import { Switch } from '../vendor/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../vendor/table';
import { Text } from '../vendor/text';

// Distinct per-panel color, cycling through Catalyst's shared Badge/Button palette —
// chrome-only stand-in for the source's panelColor() hex-array cycle.
const PANEL_COLORS = ['blue', 'amber', 'fuchsia', 'emerald', 'rose'] as const;

/**
 * Judges & panels: the roster + panel-assignment half of
 * src/admin/StructurePanels.tsx (`section="panels"`) — the categories/divisions
 * half of that file is Task 8's CategoriesPage, not this one. All data logic
 * below is ported verbatim from that file: same hooks, same handler names,
 * same tp() paths. `window.confirm` sites become Dialog confirms with the
 * same gating semantics.
 */
export function JudgesPage() {
  // ── Firestore data ──────────────────────────────────────────────────────
  const { tp } = useTenant();
  const judges = [...useCollection<JudgeDoc>(tp('judges'))].sort((a, b) => a.name.localeCompare(b.name));
  const panels = useCollection<PanelDoc>(tp('panels'));
  const assignments = useCollection<AssignmentDoc>(tp('assignments'));
  // Structure is read-only here — the editable copy (and its save flow) lives in
  // CategoriesPage; this page only needs it to label/derive the assignment-grid
  // slots, exactly as the source's `edited` state did for the panels half. Falls
  // back to the default config the same way ContestantsPage does for its own
  // read-only structure lookups.
  const structure = useDocData<StructureConfig>(tp('config/structure')).data ?? DEFAULT_STRUCTURE_CONFIG;
  const slots = generateSlots(structure);

  // ── Judges ──────────────────────────────────────────────────────────────
  const [newJudgeName, setNewJudgeName] = useState('');

  async function addJudge() {
    if (!newJudgeName.trim()) return;
    await writeDoc(tp('judges/' + crypto.randomUUID()), { name: newJudgeName.trim(), active: true });
    setNewJudgeName('');
  }

  // Buffer + blur-commit (CategoriesPage's commitDivRename shape): a per-judge draft
  // holds the transient input while typing; blur commits the TRIMMED value only when
  // non-blank — mirrors the source's commitRenameJudge guard exactly
  // (`if (editingJudgeName.trim()) writeDoc(...)`, else the Firestore name is left
  // untouched, no revert needed since the field always displays the source doc's
  // name once its draft is cleared).
  const [judgeDrafts, setJudgeDrafts] = useState<Record<string, string>>({});
  const judgeInputValue = (j: JudgeDoc & { id: string }) => judgeDrafts[j.id] ?? j.name;
  const setJudgeDraft = (id: string, value: string) => setJudgeDrafts((prev) => ({ ...prev, [id]: value }));
  const commitJudgeRename = (id: string) => {
    const draft = judgeDrafts[id];
    if (draft !== undefined) {
      const trimmed = draft.trim();
      if (trimmed) writeDoc(tp('judges/' + id), { name: trimmed }, true);
    }
    setJudgeDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // window.confirm → Dialog (confirmRemoveJudgeId); the cascade below (pull the
  // judge from any panel first, then remove the doc) is unchanged from the
  // source's removeJudge.
  const [confirmRemoveJudgeId, setConfirmRemoveJudgeId] = useState<string | null>(null);
  async function removeJudge(id: string) {
    await Promise.all(
      panels
        .filter((p) => p.judgeIds.includes(id))
        .map((p) => writeDoc(tp('panels/' + p.id), { name: p.name, judgeIds: p.judgeIds.filter((j) => j !== id) }, false)),
    );
    await removeDoc(tp('judges/' + id));
  }

  // ── Panels ──────────────────────────────────────────────────────────────
  const [openDropdown, setOpenDropdown] = useState<string | null>(null); // panel whose judges list is expanded

  async function addPanelRow() {
    await writeDoc(tp('panels/' + crypto.randomUUID()), { name: 'New panel', judgeIds: [] });
  }

  const [panelDrafts, setPanelDrafts] = useState<Record<string, string>>({});
  const panelInputValue = (p: PanelDoc & { id: string }) => panelDrafts[p.id] ?? p.name;
  const setPanelDraft = (id: string, value: string) => setPanelDrafts((prev) => ({ ...prev, [id]: value }));
  const commitPanelRename = (id: string) => {
    const draft = panelDrafts[id];
    if (draft !== undefined) {
      const trimmed = draft.trim();
      if (trimmed) writeDoc(tp('panels/' + id), { name: trimmed }, true);
    }
    setPanelDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // window.confirm → Dialog (confirmDeletePanelId); the cascade below (clear this
  // panel's slot assignments, then remove the panel doc) is unchanged from the
  // source's deletePanel.
  const [confirmDeletePanelId, setConfirmDeletePanelId] = useState<string | null>(null);
  async function deletePanel(id: string) {
    await Promise.all(assignments.filter((a) => a.panelId === id).map((a) => removeDoc(tp('assignments/' + a.id))));
    await removeDoc(tp('panels/' + id));
    if (openDropdown === id) setOpenDropdown(null);
  }

  async function togglePanelJudge(panel: PanelDoc & { id: string }, judgeId: string) {
    const has = panel.judgeIds.includes(judgeId);
    const judgeIds = has ? panel.judgeIds.filter((j) => j !== judgeId) : [...panel.judgeIds, judgeId];
    await writeDoc(tp('panels/' + panel.id), { name: panel.name, judgeIds }, false);
  }

  // ── Assignment grid ─────────────────────────────────────────────────────
  async function assignSlot(slot: { category: string; division: string }, panelId: string) {
    const sid = slotId(slot);
    const existing = assignments.find((a) => a.category === slot.category && a.division === slot.division);
    if (existing?.panelId === panelId) {
      await removeDoc(tp('assignments/' + sid)); // clicking the assigned panel toggles the slot off
    } else {
      await writeDoc(tp('assignments/' + sid), { category: slot.category, division: slot.division, panelId }, false);
    }
  }

  // ── render helpers ──────────────────────────────────────────────────────
  const catLabel = (id: string) => structure.categories.find((c) => c.id === id)?.label ?? id;
  const divLabel = (id: string) => structure.divisions.find((d) => d.id === id)?.label ?? id;
  const panelColor = (idx: number) => PANEL_COLORS[idx % PANEL_COLORS.length];

  const removingJudgeName = confirmRemoveJudgeId ? judges.find((j) => j.id === confirmRemoveJudgeId)?.name : undefined;

  return (
    <>
      <Heading>Judges &amp; panels</Heading>
      <Text className="mt-2">
        The roster — group them into panels below, and pick each panel&apos;s slots.
      </Text>

      <div className="mt-8">
        <Subheading>Judges</Subheading>
        <Table className="mt-4 [--gutter:--spacing(6)]">
          <TableHead>
            <TableRow>
              <TableHeader>Name</TableHeader>
              <TableHeader>Active</TableHeader>
              <TableHeader className="text-right">Action</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {judges.length === 0 && (
              <TableRow>
                <TableCell colSpan={3}>
                  <Text>No judges yet.</Text>
                </TableCell>
              </TableRow>
            )}
            {judges.map((j) => (
              <TableRow key={j.id}>
                <TableCell>
                  <Input value={judgeInputValue(j)} onChange={(e) => setJudgeDraft(j.id, e.target.value)} onBlur={() => commitJudgeRename(j.id)} />
                </TableCell>
                <TableCell>
                  {/* Read-only indicator — the source only ever displays `active` (a
                      colored dot) in this file; it has no toggle handler here. */}
                  <Switch checked={j.active} disabled />
                </TableCell>
                <TableCell className="text-right">
                  <Button outline onClick={() => setConfirmRemoveJudgeId(j.id)}>
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Fieldset className="mt-4">
          <Field className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <Label>Add judge</Label>
              <Input
                placeholder="Judge name"
                value={newJudgeName}
                onChange={(e) => setNewJudgeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addJudge();
                }}
              />
            </div>
            <Button onClick={() => void addJudge()}>+ Add</Button>
          </Field>
        </Fieldset>
      </div>

      <Divider className="my-8" />

      <div>
        <Subheading>Panels &amp; assignment</Subheading>
        <Text className="mt-1">
          Each row is a panel — name it, pick its judges, and tap the slots it scores.
        </Text>

        {slots.length === 0 ? (
          <Text className="mt-4 italic">No slots yet — set up Categories &amp; Divisions first.</Text>
        ) : (
          <Table className="mt-4 [--gutter:--spacing(6)]">
            <TableHead>
              <TableRow>
                <TableHeader>Panel</TableHeader>
                <TableHeader>Judges</TableHeader>
                {slots.map((slot) => (
                  <TableHeader key={slotId(slot)}>
                    {catLabel(slot.category)} · {divLabel(slot.division)}
                  </TableHeader>
                ))}
                <TableHeader className="text-right">Action</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {panels.length === 0 && (
                <TableRow>
                  <TableCell colSpan={slots.length + 3}>
                    <Text>No panels yet.</Text>
                  </TableCell>
                </TableRow>
              )}
              {panels.map((panel, pidx) => {
                const color = panelColor(pidx);
                const dropdownOpen = openDropdown === panel.id;
                return (
                  <Fragment key={panel.id}>
                    <TableRow>
                      <TableCell>
                        <Input
                          value={panelInputValue(panel)}
                          onChange={(e) => setPanelDraft(panel.id, e.target.value)}
                          onBlur={() => commitPanelRename(panel.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button outline onClick={() => setOpenDropdown(dropdownOpen ? null : panel.id)}>
                          <Badge color={color}>
                            {panel.judgeIds.length} {panel.judgeIds.length === 1 ? 'judge' : 'judges'}
                          </Badge>
                        </Button>
                      </TableCell>
                      {slots.map((slot) => {
                        const asgn = assignments.find((a) => a.category === slot.category && a.division === slot.division);
                        const isAssigned = asgn?.panelId === panel.id;
                        const otherPanelName = asgn && asgn.panelId !== panel.id ? panels.find((p) => p.id === asgn.panelId)?.name : undefined;
                        return (
                          <TableCell key={slotId(slot)}>
                            {isAssigned ? (
                              <Button color={color} onClick={() => void assignSlot(slot, panel.id)} title="Click to unassign">
                                ✓
                              </Button>
                            ) : (
                              <Button
                                outline
                                onClick={() => void assignSlot(slot, panel.id)}
                                title={otherPanelName ? `Reassign from ${otherPanelName}` : 'Assign this panel'}
                              >
                                {otherPanelName ?? '—'}
                              </Button>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right">
                        <Button outline onClick={() => setConfirmDeletePanelId(panel.id)}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                    {dropdownOpen && (
                      <TableRow>
                        <TableCell colSpan={slots.length + 3}>
                          <Fieldset>
                            <Label>Panel judges</Label>
                            {judges.length === 0 && <Text className="mt-2">Add judges in the roster above.</Text>}
                            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                              {judges.map((j) => (
                                <span key={j.id} className="flex items-center gap-2">
                                  <Switch checked={panel.judgeIds.includes(j.id)} onChange={() => void togglePanelJudge(panel, j.id)} />
                                  <Text>{j.name}</Text>
                                </span>
                              ))}
                            </div>
                          </Fieldset>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}

        <Button outline className="mt-4" onClick={() => void addPanelRow()}>
          + Add panel
        </Button>
      </div>

      <Dialog open={confirmRemoveJudgeId !== null} onClose={() => setConfirmRemoveJudgeId(null)}>
        <DialogTitle>Remove this judge?</DialogTitle>
        <DialogDescription>
          {removingJudgeName ?? 'This judge'} will be unassigned from all panels.
        </DialogDescription>
        <DialogActions>
          <Button plain onClick={() => setConfirmRemoveJudgeId(null)}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={() => {
              const id = confirmRemoveJudgeId;
              setConfirmRemoveJudgeId(null);
              if (id) void removeJudge(id);
            }}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDeletePanelId !== null} onClose={() => setConfirmDeletePanelId(null)}>
        <DialogTitle>Delete this panel?</DialogTitle>
        <DialogDescription>Its slot assignments will be cleared.</DialogDescription>
        <DialogActions>
          <Button plain onClick={() => setConfirmDeletePanelId(null)}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={() => {
              const id = confirmDeletePanelId;
              setConfirmDeletePanelId(null);
              if (id) void deletePanel(id);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
