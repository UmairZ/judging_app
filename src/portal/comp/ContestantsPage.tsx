import { Fragment, useMemo, useRef, useState } from 'react';
import { useCollection, useDocData, writeDoc, removeDoc, now } from '../../data/db';
import { useTenant } from '../../tenant/TenantContext';
import type { RegistrationDoc, ContestantDoc } from '../../data/types';
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
import { Badge } from '../vendor/badge';
import { Button } from '../vendor/button';
import { Dialog, DialogActions, DialogDescription, DialogTitle } from '../vendor/dialog';
import { Field, Fieldset, Label } from '../vendor/fieldset';
import { Heading, Subheading } from '../vendor/heading';
import { Input } from '../vendor/input';
import { Navbar, NavbarItem, NavbarSection } from '../vendor/navbar';
import { Select } from '../vendor/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../vendor/table';
import { Text } from '../vendor/text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DrawerState {
  regId: string | null; // null = Quick-add (manual)
  fullName: string;
  gender: 'male' | 'female' | null;
  resolved: ResolvedCategory[];
  // per-category chosen division
  divisions: Record<string, string>;
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

  const drawerLabel = state.regId == null ? 'Quick-add contestant' : `Promote — ${fullName || 'New Contestant'}`;

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

        {state.regId == null && (
          <Field className="mt-6">
            <Label>Add category</Label>
            <Select
              value=""
              onChange={(e) => {
                const newCatId = e.target.value;
                if (!newCatId) return;
                const newCat = structure.categories.find((c) => c.id === newCatId);
                if (!newCat) return;
                const d = defaultDivisionForCategory(newCat, gender);
                const newDiv = d ?? (newCat.divisions[0] ?? '');
                const newResolved: ResolvedCategory[] = [
                  ...resolved,
                  { categoryId: newCatId, label: newCat.label, rawLabel: newCat.label, unmapped: false },
                ];
                onChange({
                  ...state,
                  resolved: newResolved,
                  divisions: { ...divisions, [newCatId]: newDiv },
                });
              }}
            >
              <option value="">+ Add category…</option>
              {structure.categories
                .filter((c) => !resolved.some((r) => r.categoryId === c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
            </Select>
          </Field>
        )}
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

      // Determine source: if regId is set look up the registration
      const reg = regId ? registrations.find((r) => r.id === regId) : null;

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
        registrationId: regId ?? null,
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
      setFlash(regId ? `Promoted ${name} → see Contestants ✓` : `Created ${name} → see Contestants ✓`);
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
    </>
  );
}
