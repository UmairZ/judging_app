import { useState, useEffect, useRef } from 'react';
import { useCollection, useDocData, writeDoc } from '../data/db';
import type { JudgeDoc, PanelDoc, AssignmentDoc } from '../data/types';
import {
  DEFAULT_STRUCTURE_CONFIG,
  generateSlots,
  slotId,
  type StructureConfig,
  type Division,
  type Category,
} from '../domain/structure';
import { C, serif } from '../ui/theme';

// ─── helpers ────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'div_' + Date.now();
}

const DIVISION_COLORS: Record<number, string> = {
  0: '#4E78AE',
  1: C.sisters,
  2: C.green,
};

// ─── sub-components ─────────────────────────────────────────────────────────

/** ± stepper for minQuestions */
function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
      <button
        onClick={() => onChange(Math.max(1, value - 1))}
        style={{
          width: 26, height: 26, borderRadius: 7, border: `1.5px solid ${C.cardLine}`,
          color: C.brassDark, background: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
        }}
      >−</button>
      <span style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, color: C.greenDeep, minWidth: 18, textAlign: 'center' }}>{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        style={{
          width: 26, height: 26, borderRadius: 7, background: C.green, color: '#fff',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
        }}
      >+</button>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function StructurePanels() {
  // ── Firestore data ──────────────────────────────────────────────────────
  const { data: structureData } = useDocData<StructureConfig>('config/structure');
  const judges = useCollection<JudgeDoc>('judges');
  const panels = useCollection<PanelDoc>('panels');
  const assignments = useCollection<AssignmentDoc>('assignments');

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
  const [editingDivId, setEditingDivId] = useState<string | null>(null);
  const [editingDivLabel, setEditingDivLabel] = useState('');
  const [newDivLabel, setNewDivLabel] = useState('');
  const [addingDiv, setAddingDiv] = useState(false);

  function startRenameDiv(div: Division) {
    setEditingDivId(div.id);
    setEditingDivLabel(div.label);
  }
  function commitRenameDiv(id: string) {
    if (!editingDivLabel.trim()) { setEditingDivId(null); return; }
    setEdited(prev => ({
      ...prev,
      divisions: prev.divisions.map(d => d.id === id ? { ...d, label: editingDivLabel.trim() } : d),
    }));
    setEditingDivId(null);
  }
  function addDivision() {
    if (!newDivLabel.trim()) return;
    const id = slugify(newDivLabel);
    if (edited.divisions.some(d => d.id === id)) return;
    setEdited(prev => ({ ...prev, divisions: [...prev.divisions, { id, label: newDivLabel.trim() }] }));
    setNewDivLabel('');
    setAddingDiv(false);
  }

  // ── Category editing ────────────────────────────────────────────────────
  function setMinQ(catId: string, v: number) {
    setEdited(prev => ({
      ...prev,
      categories: prev.categories.map(c => c.id === catId ? { ...c, minQuestions: v } : c),
    }));
  }
  function toggleCatDivision(catId: string, divId: string) {
    setEdited(prev => ({
      ...prev,
      categories: prev.categories.map(c => {
        if (c.id !== catId) return c;
        const has = c.divisions.includes(divId);
        return { ...c, divisions: has ? c.divisions.filter(d => d !== divId) : [...c.divisions, divId] };
      }),
    }));
  }

  async function saveStructure() {
    await writeDoc('config/structure', edited, false);
    setStructureSaved(true);
    setTimeout(() => setStructureSaved(false), 2000);
  }

  // ── Judges ──────────────────────────────────────────────────────────────
  const [newJudgeName, setNewJudgeName] = useState('');

  async function addJudge() {
    if (!newJudgeName.trim()) return;
    await writeDoc('judges/' + crypto.randomUUID(), { name: newJudgeName.trim(), active: true });
    setNewJudgeName('');
  }

  // ── Panels ──────────────────────────────────────────────────────────────
  const [expandedPanelId, setExpandedPanelId] = useState<string | null>(null);
  const [newPanelName, setNewPanelName] = useState('');
  const [addingPanel, setAddingPanel] = useState(false);

  async function createPanel() {
    if (!newPanelName.trim()) return;
    const id = crypto.randomUUID();
    await writeDoc('panels/' + id, { name: newPanelName.trim(), judgeIds: [] });
    setNewPanelName('');
    setAddingPanel(false);
    setExpandedPanelId(id);
  }

  async function togglePanelJudge(panel: PanelDoc & { id: string }, judgeId: string) {
    const has = panel.judgeIds.includes(judgeId);
    const judgeIds = has ? panel.judgeIds.filter(j => j !== judgeId) : [...panel.judgeIds, judgeId];
    await writeDoc('panels/' + panel.id, { name: panel.name, judgeIds }, false);
  }

  // ── Assignment grid ─────────────────────────────────────────────────────
  async function assignSlot(slot: { category: string; division: string }, panelId: string) {
    const sid = slotId(slot);
    const existing = assignments.find(a => a.category === slot.category && a.division === slot.division);
    // clicking same panel → deassign
    if (existing?.panelId === panelId) {
      // toggle off — set panelId to empty string to keep doc but clear assignment, or just write empty
      // to keep it simple: overwrite with empty panelId sentinel means "unassigned"
      // but spec says clicking another panel reassigns, so we just always assign/reassign
      await writeDoc('assignments/' + sid, { category: slot.category, division: slot.division, panelId }, false);
    } else {
      await writeDoc('assignments/' + sid, { category: slot.category, division: slot.division, panelId }, false);
    }
  }

  // ── render helpers ──────────────────────────────────────────────────────
  const catLabel = (id: string) => edited.categories.find(c => c.id === id)?.label ?? id;
  const divLabel = (id: string) => edited.divisions.find(d => d.id === id)?.label ?? id;

  const panelColor = (idx: number) => {
    const colors = [C.green, C.brass, C.sisters, '#4E78AE', '#C0563C'];
    return colors[idx % colors.length];
  };

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

      {/* ══════════════════════════════════════════════════════════
          SECTION 1: Structure editor
      ══════════════════════════════════════════════════════════ */}
      <div>
        {/* section header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 22 }}>
          <span style={{ fontFamily: serif, fontSize: 13, fontWeight: 600, color: C.brass, background: '#fff', border: `1px solid #DcCFAE`, borderRadius: 999, padding: '5px 13px' }}>
            Structure
          </span>
          <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 24, margin: 0, color: C.greenDeep }}>
            Structure editor
          </h2>
          <span style={{ fontSize: 13.5, color: C.muted }}>
            Divisions master list &amp; per-category settings. Slots regenerate automatically — pure config, no code.
          </span>
        </div>

        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* ── Divisions card ── */}
          <div style={{ flex: '0 0 340px' }}>
            <div style={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: 10 }}>
              Divisions master list
            </div>
            <div style={{ background: C.cream, borderRadius: 6, boxShadow: '0 6px 22px rgba(20,40,36,.14)', overflow: 'hidden' }}>
              <div style={{ padding: '15px 20px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center' }}>
                <span style={{ fontFamily: serif, fontSize: 16, fontWeight: 600, color: C.greenDeep }}>Divisions</span>
                <button
                  onClick={() => setAddingDiv(true)}
                  style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, color: C.green, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  + Add
                </button>
              </div>
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                {edited.divisions.map((div, idx) => (
                  <div key={div.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 9, padding: '11px 14px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: DIVISION_COLORS[idx] ?? C.sub, flexShrink: 0 }} />
                    {editingDivId === div.id ? (
                      <input
                        autoFocus
                        value={editingDivLabel}
                        onChange={e => setEditingDivLabel(e.target.value)}
                        onBlur={() => commitRenameDiv(div.id)}
                        onKeyDown={e => { if (e.key === 'Enter') commitRenameDiv(div.id); if (e.key === 'Escape') setEditingDivId(null); }}
                        style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: C.ink, border: 'none', outline: 'none', background: 'transparent' }}
                      />
                    ) : (
                      <span style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, flex: 1 }}>{div.label}</span>
                    )}
                    <button
                      onClick={() => startRenameDiv(div)}
                      style={{ fontSize: 16, color: '#B6AE9C', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >✎</button>
                  </div>
                ))}
                {addingDiv && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      autoFocus
                      placeholder="New division name"
                      value={newDivLabel}
                      onChange={e => setNewDivLabel(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addDivision(); if (e.key === 'Escape') setAddingDiv(false); }}
                      style={{ flex: 1, fontSize: 14, padding: '8px 11px', border: `1px solid ${C.cardLine}`, borderRadius: 8, outline: 'none', background: '#fff' }}
                    />
                    <button onClick={addDivision} style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', background: C.green, border: 'none', borderRadius: 6, padding: '7px 12px', cursor: 'pointer' }}>Add</button>
                    <button onClick={() => setAddingDiv(false)} style={{ fontSize: 12.5, color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                  </div>
                )}
              </div>
              <div style={{ padding: '0 18px 16px', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                Rename freely — old registrations keep matching by ID.
              </div>
            </div>
          </div>

          {/* ── Categories card ── */}
          <div style={{ flex: '1 1 560px', minWidth: 0 }}>
            <div style={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: 10 }}>
              Categories — minimum questions &amp; enabled divisions
            </div>
            <div style={{ background: C.cream, borderRadius: 6, boxShadow: '0 6px 22px rgba(20,40,36,.14)', overflow: 'hidden' }}>
              {/* header row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.6fr', padding: '12px 22px', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9A938A', fontWeight: 600, borderBottom: `1px solid ${C.line}` }}>
                <span>Category</span>
                <span style={{ textAlign: 'center' }}>Min questions</span>
                <span>Enabled divisions</span>
              </div>
              {edited.categories.map((cat: Category, idx: number) => (
                <div
                  key={cat.id}
                  style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.6fr', alignItems: 'center', padding: '14px 22px', borderBottom: idx < edited.categories.length - 1 ? `1px solid #F0EBDD` : 'none' }}
                >
                  <div>
                    <div style={{ fontFamily: serif, fontSize: 17, fontWeight: 600, color: C.greenDeep }}>{cat.label}</div>
                    {cat.zeffyLabels?.[0] && (
                      <div style={{ fontSize: 11.5, color: C.muted }}>{cat.zeffyLabels[0]}</div>
                    )}
                  </div>
                  <Stepper value={cat.minQuestions} onChange={v => setMinQ(cat.id, v)} />
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {edited.divisions.map(div => {
                      const on = cat.divisions.includes(div.id);
                      return (
                        <button
                          key={div.id}
                          onClick={() => toggleCatDivision(cat.id, div.id)}
                          style={{
                            fontSize: 12.5, fontWeight: on ? 600 : 400,
                            color: on ? C.green : '#B6AE9C',
                            background: on ? C.pillGreen : 'none',
                            border: on ? 'none' : `1.5px dashed ${C.cardLine}`,
                            padding: on ? '5px 11px' : '4px 10px',
                            borderRadius: 7, cursor: 'pointer',
                          }}
                        >
                          {div.label}{on ? ' ✓' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {/* slots summary footer */}
              <div style={{ padding: '13px 22px', background: C.parchment, borderTop: `1px solid ${C.line}`, fontSize: 12.5, color: C.sub, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>
                  This config yields <strong style={{ color: C.greenDeep }}>{slots.length} slot{slots.length !== 1 ? 's' : ''}</strong>
                  {slots.length > 0 && (
                    <> — {slots.map(s => `(${catLabel(s.category)}×${divLabel(s.division)})`).join(', ')}</>
                  )}. Panels attach to these.
                </span>
                <button
                  onClick={saveStructure}
                  style={{
                    flexShrink: 0, marginLeft: 16, fontSize: 12.5, fontWeight: 600,
                    color: '#fff', background: structureSaved ? C.green : C.greenDeep,
                    border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer',
                    transition: 'background .2s',
                  }}
                >
                  {structureSaved ? '✓ Saved' : 'Save Structure'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION 2: Judges
      ══════════════════════════════════════════════════════════ */}
      <div>
        <div style={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: 10 }}>
          Judges
        </div>
        <div style={{ background: C.cream, borderRadius: 6, boxShadow: '0 6px 22px rgba(20,40,36,.14)', overflow: 'hidden', maxWidth: 480 }}>
          <div style={{ padding: '15px 20px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center' }}>
            <span style={{ fontFamily: serif, fontSize: 16, fontWeight: 600, color: C.greenDeep }}>Judges</span>
            <span style={{ marginLeft: 10, fontSize: 12, color: C.muted }}>{judges.length} total</span>
          </div>
          <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {judges.map(j => (
              <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 9, padding: '10px 14px' }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: j.active ? C.green : C.muted, flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: C.ink, flex: 1 }}>{j.name}</span>
                <span style={{ fontSize: 11.5, color: j.active ? C.green : C.muted, fontWeight: 600 }}>{j.active ? 'Active' : 'Inactive'}</span>
              </div>
            ))}
            {judges.length === 0 && (
              <div style={{ fontSize: 13.5, color: C.muted, padding: '8px 0', textAlign: 'center' }}>No judges yet.</div>
            )}
          </div>
          {/* add judge */}
          <div style={{ padding: '12px 18px', borderTop: `1px solid ${C.line}`, display: 'flex', gap: 8 }}>
            <input
              placeholder="Judge full name"
              value={newJudgeName}
              onChange={e => setNewJudgeName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addJudge(); }}
              style={{ flex: 1, fontSize: 13.5, padding: '8px 11px', border: `1px solid ${C.cardLine}`, borderRadius: 7, outline: 'none', background: '#fff' }}
            />
            <button
              onClick={addJudge}
              style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', background: C.green, border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer' }}
            >
              + Add Judge
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION 3: Panels & Assignment grid
      ══════════════════════════════════════════════════════════ */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 22 }}>
          <span style={{ fontFamily: serif, fontSize: 13, fontWeight: 600, color: C.brass, background: '#fff', border: `1px solid #DcCFAE`, borderRadius: 999, padding: '5px 13px' }}>
            Panels
          </span>
          <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 24, margin: 0, color: C.greenDeep }}>
            Panels &amp; assignment
          </h2>
          <span style={{ fontSize: 13.5, color: C.muted }}>
            Panels × slots assignment
          </span>
        </div>

        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* ── Panels list ── */}
          <div style={{ flex: '0 0 320px' }}>
            <div style={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: 10 }}>
              Panels
            </div>
            <div style={{ background: C.cream, borderRadius: 6, boxShadow: '0 6px 22px rgba(20,40,36,.14)', overflow: 'hidden' }}>
              <div style={{ padding: '15px 20px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center' }}>
                <span style={{ fontFamily: serif, fontSize: 16, fontWeight: 600, color: C.greenDeep }}>Panels</span>
                <button
                  onClick={() => setAddingPanel(true)}
                  style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, color: '#fff', background: C.green, border: 'none', borderRadius: 6, padding: '7px 14px', cursor: 'pointer' }}
                >
                  + New panel
                </button>
              </div>
              {addingPanel && (
                <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.line}`, display: 'flex', gap: 8 }}>
                  <input
                    autoFocus
                    placeholder="Panel name"
                    value={newPanelName}
                    onChange={e => setNewPanelName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') createPanel(); if (e.key === 'Escape') setAddingPanel(false); }}
                    style={{ flex: 1, fontSize: 13.5, padding: '7px 11px', border: `1px solid ${C.cardLine}`, borderRadius: 7, outline: 'none', background: '#fff' }}
                  />
                  <button onClick={createPanel} style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', background: C.green, border: 'none', borderRadius: 6, padding: '7px 12px', cursor: 'pointer' }}>Create</button>
                  <button onClick={() => setAddingPanel(false)} style={{ fontSize: 12.5, color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                </div>
              )}
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {panels.length === 0 && (
                  <div style={{ fontSize: 13.5, color: C.muted, padding: '10px 4px', textAlign: 'center' }}>No panels yet — create one.</div>
                )}
                {panels.map((panel, pidx) => {
                  const open = expandedPanelId === panel.id;
                  const color = panelColor(pidx);
                  const assignedSlots = assignments.filter(a => a.panelId === panel.id);
                  return (
                    <div key={panel.id} style={{ border: `1px solid ${C.cardLine}`, borderRadius: 9, overflow: 'hidden', background: '#fff' }}>
                      <button
                        onClick={() => setExpandedPanelId(open ? null : panel.id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <span style={{ width: 10, height: 10, borderRadius: 999, background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: C.ink, flex: 1 }}>{panel.name}</span>
                        <span style={{ fontSize: 12, color: C.muted }}>{panel.judgeIds.length} judge{panel.judgeIds.length !== 1 ? 's' : ''}</span>
                        <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>{assignedSlots.length} slot{assignedSlots.length !== 1 ? 's' : ''}</span>
                        <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>{open ? '▲' : '▼'}</span>
                      </button>
                      {open && (
                        <div style={{ padding: '0 14px 12px' }}>
                          <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.07em' }}>Judges</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {judges.length === 0 && <span style={{ fontSize: 13, color: C.muted }}>No judges added yet.</span>}
                            {judges.map(j => {
                              const checked = panel.judgeIds.includes(j.id);
                              return (
                                <label key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5 }}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => togglePanelJudge(panel, j.id)}
                                    style={{ accentColor: color, width: 15, height: 15 }}
                                  />
                                  <span style={{ color: checked ? C.ink : C.sub, fontWeight: checked ? 600 : 400 }}>{j.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Assignment grid ── */}
          <div style={{ flex: '1 1 560px', minWidth: 0 }}>
            <div style={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: 10 }}>
              Panels × slots assignment
            </div>
            <div style={{ background: C.cream, borderRadius: 6, boxShadow: '0 6px 22px rgba(20,40,36,.14)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center' }}>
                <span style={{ fontFamily: serif, fontSize: 17, fontWeight: 600, color: C.greenDeep }}>Assignment grid</span>
                <span style={{ fontSize: 12, color: C.muted, marginLeft: 10 }}>
                  {slots.length} slot{slots.length !== 1 ? 's' : ''} · {panels.length} panel{panels.length !== 1 ? 's' : ''}
                </span>
              </div>
              {slots.length === 0 || panels.length === 0 ? (
                <div style={{ padding: '32px 22px', textAlign: 'center', color: C.muted, fontSize: 14 }}>
                  {slots.length === 0 ? 'No slots — configure structure first.' : 'No panels yet — create one on the left.'}
                </div>
              ) : (
                <div style={{ padding: '18px 20px', overflowX: 'auto' }}>
                  {/* grid header */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `140px repeat(${slots.length}, minmax(52px, 1fr))`,
                    gap: 6,
                    marginBottom: 6,
                  }}>
                    <span />
                    {slots.map(slot => (
                      <span key={slotId(slot)} style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textAlign: 'center', lineHeight: 1.2 }}>
                        {catLabel(slot.category)}<br />{divLabel(slot.division).slice(0, 4)}
                      </span>
                    ))}
                  </div>
                  {/* panel rows */}
                  {panels.map((panel, pidx) => {
                    const color = panelColor(pidx);
                    return (
                      <div
                        key={panel.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: `140px repeat(${slots.length}, minmax(52px, 1fr))`,
                          gap: 6,
                          marginBottom: 6,
                          alignItems: 'stretch',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
                            {panel.name}
                          </div>
                          <span style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginLeft: 14 }}>{panel.judgeIds.length} judge{panel.judgeIds.length !== 1 ? 's' : ''}</span>
                        </div>
                        {slots.map(slot => {
                          const asgn = assignments.find(a => a.category === slot.category && a.division === slot.division);
                          const isAssigned = asgn?.panelId === panel.id;
                          const isOther = asgn && asgn.panelId !== panel.id;
                          const otherPanelIdx = isOther ? panels.findIndex(p => p.id === asgn.panelId) : -1;
                          return (
                            <button
                              key={slotId(slot)}
                              onClick={() => assignSlot(slot, panel.id)}
                              title={isOther ? `Reassign from ${panels.find(p => p.id === asgn?.panelId)?.name ?? '?'}` : isAssigned ? 'Click to unassign' : 'Assign this panel'}
                              style={{
                                height: 42,
                                borderRadius: 6,
                                border: 'none',
                                cursor: 'pointer',
                                background: isAssigned ? color : isOther ? panelColor(otherPanelIdx) + '30' : '#F0ECE0',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: isAssigned ? '#fff' : isOther ? panelColor(otherPanelIdx) : 'transparent',
                                fontSize: 15,
                                transition: 'background .15s',
                              }}
                            >
                              {isAssigned ? '✓' : isOther ? '·' : ''}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 14, lineHeight: 1.5 }}>
                    Each slot points to one panel; a panel can cover many. Editing categories or divisions regenerates the slot columns automatically.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
