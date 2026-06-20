import { useState, useEffect, useRef } from 'react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useCollection, useDocData, writeDoc, removeDoc } from '../data/db';
import type { ContestantDoc, EnrollmentDoc, SessionDoc } from '../data/types';
import {
  DEFAULT_STRUCTURE_CONFIG,
  defaultDivisionForCategory,
  type StructureConfig,
} from '../domain/structure';
import { enrollmentId } from '../domain/ids';
import { storage } from '../firebase/app';
import { C, serif, initials } from '../ui/theme';

// ── helpers ──────────────────────────────────────────────────────────────────

function Avatar({ url, name, size = 56 }: { url: string | null; name: string; size?: number }) {
  const radius = size < 72 ? 10 : 14;
  const fontSize = size < 72 ? Math.round(size * 0.34) : Math.round(size * 0.32);
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: 'linear-gradient(135deg,#DCEAE6,#BCD3CD)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: serif,
        fontWeight: 600,
        color: C.green,
        fontSize,
        flexShrink: 0,
      }}
    >
      {initials(name || '?')}
    </div>
  );
}

interface EditState {
  fullName: string;
  gender: 'male' | 'female' | null;
  dateOfBirth: string;
  active: boolean;
  photoUrl: string | null;
}

// ── main component ────────────────────────────────────────────────────────────

export default function Contestants() {
  const contestants = [...useCollection<ContestantDoc>('contestants')].sort((a, b) => a.fullName.localeCompare(b.fullName));
  const enrollments = useCollection<EnrollmentDoc>('enrollments');
  const sessions = useCollection<SessionDoc>('sessions');
  const structure: StructureConfig =
    useDocData<StructureConfig>('config/structure').data ?? DEFAULT_STRUCTURE_CONFIG;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [newDiv, setNewDiv] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selected = contestants.find((c) => c.id === selectedId) ?? null;

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

  const catLabel = (id: string) => structure.categories.find((c) => c.id === id)?.label ?? id;
  const divLabel = (id: string) => structure.divisions.find((d) => d.id === id)?.label ?? id;

  // ── photo upload ──────────────────────────────────────────────────────────

  async function handlePhotoFile(file: File) {
    if (!selectedId || !edit) return;
    setUploading(true);
    setPhotoNote(null);
    try {
      const path = `contestants/${selectedId}/photo`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      setEdit((prev) => prev ? { ...prev, photoUrl: url } : prev);
      setPhotoNote(null);
    } catch {
      setPhotoNote('Photo upload failed — Storage may not be configured in this environment.');
    } finally {
      setUploading(false);
    }
  }

  // ── enrollment helpers ────────────────────────────────────────────────────

  function handleRemoveEnrollment(cat: string) {
    if (!selectedId) return;
    const enrId = enrollmentId(selectedId, cat);
    // remove the enrollment AND any sessions under it, so the leaderboard doesn't retain stale scores
    sessions.filter((s) => s.enrollmentId === enrId).forEach((s) => removeDoc('sessions/' + s.id));
    removeDoc('enrollments/' + enrId);
  }

  function handleAddEnrollment() {
    if (!selectedId || !newCat || !newDiv) return;
    writeDoc('enrollments/' + enrollmentId(selectedId, newCat), {
      contestantId: selectedId,
      category: newCat,
      division: newDiv,
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
        'contestants/' + selectedId,
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
    await writeDoc('contestants/' + cid, { fullName: 'New contestant', gender: null, photoUrl: null, registrationId: null, fields: {}, active: true });
    setSelectedId(cid); // opens the edit panel to fill in name + enrollments
  }

  // ── remove contestant ─────────────────────────────────────────────────────

  async function handleRemove() {
    if (!selectedId) return;
    if (!window.confirm('Remove this contestant? This also deletes their enrollments and any scores. The registrations master stays intact.')) return;
    // cascade: sessions → enrollments → contestant, so nothing orphaned lingers on the leaderboard
    const myEnrollments = enrollments.filter((e) => e.contestantId === selectedId);
    const enrIds = new Set(myEnrollments.map((e) => e.id));
    await Promise.all([
      ...sessions.filter((s) => enrIds.has(s.enrollmentId)).map((s) => removeDoc('sessions/' + s.id)),
      ...myEnrollments.map((e) => removeDoc('enrollments/' + e.id)),
      removeDoc('contestants/' + selectedId),
    ]);
    setSelectedId(null);
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', minHeight: 400 }}>
      {/* ── left: contestant list ── */}
      <div
        style={{
          flex: '0 0 260px',
          background: C.cream,
          borderRadius: 8,
          boxShadow: '0 6px 22px rgba(20,40,36,.14)',
          overflow: 'hidden',
        }}
      >
        {/* list header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: `1px solid ${C.line}`,
            background: C.greenDeep,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontFamily: serif, fontSize: 17, fontWeight: 600, color: '#fff' }}>
              Contestants
            </div>
            <div style={{ fontSize: 12, color: '#9DBDB4', marginTop: 2 }}>
              {contestants.length} total
            </div>
          </div>
          <button
            onClick={handleNewContestant}
            style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, color: '#06211C', background: C.gold, border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}
          >
            + New
          </button>
        </div>

        {contestants.length === 0 && (
          <div style={{ padding: '28px 18px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
            No contestants yet.
          </div>
        )}

        {contestants.map((c) => {
          const enrCount = enrollments.filter((e) => e.contestantId === c.id).length;
          const isSelected = c.id === selectedId;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '12px 16px',
                background: isSelected ? C.pillGreen : 'transparent',
                border: 'none',
                borderBottom: `1px solid ${C.line}`,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Avatar url={c.photoUrl} name={c.fullName} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: isSelected ? C.greenDeep : C.ink,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {c.fullName}
                </div>
                <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>
                  {enrCount} enrollment{enrCount !== 1 ? 's' : ''}
                </div>
              </div>
              {/* active dot */}
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: c.active ? C.green : C.muted,
                  flexShrink: 0,
                }}
              />
            </button>
          );
        })}
      </div>

      {/* ── right: edit panel ── */}
      {!selectedId || !edit ? (
        <div
          style={{
            flex: 1,
            background: C.cream,
            borderRadius: 8,
            boxShadow: '0 6px 22px rgba(20,40,36,.14)',
            padding: '40px 32px',
            textAlign: 'center',
            color: C.muted,
            fontSize: 14,
          }}
        >
          Select a contestant to edit.
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            background: C.cream,
            borderRadius: 8,
            boxShadow: '0 6px 22px rgba(20,40,36,.14)',
            overflow: 'hidden',
          }}
        >
          {/* panel header */}
          <div
            style={{
              padding: '16px 24px',
              background: C.greenDeep,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, color: '#fff' }}>
              {edit.fullName || 'Contestant'}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12.5, color: '#DCEAE6' }}>Active</span>
              {/* toggle */}
              <button
                onClick={() => setEdit((prev) => prev ? { ...prev, active: !prev.active } : prev)}
                style={{
                  width: 42,
                  height: 24,
                  borderRadius: 999,
                  background: edit.active ? C.gold : '#4A5E59',
                  position: 'relative',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 3,
                    [edit.active ? 'right' : 'left']: 3,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left .15s, right .15s',
                  }}
                />
              </button>
            </div>
          </div>

          {/* body */}
          <div style={{ padding: '22px 24px', display: 'flex', gap: 24 }}>
            {/* photo column */}
            <div style={{ flexShrink: 0, width: 120, textAlign: 'center' }}>
              <Avatar url={edit.photoUrl} name={edit.fullName} size={120} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  marginTop: 10,
                  width: '100%',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: C.green,
                  border: `1.5px solid #BCD3CD`,
                  background: 'transparent',
                  padding: '7px 0',
                  borderRadius: 7,
                  cursor: uploading ? 'default' : 'pointer',
                  opacity: uploading ? 0.6 : 1,
                }}
              >
                {uploading ? 'Uploading…' : 'Replace photo'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoFile(file);
                  e.target.value = '';
                }}
              />
              {photoNote && (
                <div style={{ marginTop: 6, fontSize: 11, color: C.fail, lineHeight: 1.4 }}>
                  {photoNote}
                </div>
              )}
            </div>

            {/* fields column */}
            <div style={{ flex: 1 }}>
              {/* row 1: full name + gender */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                <div style={{ flex: 2 }}>
                  <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 5 }}>
                    Full name
                  </div>
                  <input
                    value={edit.fullName}
                    onChange={(e) => setEdit((prev) => prev ? { ...prev, fullName: e.target.value } : prev)}
                    style={{
                      width: '100%',
                      background: '#fff',
                      border: `1px solid #D8D0BE`,
                      borderRadius: 8,
                      padding: '10px 13px',
                      fontSize: 14,
                      color: C.ink,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 5 }}>
                    Gender
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['male', 'female', null] as const).map((g) => {
                      const label = g === null ? 'None' : g === 'male' ? 'Male' : 'Female';
                      const on = edit.gender === g;
                      return (
                        <button
                          key={String(g)}
                          onClick={() => setEdit((prev) => prev ? { ...prev, gender: g } : prev)}
                          style={{
                            flex: 1,
                            padding: '9px 4px',
                            borderRadius: 8,
                            border: on ? 'none' : `1px solid #D8D0BE`,
                            background: on ? C.greenDeep : '#fff',
                            color: on ? '#fff' : C.sub,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* row 2: dob */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 5 }}>
                    Date of birth
                  </div>
                  <input
                    type="date"
                    value={edit.dateOfBirth}
                    onChange={(e) => setEdit((prev) => prev ? { ...prev, dateOfBirth: e.target.value } : prev)}
                    style={{
                      width: '100%',
                      background: '#fff',
                      border: `1px solid #D8D0BE`,
                      borderRadius: 8,
                      padding: '10px 13px',
                      fontSize: 14,
                      color: C.ink,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                {selected?.registrationId && (
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 5 }}>
                      From registration
                    </div>
                    <div
                      style={{
                        background: C.parchment,
                        border: `1px solid #E0D8C6`,
                        borderRadius: 8,
                        padding: '10px 13px',
                        fontSize: 13,
                        color: C.muted,
                      }}
                    >
                      {selected.registrationId}
                    </div>
                  </div>
                )}
              </div>

              {/* enrollments */}
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 8 }}>
                Category enrollments
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                {myEnrollments.map((e) => (
                  <span
                    key={e.category}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.greenDeep,
                      background: '#fff',
                      border: `1px solid #D8D0BE`,
                      padding: '8px 12px',
                      borderRadius: 8,
                    }}
                  >
                    {catLabel(e.category)} · {divLabel(e.division)}
                    <button
                      onClick={() => handleRemoveEnrollment(e.category)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: C.fail,
                        fontSize: 16,
                        cursor: 'pointer',
                        padding: 0,
                        lineHeight: 1,
                      }}
                      title="Remove enrollment"
                    >
                      ×
                    </button>
                  </span>
                ))}

                {/* + Add category */}
                {!addingCat ? (
                  <button
                    onClick={() => setAddingCat(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.green,
                      border: `1.5px dashed #BCD3CD`,
                      background: 'transparent',
                      padding: '8px 12px',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    + Add category
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* category select */}
                    <select
                      value={newCat}
                      onChange={(e) => handleNewCatChange(e.target.value)}
                      style={{
                        border: `1px solid #D8D0BE`,
                        borderRadius: 7,
                        padding: '7px 10px',
                        fontSize: 13,
                        color: C.ink,
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="">— category —</option>
                      {structure.categories
                        .filter((c) => !enrolledCatIds.has(c.id))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                    </select>

                    {/* division select */}
                    {newCat && (
                      <select
                        value={newDiv}
                        onChange={(e) => setNewDiv(e.target.value)}
                        style={{
                          border: `1px solid #D8D0BE`,
                          borderRadius: 7,
                          padding: '7px 10px',
                          fontSize: 13,
                          color: C.ink,
                          background: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="">— division —</option>
                        {(structure.categories.find((c) => c.id === newCat)?.divisions ?? []).map(
                          (d) => (
                            <option key={d} value={d}>
                              {divLabel(d)}
                            </option>
                          ),
                        )}
                      </select>
                    )}

                    <button
                      onClick={handleAddEnrollment}
                      disabled={!newCat || !newDiv}
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#fff',
                        background: !newCat || !newDiv ? C.muted : C.green,
                        border: 'none',
                        borderRadius: 7,
                        padding: '7px 14px',
                        cursor: !newCat || !newDiv ? 'default' : 'pointer',
                      }}
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setAddingCat(false);
                        setNewCat('');
                        setNewDiv('');
                      }}
                      style={{
                        fontSize: 13,
                        color: C.sub,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '7px 4px',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* footer */}
          <div
            style={{
              padding: '14px 24px',
              borderTop: `1px solid ${C.line}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 12.5, color: C.fail }}>
              Removing a contestant leaves the immutable master intact — re-adding is trivial.
            </span>
            <button
              onClick={handleRemove}
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: C.fail,
                background: C.failBg,
                border: `1px solid ${C.failLine}`,
                borderRadius: 7,
                padding: '8px 14px',
                cursor: 'pointer',
                marginLeft: 8,
              }}
            >
              Remove
            </button>
            <button
              onClick={() => setSelectedId(null)}
              style={{
                marginLeft: 'auto',
                fontSize: 13.5,
                fontWeight: 600,
                color: C.sub,
                background: 'none',
                border: 'none',
                padding: '10px 16px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: '#fff',
                background: saving ? C.muted : C.green,
                border: 'none',
                borderRadius: 8,
                padding: '10px 22px',
                cursor: saving ? 'default' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
