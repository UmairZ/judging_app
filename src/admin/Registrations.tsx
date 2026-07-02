import { useMemo, useRef, useState } from 'react';
import { useCollection, useDocData, writeDoc, removeDoc, now } from '../data/db';
import { useTenant } from '../tenant/TenantContext';
import type { RegistrationDoc, ContestantDoc } from '../data/types';
import { DEFAULT_STRUCTURE_CONFIG, defaultDivisionForCategory, type StructureConfig, type Category } from '../domain/structure';
import { enrollmentId } from '../domain/ids';
import { generateWebhookToken } from '../onboarding/logic';
import { parseCsv, rowsToPeople, csvRegistrationId } from '../intake/csv';
import {
  resolveCategories,
  buildDefaultDivisions,
  buildPromotion,
  type ResolvedCategory,
  type CategoryDivisionPair,
} from '../intake/promotion';
import { C, serif } from '../ui/theme';

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
    <div
      style={{
        margin: '4px 14px 16px',
        background: C.parchment,
        border: `1px solid #E0D8C6`,
        borderRadius: 11,
        padding: '18px 20px',
      }}
    >
      {/* drawer header */}
      <div
        style={{
          fontSize: 12,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          color: C.brassDark,
          fontWeight: 700,
          marginBottom: 14,
        }}
      >
        {drawerLabel}
      </div>

      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        {/* photo placeholder */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 11,
            background: '#fff',
            border: '1px dashed #C5BCA8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: '#A89C82',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          + photo
        </div>

        {/* fields */}
        <div style={{ flex: 1 }}>
          {/* full name */}
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
            Full name <span style={{ color: C.fail }}>required</span>
          </div>
          <input
            value={fullName}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            style={{
              width: '100%',
              background: '#fff',
              border: `1px solid #D8D0BE`,
              borderRadius: 7,
              padding: '9px 12px',
              fontSize: 14,
              color: C.ink,
              marginBottom: 12,
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />

          {/* gender row */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Gender</div>
            <div style={{ display: 'flex', gap: 7 }}>
              {(['male', 'female'] as const).map((g) => {
                const active = gender === g;
                return (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      padding: '5px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      border: active ? 'none' : `1.5px solid #D8D0BE`,
                      background: active ? C.green : 'transparent',
                      color: active ? '#fff' : C.sub,
                    }}
                  >
                    {g === 'male' ? 'Male' : 'Female'} {active ? '✓' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          {/* categories + divisions */}
          {resolved.length === 0 && (
            <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', marginBottom: 8 }}>
              No categories — add via Quick-add or registration had none.
            </div>
          )}

          {resolved.map((r, idx) => {
            const cat: Category | undefined = structure.categories.find((c) => c.id === r.categoryId);
            const chosenDiv = r.categoryId ? (divisions[r.categoryId] ?? '') : '';

            return (
              <div key={idx} style={{ display: 'flex', gap: 18, marginBottom: 12 }}>
                {/* category chip / picker */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Category</div>
                  {r.unmapped ? (
                    <select
                      value={r.categoryId}
                      onChange={(e) => setUnmappedCategory(idx, e.target.value)}
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: `1.5px solid ${C.fail}`,
                        background: C.failBg,
                        color: C.fail,
                        cursor: 'pointer',
                      }}
                    >
                      <option value="">— unmapped: {r.rawLabel}</option>
                      {structure.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: 7 }}>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: '#fff',
                          background: C.green,
                          padding: '6px 12px',
                          borderRadius: 6,
                        }}
                      >
                        {r.label} ✓
                      </span>
                    </div>
                  )}
                </div>

                {/* division chips */}
                {cat && (
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>
                      Division{' '}
                      <span style={{ fontSize: 11, color: C.brassDark }}>auto from gender</span>
                    </div>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      {cat.divisions.map((divId) => {
                        const active = chosenDiv === divId;
                        return (
                          <button
                            key={divId}
                            onClick={() => setDivision(r.categoryId, divId)}
                            style={{
                              fontSize: 12.5,
                              fontWeight: 600,
                              padding: '5px 11px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              border: active ? `1.5px solid ${C.green}` : `1.5px solid #D8D0BE`,
                              background: 'transparent',
                              color: active ? C.green : C.sub,
                            }}
                          >
                            {divLabel(divId)} {active ? '✓' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* add category (for quick-add / manual) */}
          {state.regId == null && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Add category</div>
              <select
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
                style={{
                  fontSize: 12.5,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: `1px solid #D8D0BE`,
                  background: '#fff',
                  color: C.sub,
                  cursor: 'pointer',
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
              </select>
            </div>
          )}
        </div>
      </div>

      {/* actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{
            fontSize: 13.5,
            color: C.sub,
            padding: '9px 16px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: '#fff',
            background: canSubmit ? C.green : C.muted,
            borderRadius: 7,
            padding: '9px 20px',
            border: 'none',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          Create contestant &amp; enrollment
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function Registrations() {
  const { orgId, compId, tp } = useTenant();
  const registrations = useCollection<RegistrationDoc>(tp('registrations'));
  const contestants = useCollection<ContestantDoc>(tp('contestants'));
  const structure = useDocData<StructureConfig>(tp('config/structure')).data ?? DEFAULT_STRUCTURE_CONFIG;

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

  const rotateToken = async () => {
    if (zeffyToken && !window.confirm('Rotate the webhook token? The old URL stops working immediately — update it in Zeffy.')) return;
    await writeDoc(tp('config/zeffy'), { token: generateWebhookToken() });
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
      if (failed.length) parts.push(`${failed.length} FAILED (${failed.join('; ')})`);
      if (errors.length) parts.push(`${errors.length} row${errors.length === 1 ? '' : 's'} skipped (${errors.map((e) => `line ${e.line}: ${e.message}`).join('; ')})`);
      setImportReport(parts.join(' · '));
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
        break;
      }
    }
    setBusy(false);
    setFlash(`Promoted ${promoted} · ${skipped} need review (open each to resolve)`);
    setTimeout(() => setFlash(null), 6000);
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

  return (
    <div
      style={{
        background: C.cream,
        borderRadius: 8,
        boxShadow: '0 6px 22px rgba(20,40,36,.14)',
        overflow: 'hidden',
      }}
    >
      {/* header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px 22px',
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <span style={{ fontFamily: serif, fontSize: 17, fontWeight: 600, color: C.greenDeep }}>
          Registrations
        </span>
        <span style={{ fontSize: 12, color: C.muted, marginLeft: 10 }}>
          immutable · {registrations.length} records
        </span>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleCsvFile(f); e.target.value = ''; }} />
        <button onClick={() => fileInputRef.current?.click()} disabled={busy}
          style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, color: '#fff', background: C.green, border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}>
          Import CSV
        </button>
        <button onClick={() => void handleBulkPromote()} disabled={busy}
          style={{ fontSize: 12.5, fontWeight: 600, color: C.green, background: 'transparent', border: `1px solid ${C.green}`, borderRadius: 6, padding: '7px 14px', cursor: 'pointer' }}>
          Promote all ready
        </button>
        <span style={{ fontSize: 12, color: C.muted }}>To add someone manually, use <strong style={{ color: C.sub }}>Contestants → + New</strong>.</span>
      </div>

      {/* Zeffy event-title filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 22px', borderBottom: `1px solid ${C.line}`, background: C.parchment, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 200, flex: '1 1 240px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: C.greenDeep }}>Zeffy event filter</div>
          <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.45 }}>
            Zeffy sends every form to one webhook — only submissions whose event title matches this are accepted. Must equal the event's <strong style={{ color: C.sub }}>exact</strong> name in Zeffy.
          </div>
        </div>
        <input
          value={zeffyValue}
          onChange={(e) => { setZeffyTitle(e.target.value); setZeffySaved(false); }}
          placeholder="e.g. 2026 Ibn Katheer Quran Competition"
          style={{ flex: '2 1 280px', minWidth: 220, fontSize: 13.5, padding: '9px 12px', border: `1px solid ${C.cardLine}`, borderRadius: 7, outline: 'none', background: '#fff' }}
        />
        <button
          onClick={saveZeffy}
          disabled={!zeffyDirty}
          style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: '#fff', background: zeffyDirty ? C.green : (zeffySaved ? C.green : C.muted), border: 'none', borderRadius: 6, padding: '9px 18px', cursor: zeffyDirty ? 'pointer' : 'default' }}
        >
          {zeffySaved && !zeffyDirty ? '✓ Saved' : 'Save'}
        </button>
      </div>

      {/* Zeffy webhook URL + token management */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 22px', borderBottom: `1px solid ${C.line}`, background: C.parchment, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 200, flex: '1 1 240px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: C.greenDeep }}>Zeffy webhook</div>
          <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.45 }}>
            Paste this URL into Zeffy's webhook settings. The token is this competition's secret — rotate it if it leaks.
          </div>
        </div>
        {zeffyToken ? (
          <>
            <code style={{ flex: '2 1 280px', minWidth: 220, fontSize: 12, padding: '9px 12px', border: `1px solid ${C.cardLine}`, borderRadius: 7, background: '#fff', color: C.ink, overflowX: 'auto', whiteSpace: 'nowrap' }}>
              {webhookUrl}
            </code>
            <button onClick={() => void copyUrl()} style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: '#fff', background: C.green, border: 'none', borderRadius: 6, padding: '9px 14px', cursor: 'pointer' }}>
              {copied ? '✓ Copied' : 'Copy URL'}
            </button>
            <button onClick={() => void rotateToken()} style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: C.brassDark, background: 'transparent', border: `1px solid ${C.brassDark}`, borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}>
              Rotate token
            </button>
          </>
        ) : zeffyCfg.loading ? (
          <span style={{ fontSize: 12.5, color: C.muted }}>Loading…</span>
        ) : (
          // Only offered once the doc has resolved — otherwise a click during the load
          // window would silently overwrite an existing token without the confirm prompt.
          <button onClick={() => void rotateToken()} style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: '#fff', background: C.green, border: 'none', borderRadius: 6, padding: '9px 18px', cursor: 'pointer' }}>
            Generate webhook token
          </button>
        )}
      </div>

      {flash && (
        <div style={{ padding: '10px 22px', fontSize: 13, fontWeight: 600, color: C.green, background: C.pillGreen, borderBottom: `1px solid ${C.line}` }}>
          {flash}
        </div>
      )}

      {importReport && (
        <div style={{ padding: '10px 22px', fontSize: 13, fontWeight: 600, color: C.green, background: C.pillGreen, borderBottom: `1px solid ${C.line}` }}>
          {importReport}
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 22px', fontSize: 13, fontWeight: 600, color: C.fail, background: C.failBg, borderBottom: `1px solid ${C.line}` }}>
          {error}
        </div>
      )}

      {/* table header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 150px 110px 130px',
          padding: '10px 22px',
          fontSize: 11,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: '#9A938A',
          fontWeight: 600,
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <span>Name · categories</span>
        <span>Source</span>
        <span style={{ textAlign: 'center' }}>Status</span>
        <span />
      </div>

      {registrations.length === 0 && (
        <div style={{ padding: '36px 22px', textAlign: 'center', color: C.muted, fontSize: 14 }}>
          No registrations yet.
        </div>
      )}

      {sortedRegs.map((reg) => {
        const parsedFields = reg.parsedFields ?? {};
        const fullName =
          typeof parsedFields.fullName === 'string' ? parsedFields.fullName : '(no name)';
        const rawCategories = parsedFields.categories;
        const resolved = resolveCategories(rawCategories, structure);
        const promoted = isPromoted(reg.id);
        const isTicket = reg.kind === 'ticket';
        const drawerOpen = drawer?.regId === reg.id;

        // Categories display string
        const catDisplay =
          resolved.length === 0
            ? null
            : resolved
                .map((r) =>
                  r.unmapped ? (
                    <span key={r.rawLabel} style={{ color: C.fail }}>
                      {r.rawLabel} <strong>unmapped</strong>
                    </span>
                  ) : (
                    <span key={r.categoryId}>{catLabel(r.categoryId)}</span>
                  ),
                )
                .reduce<React.ReactNode[]>((acc, el, i) => (i === 0 ? [el] : [...acc, ' · ', el]), []);

        return (
          <div key={reg.id}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 150px 110px 130px',
                alignItems: 'center',
                padding: '13px 22px',
                borderBottom: `1px solid #F0EBDD`,
                background: drawerOpen ? '#FCF7E9' : 'transparent',
              }}
            >
              {/* name + categories */}
              <div>
                <div
                  style={{
                    fontSize: 14.5,
                    fontWeight: 600,
                    color: isTicket ? C.ink : C.muted,
                  }}
                >
                  {fullName}
                </div>
                {catDisplay && (
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{catDisplay}</div>
                )}
                {!isTicket && (
                  <div
                    style={{
                      fontSize: 11,
                      color: C.muted,
                      fontStyle: 'italic',
                      textTransform: 'capitalize',
                    }}
                  >
                    {reg.kind}
                  </div>
                )}
              </div>

              {/* source */}
              <span
                style={{
                  fontSize: 12,
                  color: reg.source === 'zeffy' ? C.green : C.muted,
                  fontWeight: 600,
                  textTransform: 'capitalize',
                }}
              >
                {reg.source === 'zeffy' ? 'Zeffy' : reg.source === 'csv' ? 'CSV' : 'Manual'}
              </span>

              {/* status badge */}
              <span style={{ textAlign: 'center' }}>
                {promoted ? (
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: C.green,
                      background: C.pillGreen,
                      padding: '4px 9px',
                      borderRadius: 999,
                    }}
                  >
                    Promoted
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: C.brassDark,
                      background: C.pill,
                      padding: '4px 9px',
                      borderRadius: 999,
                    }}
                  >
                    Pending
                  </span>
                )}
              </span>

              {/* action */}
              <span style={{ textAlign: 'right' }}>
                {!promoted && isTicket && (
                  <button
                    onClick={() => (drawerOpen ? closeDrawer() : openDrawer(reg))}
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: '#fff',
                      background: C.brass,
                      borderRadius: 6,
                      padding: '7px 14px',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {drawerOpen ? 'Cancel' : 'Promote →'}
                  </button>
                )}
              </span>
            </div>

            {/* inline drawer for this registration */}
            {drawerOpen && drawer && drawer.regId === reg.id && (
              <PromoteDrawer
                state={drawer}
                structure={structure}
                onClose={closeDrawer}
                onChange={setDrawer}
                onSubmit={handleSubmit}
              />
            )}
          </div>
        );
      })}

      {/* busy / error overlay */}
      {busy && (
        <div
          style={{
            padding: '16px 22px',
            fontSize: 13.5,
            color: C.green,
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          Saving…
        </div>
      )}
    </div>
  );
}
