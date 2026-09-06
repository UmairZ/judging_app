import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useCollection, useDocData, writeDoc, removeDoc, now } from '../../data/db';
import { useTenant } from '../../tenant/TenantContext';
import { storage } from '../../firebase/app';
import type { RegistrationDoc, ContestantDoc, EnrollmentDoc } from '../../data/types';
import { DEFAULT_STRUCTURE_CONFIG, defaultDivisionForCategory, type StructureConfig, type Category } from '../../domain/structure';
import { enrollmentId } from '../../domain/ids';
import { generateWebhookToken } from '../../onboarding/logic';
import { parseCsv, rowsToPeople, csvRegistrationId } from '../../intake/csv';
import {
  resolveCategories,
  buildDefaultDivisions,
  buildPromotion,
  type ResolvedCategory,
  type CategoryDivisionPair,
} from '../../intake/promotion';
import { Avatar } from '../vendor/avatar';
import { Badge } from '../vendor/badge';
import { Button } from '../vendor/button';
import { Dialog, DialogActions, DialogDescription, DialogTitle } from '../vendor/dialog';
import { Field, Fieldset, Label } from '../vendor/fieldset';
import { Heading, Subheading } from '../vendor/heading';
import { Input } from '../vendor/input';
import { Navbar, NavbarItem, NavbarSection } from '../vendor/navbar';
import { Select } from '../vendor/select';
import { Switch } from '../vendor/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../vendor/table';
import { Text } from '../vendor/text';

/** First+last initial, uppercased — matches src/ui/theme.ts's `initials()` without
 * importing theme.ts (portal files may not import the C helpers or theme.ts). */
function initials(name: string): string {
  return name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DrawerState {
  // Always a real registration id: the drawer only ever opens from a
  // Promote click on a specific row (see openDrawer below). The "Quick-add
  // a brand-new contestant" capability this used to also support (regId ==
  // null) is reconciled into src/admin/Contestants.tsx's fuller version —
  // see handleNewContestant + the roster edit panel further down this file.
  regId: string;
  fullName: string;
  gender: 'male' | 'female' | null;
  resolved: ResolvedCategory[];
  // per-category chosen division
  divisions: Record<string, string>;
}

/** Roster edit-panel form state (from src/admin/Contestants.tsx). */
interface EditState {
  fullName: string;
  gender: 'male' | 'female' | null;
  dateOfBirth: string;
  active: boolean;
  photoUrl: string | null;
}

// ---------------------------------------------------------------------------
// Promote Drawer component
// ---------------------------------------------------------------------------

interface DrawerProps {
  state: DrawerState;
  structure: StructureConfig;
  onClose: () => void;
  onChange: (next: DrawerState) => void;
  onSubmit: () => void;
}

function PromoteDrawer({ state, structure, onClose, onChange, onSubmit }: DrawerProps) {
  const { fullName, gender, resolved, divisions } = state;

  const divLabel = (id: string) => structure.divisions.find((d) => d.id === id)?.label ?? id;

  const setName = (v: string) => onChange({ ...state, fullName: v });
  const setGender = (g: 'male' | 'female') => {
    const newGender = state.gender === g ? null : g;
    const newDivisions = buildDefaultDivisions(resolved, newGender, structure);
    onChange({ ...state, gender: newGender, divisions: { ...divisions, ...newDivisions } });
  };
  const setDivision = (catId: string, div: string) =>
    onChange({ ...state, divisions: { ...divisions, [catId]: div } });

  const setUnmappedCategory = (idx: number, newCatId: string) => {
    const newCat = structure.categories.find((c) => c.id === newCatId);
    const newResolved = resolved.map((r, i) =>
      i === idx
        ? { ...r, categoryId: newCatId, label: newCat?.label ?? r.rawLabel, unmapped: !newCatId }
        : r,
    );
    const newDivisions = { ...divisions };
    if (newCat) {
      const d = defaultDivisionForCategory(newCat, gender);
      newDivisions[newCatId] = d ?? (newCat.divisions[0] ?? '');
    }
    onChange({ ...state, resolved: newResolved, divisions: newDivisions });
  };

  const drawerLabel = `Promote — ${fullName || 'New Contestant'}`;

  const canSubmit = fullName.trim().length > 0 && resolved.every((r) => !r.unmapped || r.categoryId);

  return (
    <div className="rounded-lg border border-zinc-950/10 bg-zinc-950/2.5 p-5 dark:border-white/10 dark:bg-white/2.5">
      <Subheading>{drawerLabel}</Subheading>

      <Fieldset className="mt-4">
        <Field>
          <Label>Full name</Label>
          <Input value={fullName} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </Field>

        <Field className="mt-6">
          <Label>Gender</Label>
          <div className="mt-2 flex gap-2">
            {(['male', 'female'] as const).map((g) =>
              gender === g ? (
                <Button key={g} onClick={() => setGender(g)}>
                  {g === 'male' ? 'Male' : 'Female'}
                </Button>
              ) : (
                <Button key={g} outline onClick={() => setGender(g)}>
                  {g === 'male' ? 'Male' : 'Female'}
                </Button>
              ),
            )}
          </div>
        </Field>

        {resolved.length === 0 && (
          <Text className="mt-4 italic">No categories — add via Quick-add or registration had none.</Text>
        )}

        {resolved.map((r, idx) => {
          const cat: Category | undefined = structure.categories.find((c) => c.id === r.categoryId);
          const chosenDiv = r.categoryId ? (divisions[r.categoryId] ?? '') : '';

          return (
            <div key={idx} className="mt-6 grid gap-6 sm:grid-cols-2">
              <Field>
                <Label>Category</Label>
                {r.unmapped ? (
                  <Select value={r.categoryId} onChange={(e) => setUnmappedCategory(idx, e.target.value)}>
                    <option value="">— unmapped: {r.rawLabel}</option>
                    {structure.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <div>
                    <Badge color="lime">{r.label}</Badge>
                  </div>
                )}
              </Field>

              {cat && (
                <Field>
                  <Label>
                    Division <span className="text-xs font-normal text-zinc-500">auto from gender</span>
                  </Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {cat.divisions.map((divId) =>
                      chosenDiv === divId ? (
                        <Button key={divId} onClick={() => setDivision(r.categoryId, divId)}>
                          {divLabel(divId)}
                        </Button>
                      ) : (
                        <Button key={divId} outline onClick={() => setDivision(r.categoryId, divId)}>
                          {divLabel(divId)}
                        </Button>
                      ),
                    )}
                  </div>
                </Field>
              )}
            </div>
          );
        })}

      </Fieldset>

      <div className="mt-6 flex justify-end gap-3">
        <Button plain onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={!canSubmit}>
          Create contestant &amp; enrollment
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small display helpers (read-only formatting; no data logic)
// ---------------------------------------------------------------------------

/** `createdAt` may be a Firestore `Timestamp` (live backend) or a plain millis
 * number (InMemoryBackend's resolved sentinel) — normalize to a display string. */
function createdAtDisplay(value: unknown): string {
  if (typeof value === 'number') return new Date(value).toLocaleDateString();
  if (value && typeof value === 'object' && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return new Date((value as { toMillis: () => number }).toMillis()).toLocaleDateString();
  }
  return '—';
}

function fullNameOf(reg: { parsedFields?: Record<string, unknown> }): string {
  const parsedFields = reg.parsedFields ?? {};
  return typeof parsedFields.fullName === 'string' ? parsedFields.fullName : '(no name)';
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

/**
 * Contestants: two views over the same registration/contestant data —
 * an immutable Ledger of every registration exactly as it arrived, and the
 * Roster (the promotion workflow that turns a registration into a
 * contestant + enrollments). All data logic below is ported verbatim from
 * src/admin/Registrations.tsx — same hooks, same handlers, same tp() paths.
 */
export function ContestantsPage() {
  const { orgId, compId, tp } = useTenant();
  const registrations = useCollection<RegistrationDoc>(tp('registrations'));
  const contestants = useCollection<ContestantDoc>(tp('contestants'));
  const structure = useDocData<StructureConfig>(tp('config/structure')).data ?? DEFAULT_STRUCTURE_CONFIG;

  const [tab, setTab] = useState<'ledger' | 'roster'>('ledger');

  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importReport, setImportReport] = useState<string | null>(null);

  // Zeffy event-title filter (admin-editable; the webhook reads config/zeffy.eventTitle).
  const zeffyCfg = useDocData<{ eventTitle?: string; token?: string }>(tp('config/zeffy'));
  const [zeffyTitle, setZeffyTitle] = useState<string | null>(null); // null until edited → never clobbers live value
  const [zeffySaved, setZeffySaved] = useState(false);
  const zeffyValue = zeffyTitle ?? zeffyCfg.data?.eventTitle ?? '';
  const zeffyDirty = zeffyTitle !== null && zeffyTitle.trim() !== (zeffyCfg.data?.eventTitle ?? '').trim();
  const saveZeffy = async () => { await writeDoc(tp('config/zeffy'), { eventTitle: zeffyValue.trim() }); setZeffySaved(true); };

  const zeffyToken = zeffyCfg.data?.token ?? '';
  const webhookUrl = zeffyToken ? `${window.location.origin}/zeffy/${orgId}/${compId}?token=${zeffyToken}` : '';
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  // window.confirm → Dialog: the confirm only ever gated the "rotate an
  // existing token" branch, so only that branch opens the dialog below.
  const [confirmRotateOpen, setConfirmRotateOpen] = useState(false);
  const performRotate = async () => {
    setRotating(true);
    try {
      await writeDoc(tp('config/zeffy'), { token: generateWebhookToken() });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the token');
    } finally {
      setRotating(false);
    }
  };
  const rotateToken = () => {
    if (zeffyToken) { setConfirmRotateOpen(true); return; }
    void performRotate();
  };
  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* non-secure context — the URL is visible to select manually */ }
  };

  const catLabel = (id: string) => structure.categories.find((c) => c.id === id)?.label ?? id;

  // Determine promoted status by checking whether a contestant has this registrationId.
  // Precompute a Set once so the sort comparator + per-row checks are O(1), not O(contestants).
  const promotedRegIds = useMemo(
    () => new Set(contestants.map((c) => c.registrationId).filter(Boolean)),
    [contestants],
  );
  const isPromoted = (regId: string): boolean => promotedRegIds.has(regId);

  // Open drawer for a registration
  const openDrawer = (reg: (typeof registrations)[number]) => {
    const parsedFields = reg.parsedFields ?? {};
    const fullName = typeof parsedFields.fullName === 'string' ? parsedFields.fullName : '';
    const genderRaw = parsedFields.gender;
    const gender: 'male' | 'female' | null =
      genderRaw === 'male' || genderRaw === 'female' ? genderRaw : null;
    const resolved = resolveCategories(parsedFields.categories, structure);
    const divisions = buildDefaultDivisions(resolved, gender, structure);
    setError(null);
    setDrawer({ regId: reg.id, fullName, gender, resolved, divisions });
  };

  const closeDrawer = () => {
    setDrawer(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!drawer) return;
    const { regId, fullName, gender, resolved, divisions } = drawer;

    const name = fullName.trim();
    if (!name) return;

    setBusy(true);
    setError(null);
    try {
      const cid = crypto.randomUUID();

      // Look up the source registration (regId is always real — see DrawerState).
      const reg = registrations.find((r) => r.id === regId);

      // Build pairs: only categories that are properly resolved
      const pairs: CategoryDivisionPair[] = resolved
        .filter((r) => r.categoryId && !r.unmapped)
        .map((r) => ({ categoryId: r.categoryId, division: divisions[r.categoryId] ?? '' }))
        .filter((p) => p.division);

      // 1. Write contestant doc
      await writeDoc(tp(`contestants/${cid}`), {
        fullName: name,
        gender: gender ?? null,
        photoUrl: null,
        registrationId: regId,
        fields: reg?.parsedFields ?? {},
        active: true,
      });

      // 2. Write enrollment docs
      await Promise.all(
        pairs.map((p) =>
          writeDoc(tp(`enrollments/${enrollmentId(cid, p.categoryId)}`), {
            contestantId: cid,
            category: p.categoryId,
            division: p.division,
            round: 'main',
          }),
        ),
      );

      // NOTE: registrations are immutable per security rules — we do NOT write back
      // to the registration doc. "Promoted" status is computed from contestants collection.

      setDrawer(null);
      setFlash(`Promoted ${name} → see Contestants ✓`);
      setTimeout(() => setFlash(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Write failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCsvFile = async (file: File) => {
    setImportReport(null);
    setError(null);
    try {
      const { people, errors } = rowsToPeople(parseCsv(await file.text()));
      if (people.length === 0) {
        setError(errors.length ? `CSV import failed — ${errors.map((e) => `line ${e.line}: ${e.message}`).join('; ')}` : 'CSV import failed — no rows found.');
        return;
      }
      setBusy(true);
      let written = 0;
      let existing = 0;
      const failed: string[] = [];
      for (const p of people) {
        try {
          // create-only: an existing id (re-import) is rejected by rules → counted as already imported
          await writeDoc(tp(`registrations/${csvRegistrationId(p)}`), {
            source: 'csv',
            zeffyPaymentId: null,
            zeffyItemId: null,
            kind: 'ticket',
            buyer: {},
            rawItem: { line: p.line },
            parsedFields: { fullName: p.fullName, gender: p.gender, dateOfBirth: p.dateOfBirth, categories: p.categories },
            paymentStatus: 'n/a',
            createdAt: now(),
            promotedContestantId: null,
          }, false);
          written++;
        } catch (e) {
          const code = (e as { code?: string })?.code ?? '';
          if (code === 'permission-denied') existing++;
          else failed.push(`line ${p.line}: ${e instanceof Error ? e.message : 'write failed'}`);
        }
      }
      setBusy(false);
      const parts = [`Imported ${written} registration${written === 1 ? '' : 's'}`];
      if (existing) parts.push(`${existing} already imported`);
      if (errors.length) parts.push(`${errors.length} row${errors.length === 1 ? '' : 's'} skipped (${errors.map((e) => `line ${e.line}: ${e.message}`).join('; ')})`);
      setImportReport(parts.join(' · '));
      if (failed.length) setError(`${failed.length} row(s) FAILED — ${failed.join('; ')}`);
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : 'CSV import failed — could not read file.');
    }
  };

  const handleBulkPromote = async () => {
    setBusy(true);
    setError(null);
    let promoted = 0;
    let skipped = 0;
    let failed = false;
    for (const reg of registrations) {
      if (reg.kind !== 'ticket' || isPromoted(reg.id)) continue;
      const plan = buildPromotion(reg, structure);
      if (!plan) { skipped++; continue; }
      const cid = crypto.randomUUID();
      try {
        await writeDoc(tp(`contestants/${cid}`), {
          fullName: plan.fullName, gender: plan.gender, photoUrl: null,
          registrationId: reg.id, fields: reg.parsedFields ?? {}, active: true,
        });
        await Promise.all(plan.pairs.map((p) =>
          writeDoc(tp(`enrollments/${enrollmentId(cid, p.categoryId)}`), {
            contestantId: cid, category: p.categoryId, division: p.division, round: 'main',
          }),
        ));
        promoted++;
      } catch (e) {
        // compensate: a contestant doc without enrollments would read as promoted and block retry
        try {
          await removeDoc(tp(`contestants/${cid}`));
          await Promise.all(plan.pairs.map((p) => removeDoc(tp(`enrollments/${enrollmentId(cid, p.categoryId)}`))));
        } catch { /* best-effort */ }
        setError(e instanceof Error ? e.message : 'Write failed');
        failed = true;
        break;
      }
    }
    setBusy(false);
    if (!failed) {
      setFlash(`Promoted ${promoted} · ${skipped} need review (open each to resolve)`);
      setTimeout(() => setFlash(null), 6000);
    }
  };

  // Sort: ticket kind first, then donations/other; within ticket: pending before promoted
  const sortedRegs = [...registrations].sort((a, b) => {
    const aTicket = a.kind === 'ticket' ? 0 : 1;
    const bTicket = b.kind === 'ticket' ? 0 : 1;
    if (aTicket !== bTicket) return aTicket - bTicket;
    const aPromoted = isPromoted(a.id) ? 1 : 0;
    const bPromoted = isPromoted(b.id) ? 1 : 0;
    return aPromoted - bPromoted;
  });

  // Ledger: every registration, oldest first — a read-only journal, not the
  // working (ticket-first/pending-first) roster order above.
  const ledgerRegs = [...registrations].sort((a, b) => {
    const millis = (v: unknown): number =>
      typeof v === 'number' ? v : typeof v === 'object' && v && typeof (v as { toMillis?: unknown }).toMillis === 'function'
        ? (v as { toMillis: () => number }).toMillis()
        : 0;
    return millis(a.createdAt) - millis(b.createdAt);
  });

  // -------------------------------------------------------------------------
  // Roster management — ported verbatim from src/admin/Contestants.tsx
  // (the true source for contestant roster editing; see Round 2 ruling).
  //
  // Reconciliation with the promote flow above (both files touched the same
  // ground):
  //  - `contestants` and `structure` are each subscribed ONCE, above — both
  //    source files read the identical tp('contestants') / tp('config/structure')
  //    collections, so there is no second subscription here. `sortedContestants`
  //    is Contestants.tsx's own derived (name-sorted) view of that same data —
  //    it used the bare name `contestants` for this in the source file, but
  //    that name is already taken here by the unsorted collection (used above
  //    for `promotedRegIds`), hence the rename.
  //  - `catLabel` is identical in both source files (same structure lookup) —
  //    kept as the one copy already defined above.
  //  - Contestants.tsx's own `fileInputRef` (photo upload) is renamed
  //    `photoInputRef` here — `fileInputRef` above is already the Registrations
  //    screen's CSV-import input.
  //  - The "add a brand-new contestant" capability existed twice: as this
  //    file's now-unreachable PromoteDrawer quick-add branch (regId == null,
  //    never wired to a button — see DrawerState's comment above) and as
  //    Contestants.tsx's real, wired `handleNewContestant`. Per the ruling,
  //    Contestants.tsx's version is the one kept; the dead branch was removed.
  // -------------------------------------------------------------------------

  const sortedContestants = [...contestants].sort((a, b) => a.fullName.localeCompare(b.fullName));
  const enrollments = useCollection<EnrollmentDoc>(tp('enrollments'));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [newDiv, setNewDiv] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const selected = sortedContestants.find((c) => c.id === selectedId) ?? null;

  // Enrollment count per contestant, computed once instead of an O(C·E) filter per row.
  const enrCountById = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of enrollments) m.set(e.contestantId, (m.get(e.contestantId) ?? 0) + 1);
    return m;
  }, [enrollments]);

  // seed edit state whenever selection changes
  useEffect(() => {
    if (!selected) {
      setEdit(null);
      return;
    }
    setEdit({
      fullName: selected.fullName,
      gender: selected.gender,
      dateOfBirth: typeof selected.fields?.dateOfBirth === 'string' ? selected.fields.dateOfBirth : '',
      active: selected.active,
      photoUrl: selected.photoUrl,
    });
    setPhotoNote(null);
    setAddingCat(false);
    setNewCat('');
    setNewDiv('');
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const myEnrollments = selectedId
    ? enrollments.filter((e) => e.contestantId === selectedId)
    : [];

  const enrolledCatIds = new Set(myEnrollments.map((e) => e.category));

  const divLabel = (id: string) => structure.divisions.find((d) => d.id === id)?.label ?? id;

  // ── photo upload ──────────────────────────────────────────────────────────

  async function handlePhotoFile(file: File) {
    if (!selectedId || !edit) return;
    setUploading(true);
    setPhotoNote(null);
    try {
      const path = tp(`contestants/${selectedId}/photo`);
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      setEdit((prev) => prev ? { ...prev, photoUrl: url } : prev);
    } catch {
      setPhotoNote('Photo upload failed — check the file is an image under 5 MB.');
    } finally {
      setUploading(false);
    }
  }

  // ── enrollment helpers ────────────────────────────────────────────────────

  function handleRemoveEnrollment(cat: string) {
    if (!selectedId) return;
    const enrId = enrollmentId(selectedId, cat);
    // Sessions under this enrollment are left in place: firestore.rules forbids session
    // deletion (grading history stays immutable), and they become unreachable once the
    // enrollment is gone since every reader joins sessions via enrollment.
    removeDoc(tp('enrollments/' + enrId));
  }

  function handleAddEnrollment() {
    if (!selectedId || !newCat || !newDiv) return;
    writeDoc(tp('enrollments/' + enrollmentId(selectedId, newCat)), {
      contestantId: selectedId,
      category: newCat,
      division: newDiv,
      round: 'main',
    });
    setAddingCat(false);
    setNewCat('');
    setNewDiv('');
  }

  // pick division when category changes in the add form
  function handleNewCatChange(catId: string) {
    setNewCat(catId);
    const cat = structure.categories.find((c) => c.id === catId);
    if (cat) {
      const def = defaultDivisionForCategory(cat, edit?.gender);
      setNewDiv(def ?? cat.divisions[0] ?? '');
    } else {
      setNewDiv('');
    }
  }

  // ── save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!selectedId || !edit || !selected) return;
    setSaving(true);
    try {
      await writeDoc(
        tp('contestants/' + selectedId),
        {
          fullName: edit.fullName,
          gender: edit.gender,
          photoUrl: edit.photoUrl,
          active: edit.active,
          fields: { ...selected.fields, dateOfBirth: edit.dateOfBirth },
        },
        true,
      );
    } finally {
      setSaving(false);
    }
  }

  // ── add contestant (manual, was Registrations' Quick-add) ─────────────────
  async function handleNewContestant() {
    const cid = crypto.randomUUID();
    await writeDoc(tp('contestants/' + cid), { fullName: 'New contestant', gender: null, photoUrl: null, registrationId: null, fields: {}, active: true });
    setSelectedId(cid); // opens the edit panel to fill in name + enrollments
  }

  // ── remove contestant ─────────────────────────────────────────────────────
  // window.confirm → Dialog (confirmRemoveOpen); the cascade below is unchanged.

  async function handleRemove() {
    if (!selectedId) return;
    // cascade: enrollments → contestant. Their sessions are left in place: firestore.rules
    // forbids session deletion (grading history stays immutable), and they become
    // unreachable once the enrollment is gone since every reader joins via enrollment.
    const myEnrollments = enrollments.filter((e) => e.contestantId === selectedId);
    await Promise.all([
      ...myEnrollments.map((e) => removeDoc(tp('enrollments/' + e.id))),
      removeDoc(tp('contestants/' + selectedId)),
    ]);
    setSelectedId(null);
  }

  return (
    <>
      <Heading>Contestants</Heading>

      <div className="mt-4 -mx-2 border-b border-zinc-950/10 dark:border-white/10">
        <Navbar>
          <NavbarSection>
            <NavbarItem current={tab === 'ledger'} onClick={() => setTab('ledger')}>
              Registrations
            </NavbarItem>
            <NavbarItem current={tab === 'roster'} onClick={() => setTab('roster')}>
              Contestants
            </NavbarItem>
          </NavbarSection>
        </Navbar>
      </div>

      <div className="mt-8">
        {tab === 'ledger' ? (
          <Table className="[--gutter:--spacing(6)]">
            <TableHead>
              <TableRow>
                <TableHeader>Name</TableHeader>
                <TableHeader>Category</TableHeader>
                <TableHeader>Source</TableHeader>
                <TableHeader>Created</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {ledgerRegs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Text>No registrations yet.</Text>
                  </TableCell>
                </TableRow>
              )}
              {ledgerRegs.map((reg) => {
                const resolved = resolveCategories(reg.parsedFields?.categories, structure);
                const categoryText = resolved.length === 0 ? '—' : resolved.map((r) => r.label).join(' · ');
                // Source discriminator: Zeffy-written docs always carry a non-null
                // zeffyPaymentId/zeffyItemId (see parseRegistration in
                // src/zeffy/parse-registration.ts); manual/csv docs explicitly null
                // those out (see handleCsvFile below). `source === 'zeffy'` is the
                // direct expression of that same distinction.
                const isZeffy = reg.source === 'zeffy';
                return (
                  <TableRow key={reg.id}>
                    <TableCell className="font-medium">{fullNameOf(reg)}</TableCell>
                    <TableCell className="text-zinc-500">{categoryText}</TableCell>
                    <TableCell>
                      <Badge color={isZeffy ? 'amber' : 'zinc'}>{isZeffy ? 'Zeffy' : 'Manual'}</Badge>
                    </TableCell>
                    <TableCell className="text-zinc-500">{createdAtDisplay(reg.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-3">
              <Text>
                {registrations.length} record{registrations.length === 1 ? '' : 's'} · immutable
              </Text>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleCsvFile(f); e.target.value = ''; }}
              />
              <div className="ml-auto flex gap-3">
                <Button outline onClick={() => fileInputRef.current?.click()} disabled={busy}>
                  Import CSV
                </Button>
                <Button outline onClick={() => void handleBulkPromote()} disabled={busy}>
                  Promote all ready
                </Button>
              </div>
            </div>

            <Fieldset>
              <Field>
                <Label>Zeffy event filter</Label>
                <Text>
                  Zeffy sends every form to one webhook — only submissions whose event title matches this are
                  accepted. Must equal the event&apos;s exact name in Zeffy.
                </Text>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Input
                    className="min-w-0 flex-1"
                    value={zeffyValue}
                    onChange={(e) => { setZeffyTitle(e.target.value); setZeffySaved(false); }}
                    placeholder="e.g. 2026 Ibn Katheer Quran Competition"
                  />
                  <Button onClick={() => void saveZeffy()} disabled={!zeffyDirty}>
                    {zeffySaved && !zeffyDirty ? 'Saved' : 'Save'}
                  </Button>
                </div>
              </Field>
            </Fieldset>

            <Fieldset>
              <Field>
                <Label>Zeffy webhook</Label>
                <Text>
                  Paste this URL into Zeffy&apos;s webhook settings. The token is this competition&apos;s secret —
                  rotate it if it leaks.
                </Text>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {zeffyToken ? (
                    <>
                      <code className="min-w-0 flex-1 truncate rounded-lg border border-zinc-950/10 bg-zinc-950/2.5 px-3 py-2 text-xs text-zinc-950 dark:border-white/10 dark:bg-white/5 dark:text-white">
                        {webhookUrl}
                      </code>
                      <Button onClick={() => void copyUrl()}>{copied ? 'Copied' : 'Copy URL'}</Button>
                      <Button outline onClick={rotateToken} disabled={rotating}>
                        {rotating ? 'Rotating…' : 'Rotate token'}
                      </Button>
                    </>
                  ) : zeffyCfg.loading ? (
                    <Text>Loading…</Text>
                  ) : (
                    // Only offered once the doc has resolved — otherwise a click during the load
                    // window would silently overwrite an existing token without the confirm prompt.
                    <Button onClick={rotateToken} disabled={rotating}>
                      {rotating ? 'Generating…' : 'Generate webhook token'}
                    </Button>
                  )}
                </div>
              </Field>
            </Fieldset>

            {flash && <Text className="font-medium text-green-600 dark:text-green-400">{flash}</Text>}
            {importReport && <Text className="font-medium text-green-600 dark:text-green-400">{importReport}</Text>}
            {error && <Text className="font-medium text-red-600 dark:text-red-500">{error}</Text>}

            <Table className="[--gutter:--spacing(6)]">
              <TableHead>
                <TableRow>
                  <TableHeader>Name · categories</TableHeader>
                  <TableHeader>Source</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader className="text-right">Action</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedRegs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Text>No registrations yet.</Text>
                    </TableCell>
                  </TableRow>
                )}
                {sortedRegs.map((reg) => {
                  const fullName = fullNameOf(reg);
                  const resolved = resolveCategories(reg.parsedFields?.categories, structure);
                  const promoted = isPromoted(reg.id);
                  const isTicket = reg.kind === 'ticket';
                  const drawerOpen = drawer?.regId === reg.id;

                  return (
                    <Fragment key={reg.id}>
                      <TableRow>
                        <TableCell>
                          <div className={isTicket ? 'font-medium' : 'font-medium text-zinc-500'}>{fullName}</div>
                          {resolved.length > 0 && (
                            <div className="mt-0.5 text-xs text-zinc-500">
                              {resolved.map((r, i) => (
                                <span key={i}>
                                  {i > 0 && ' · '}
                                  {r.unmapped ? (
                                    <span className="text-red-600 dark:text-red-500">{r.rawLabel} unmapped</span>
                                  ) : (
                                    catLabel(r.categoryId)
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                          {!isTicket && <div className="text-xs text-zinc-500 italic capitalize">{reg.kind}</div>}
                        </TableCell>
                        <TableCell className="text-zinc-500 capitalize">
                          {reg.source === 'zeffy' ? 'Zeffy' : reg.source === 'csv' ? 'CSV' : 'Manual'}
                        </TableCell>
                        <TableCell>
                          <Badge color={promoted ? 'lime' : 'amber'}>{promoted ? 'Promoted' : 'Pending'}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {!promoted && isTicket && (
                            <Button onClick={() => (drawerOpen ? closeDrawer() : openDrawer(reg))}>
                              {drawerOpen ? 'Cancel' : 'Promote →'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {drawerOpen && drawer && (
                        <TableRow>
                          <TableCell colSpan={4}>
                            <PromoteDrawer
                              state={drawer}
                              structure={structure}
                              onClose={closeDrawer}
                              onChange={setDrawer}
                              onSubmit={() => void handleSubmit()}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>

            {busy && <Text>Saving…</Text>}

            <div className="border-t border-zinc-950/10 pt-8 dark:border-white/10">
              <Subheading>Contestant roster</Subheading>
              <Text className="mt-1">
                Edit an existing contestant&apos;s details, photo, active status, and category enrollments.
              </Text>

              <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-start">
                {/* left: contestant list */}
                <div className="w-full shrink-0 lg:w-72">
                  <div className="flex items-center justify-between gap-3">
                    <Text>{sortedContestants.length} total</Text>
                    <Button onClick={() => void handleNewContestant()}>+ New</Button>
                  </div>
                  <div className="mt-3 divide-y divide-zinc-950/5 overflow-hidden rounded-lg border border-zinc-950/10 dark:divide-white/5 dark:border-white/10">
                    {sortedContestants.length === 0 && (
                      <div className="p-4">
                        <Text>No contestants yet.</Text>
                      </div>
                    )}
                    {sortedContestants.map((c) => {
                      const enrCount = enrCountById.get(c.id) ?? 0;
                      const isSelected = c.id === selectedId;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedId(c.id)}
                          className={
                            'flex w-full items-center gap-3 px-4 py-3 text-left ' +
                            (isSelected ? 'bg-zinc-950/5 dark:bg-white/10' : 'hover:bg-zinc-950/2.5 dark:hover:bg-white/5')
                          }
                        >
                          <Avatar
                            src={c.photoUrl}
                            initials={c.photoUrl ? undefined : initials(c.fullName || '?')}
                            className="size-9"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-zinc-950 dark:text-white">
                              {c.fullName}
                            </span>
                            <span className="block text-xs text-zinc-500">
                              {enrCount} enrollment{enrCount !== 1 ? 's' : ''}
                            </span>
                          </span>
                          <Badge color={c.active ? 'lime' : 'zinc'}>{c.active ? 'Active' : 'Inactive'}</Badge>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* right: edit panel */}
                <div className="min-w-0 flex-1">
                  {!selectedId || !edit ? (
                    <Text>Select a contestant to edit.</Text>
                  ) : (
                    <div className="rounded-lg border border-zinc-950/10 p-5 dark:border-white/10">
                      <div className="flex items-center gap-3">
                        <Subheading>{edit.fullName || 'Contestant'}</Subheading>
                        <span className="ml-auto flex items-center gap-2">
                          <Text>Active</Text>
                          <Switch
                            checked={edit.active}
                            onChange={(active) => setEdit((prev) => (prev ? { ...prev, active } : prev))}
                          />
                        </span>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-6">
                        {/* photo column */}
                        <div className="w-28 shrink-0 text-center">
                          <Avatar
                            src={edit.photoUrl}
                            initials={edit.photoUrl ? undefined : initials(edit.fullName || '?')}
                            className="size-28"
                          />
                          <Button
                            outline
                            className="mt-2 w-full"
                            onClick={() => photoInputRef.current?.click()}
                            disabled={uploading}
                          >
                            {uploading ? 'Uploading…' : 'Replace photo'}
                          </Button>
                          <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void handlePhotoFile(file);
                              e.target.value = '';
                            }}
                          />
                          {photoNote && (
                            <Text className="mt-1.5 text-xs text-red-600 dark:text-red-500">{photoNote}</Text>
                          )}
                        </div>

                        {/* fields column */}
                        <div className="min-w-[240px] flex-1">
                          <Fieldset>
                            <div className="grid gap-4 sm:grid-cols-3">
                              <Field className="sm:col-span-2">
                                <Label>Full name</Label>
                                <Input
                                  value={edit.fullName}
                                  onChange={(e) => setEdit((prev) => (prev ? { ...prev, fullName: e.target.value } : prev))}
                                />
                              </Field>
                              <Field>
                                <Label>Gender</Label>
                                <div className="mt-2 flex gap-1.5">
                                  {(['male', 'female', null] as const).map((g) => {
                                    const label = g === null ? 'None' : g === 'male' ? 'Male' : 'Female';
                                    const on = edit.gender === g;
                                    return on ? (
                                      <Button
                                        key={String(g)}
                                        onClick={() => setEdit((prev) => (prev ? { ...prev, gender: g } : prev))}
                                      >
                                        {label}
                                      </Button>
                                    ) : (
                                      <Button
                                        key={String(g)}
                                        outline
                                        onClick={() => setEdit((prev) => (prev ? { ...prev, gender: g } : prev))}
                                      >
                                        {label}
                                      </Button>
                                    );
                                  })}
                                </div>
                              </Field>
                            </div>

                            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                              <Field>
                                <Label>Date of birth</Label>
                                <Input
                                  type="date"
                                  value={edit.dateOfBirth}
                                  onChange={(e) => setEdit((prev) => (prev ? { ...prev, dateOfBirth: e.target.value } : prev))}
                                />
                              </Field>
                              {selected?.registrationId && (
                                <Field>
                                  <Label>From registration</Label>
                                  <Text className="mt-1 rounded-lg border border-zinc-950/10 bg-zinc-950/2.5 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                                    {selected.registrationId}
                                  </Text>
                                </Field>
                              )}
                            </div>

                            <Field className="mt-6">
                              <Label>Category enrollments</Label>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {myEnrollments.map((e) => (
                                  <span
                                    key={e.category}
                                    className="inline-flex items-center gap-2 rounded-md border border-zinc-950/10 bg-white px-3 py-1.5 text-sm font-medium text-zinc-950 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                  >
                                    {catLabel(e.category)} · {divLabel(e.division)}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveEnrollment(e.category)}
                                      className="text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400"
                                      title="Remove enrollment"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}

                                {!addingCat ? (
                                  <Button outline onClick={() => setAddingCat(true)}>
                                    + Add category
                                  </Button>
                                ) : (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="w-40">
                                      <Select value={newCat} onChange={(e) => handleNewCatChange(e.target.value)}>
                                        <option value="">— category —</option>
                                        {structure.categories
                                          .filter((c) => !enrolledCatIds.has(c.id))
                                          .map((c) => (
                                            <option key={c.id} value={c.id}>
                                              {c.label}
                                            </option>
                                          ))}
                                      </Select>
                                    </div>
                                    {newCat && (
                                      <div className="w-40">
                                        <Select value={newDiv} onChange={(e) => setNewDiv(e.target.value)}>
                                          <option value="">— division —</option>
                                          {(structure.categories.find((c) => c.id === newCat)?.divisions ?? []).map(
                                            (d) => (
                                              <option key={d} value={d}>
                                                {divLabel(d)}
                                              </option>
                                            ),
                                          )}
                                        </Select>
                                      </div>
                                    )}
                                    <Button onClick={handleAddEnrollment} disabled={!newCat || !newDiv}>
                                      Add
                                    </Button>
                                    <Button
                                      plain
                                      onClick={() => {
                                        setAddingCat(false);
                                        setNewCat('');
                                        setNewDiv('');
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </Field>
                          </Fieldset>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-zinc-950/10 pt-4 dark:border-white/10">
                        <Text className="text-red-600 dark:text-red-500">
                          Removing a contestant leaves the immutable master intact — re-adding is trivial.
                        </Text>
                        <Button color="red" onClick={() => setConfirmRemoveOpen(true)}>
                          Remove
                        </Button>
                        <div className="ml-auto flex items-center gap-3">
                          <Button plain onClick={() => setSelectedId(null)}>
                            Cancel
                          </Button>
                          <Button onClick={() => void handleSave()} disabled={saving}>
                            {saving ? 'Saving…' : 'Save changes'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={confirmRotateOpen} onClose={setConfirmRotateOpen}>
        <DialogTitle>Rotate the webhook token?</DialogTitle>
        <DialogDescription>The old URL stops working immediately — update it in Zeffy.</DialogDescription>
        <DialogActions>
          <Button plain onClick={() => setConfirmRotateOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setConfirmRotateOpen(false);
              void performRotate();
            }}
          >
            Rotate token
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmRemoveOpen} onClose={setConfirmRemoveOpen}>
        <DialogTitle>Remove this contestant?</DialogTitle>
        <DialogDescription>
          This also deletes their enrollments and any scores. The registrations master stays intact.
        </DialogDescription>
        <DialogActions>
          <Button plain onClick={() => setConfirmRemoveOpen(false)}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={() => {
              setConfirmRemoveOpen(false);
              void handleRemove();
            }}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
