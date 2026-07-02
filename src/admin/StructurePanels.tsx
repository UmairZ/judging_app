import { useState, useEffect, useRef } from 'react';
import { useCollection, useDocData, writeDoc, removeDoc } from '../data/db';
import { useTenant } from '../tenant/TenantContext';
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

export default function StructurePanels({ section }: { section: 'structure' | 'panels' }) {
  // ── Firestore data ──────────────────────────────────────────────────────
  const { tp } = useTenant();
  const { data: structureData } = useDocData<StructureConfig>(tp('config/structure'));
  const judges = [...useCollection<JudgeDoc>(tp('judges'))].sort((a, b) => a.name.localeCompare(b.name));
  const panels = useCollection<PanelDoc>(tp('panels'));
  const assignments = useCollection<AssignmentDoc>(tp('assignments'));

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
    setEdited(prev => ({ ...prev, divisions: [...prev.divisions, { id: crypto.randomUUID(), label: 'New division' }] }));
  }
  function removeDivision(divId: string) {
    setEdited(prev => ({
      divisions: prev.divisions.filter(d => d.id !== divId),
      categories: prev.categories.map(c => ({ ...c, divisions: c.divisions.filter(d => d !== divId) })),
    }));
  }

  // ── Category editing ────────────────────────────────────────────────────
  function addCategory() {
    setEdited(prev => ({
      ...prev,
      categories: [...prev.categories, { id: crypto.randomUUID(), label: '', minQuestions: 3, divisions: [], zeffyLabels: [''] }],
    }));
  }
  function removeCategory(catId: string) {
    setEdited(prev => ({ ...prev, categories: prev.categories.filter(c => c.id !== catId) }));
  }
  function setMinQ(catId: string, v: number) {
    setEdited(prev => ({
      ...prev,
      categories: prev.categories.map(c => c.id === catId ? { ...c, minQuestions: v } : c),
    }));
  }
  function setCatLabel(catId: string, label: string) {
    setEdited(prev => ({ ...prev, categories: prev.categories.map(c => c.id === catId ? { ...c, label } : c) }));
  }
  function setCatDesc(catId: string, desc: string) {
    // the sub-line doubles as the Zeffy match label, so edits keep registration mapping in sync
    setEdited(prev => ({ ...prev, categories: prev.categories.map(c => c.id === catId ? { ...c, zeffyLabels: [desc] } : c) }));
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
    await writeDoc(tp('config/structure'), edited, false);
    setStructureSaved(true);
    setTimeout(() => setStructureSaved(false), 2000);
  }

  // ── Judges ──────────────────────────────────────────────────────────────
  const [newJudgeName, setNewJudgeName] = useState('');
  const [editingJudgeId, setEditingJudgeId] = useState<string | null>(null);
  const [editingJudgeName, setEditingJudgeName] = useState('');

  async function addJudge() {
    if (!newJudgeName.trim()) return;
    await writeDoc(tp('judges/' + crypto.randomUUID()), { name: newJudgeName.trim(), active: true });
    setNewJudgeName('');
  }

  function startRenameJudge(j: JudgeDoc & { id: string }) {
    setEditingJudgeId(j.id);
    setEditingJudgeName(j.name);
  }
  function commitRenameJudge(id: string) {
    if (editingJudgeName.trim()) writeDoc(tp('judges/' + id), { name: editingJudgeName.trim() }, true);
    setEditingJudgeId(null);
  }

  async function removeJudge(id: string) {
    if (!window.confirm('Remove this judge? They will be unassigned from all panels.')) return;
    // pull from any panel first so no dangling judgeId is left behind
    await Promise.all(panels.filter(p => p.judgeIds.includes(id)).map(p =>
      writeDoc(tp('panels/' + p.id), { name: p.name, judgeIds: p.judgeIds.filter(j => j !== id) }, false)));
    await removeDoc(tp('judges/' + id));
  }

  // ── Panels ──────────────────────────────────────────────────────────────
  const [openDropdown, setOpenDropdown] = useState<string | null>(null); // panel whose judges dropdown is open
  const [editingPanelId, setEditingPanelId] = useState<string | null>(null);
  const [editingPanelName, setEditingPanelName] = useState('');

  async function addPanelRow() {
    await writeDoc(tp('panels/' + crypto.randomUUID()), { name: 'New panel', judgeIds: [] });
  }

  function startRenamePanel(p: PanelDoc & { id: string }) {
    setEditingPanelId(p.id);
    setEditingPanelName(p.name);
  }
  function commitRenamePanel(id: string) {
    if (editingPanelName.trim()) writeDoc(tp('panels/' + id), { name: editingPanelName.trim() }, true);
    setEditingPanelId(null);
  }
  async function deletePanel(id: string) {
    if (!window.confirm('Delete this panel? Its slot assignments will be cleared.')) return;
    await Promise.all(assignments.filter(a => a.panelId === id).map(a => removeDoc(tp('assignments/' + a.id))));
    await removeDoc(tp('panels/' + id));
    if (openDropdown === id) setOpenDropdown(null);
  }

  async function togglePanelJudge(panel: PanelDoc & { id: string }, judgeId: string) {
    const has = panel.judgeIds.includes(judgeId);
    const judgeIds = has ? panel.judgeIds.filter(j => j !== judgeId) : [...panel.judgeIds, judgeId];
    await writeDoc(tp('panels/' + panel.id), { name: panel.name, judgeIds }, false);
  }

  // ── Assignment grid ─────────────────────────────────────────────────────
  async function assignSlot(slot: { category: string; division: string }, panelId: string) {
    const sid = slotId(slot);
    const existing = assignments.find(a => a.category === slot.category && a.division === slot.division);
    if (existing?.panelId === panelId) {
      await removeDoc(tp('assignments/' + sid)); // clicking the assigned panel toggles the slot off
    } else {
      await writeDoc(tp('assignments/' + sid), { category: slot.category, division: slot.division, panelId }, false);
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
    <div style={{ maxWidth: 1180, display: 'flex', flexDirection: 'column', gap: 30 }}>

      {/* SECTION — Categories & Divisions */}
      {section === 'structure' && (
      <div>
        <StepHeader title="Categories & divisions" desc="Rows are categories, columns are divisions — tap a cell to enable that division for the category." />

        <div style={{ background: C.cream, borderRadius: 8, boxShadow: '0 6px 22px rgba(20,40,36,.14)', padding: '18px 20px', overflowX: 'auto' }}>
          {(() => {
            const COLS = `minmax(230px, 1.6fr) 104px repeat(${edited.divisions.length}, minmax(90px, 1fr)) 64px 26px`;
            return (
              <>
                {/* header row — divisions are the columns */}
                <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, alignItems: 'end', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, alignSelf: 'center' }}>Category</span>
                  <span style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, textAlign: 'center', alignSelf: 'center' }}>Min Qs</span>
                  {edited.divisions.map((div, idx) => (
                    <div key={div.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: DIVISION_COLORS[idx] ?? C.sub }} />
                      {editingDivId === div.id ? (
                        <input autoFocus value={editingDivLabel} onChange={e => setEditingDivLabel(e.target.value)} onBlur={() => commitRenameDiv(div.id)} onKeyDown={e => { if (e.key === 'Enter') commitRenameDiv(div.id); if (e.key === 'Escape') setEditingDivId(null); }} style={{ width: '100%', fontSize: 12, fontWeight: 600, color: C.greenDeep, textAlign: 'center', border: 'none', borderBottom: `1px solid ${C.cardLine}`, outline: 'none', background: 'transparent' }} />
                      ) : (
                        <span onClick={() => startRenameDiv(div)} title="Click to rename" style={{ fontSize: 12, fontWeight: 600, color: C.greenDeep, cursor: 'pointer', textAlign: 'center', lineHeight: 1.2 }}>{div.label}</span>
                      )}
                      <button onClick={() => removeDivision(div.id)} title="Remove division" style={{ fontSize: 13, color: C.fail, background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                  <button onClick={addDivision} title="Add a division (column)" style={{ alignSelf: 'center', fontSize: 12, fontWeight: 600, color: C.brassDark, background: 'none', border: `1.5px dashed ${C.cardLine}`, borderRadius: 7, padding: '6px 2px', cursor: 'pointer', lineHeight: 1.1 }}>+ div</button>
                  <span />
                </div>

                {/* category rows */}
                {edited.categories.map((cat: Category) => (
                  <div key={cat.id} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, alignItems: 'center', padding: '10px 0', borderTop: `1px solid #F0EBDD` }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 10 }}>
                      <input value={cat.label} onChange={e => setCatLabel(cat.id, e.target.value)} placeholder="Category name" style={{ fontFamily: serif, fontSize: 16, fontWeight: 600, color: C.greenDeep, border: 'none', borderBottom: `1px solid ${C.line}`, outline: 'none', background: 'transparent', padding: '2px 0', width: '100%', boxSizing: 'border-box' }} />
                      <input value={cat.zeffyLabels?.[0] ?? ''} onChange={e => setCatDesc(cat.id, e.target.value)} placeholder="Description (Zeffy label)" style={{ fontSize: 11.5, color: C.muted, border: 'none', borderBottom: `1px solid ${C.line}`, outline: 'none', background: 'transparent', padding: '2px 0', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <Stepper value={cat.minQuestions} onChange={v => setMinQ(cat.id, v)} />
                    {edited.divisions.map((div, didx) => {
                      const on = cat.divisions.includes(div.id);
                      return (
                        <button key={div.id} onClick={() => toggleCatDivision(cat.id, div.id)} title={`${on ? 'Disable' : 'Enable'} ${div.label}`} style={{ height: 40, borderRadius: 6, border: on ? 'none' : `1.5px dashed ${C.cardLine}`, cursor: 'pointer', background: on ? (DIVISION_COLORS[didx] ?? C.green) : 'transparent', color: '#fff', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' }}>
                          {on ? '✓' : ''}
                        </button>
                      );
                    })}
                    <span />
                    <button onClick={() => removeCategory(cat.id)} title="Remove category" style={{ fontSize: 16, color: C.fail, background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
                  </div>
                ))}

                {/* add category row (bottom insert) */}
                <div onClick={addCategory} style={{ borderTop: `1px solid #F0EBDD`, padding: '11px 0', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.brassDark }}>+ Add category</div>

                {/* slots summary + save */}
                <div style={{ marginTop: 12, paddingTop: 13, borderTop: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <span style={{ fontSize: 12.5, color: C.sub }}>
                    This config yields <strong style={{ color: C.greenDeep }}>{slots.length} slot{slots.length !== 1 ? 's' : ''}</strong>
                    {slots.length > 0 && <> — {slots.map(s => `(${catLabel(s.category)}×${divLabel(s.division)})`).join(', ')}</>}. Panels attach to these.
                  </span>
                  <button onClick={saveStructure} style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: '#fff', background: structureSaved ? C.green : C.greenDeep, border: 'none', borderRadius: 6, padding: '9px 18px', cursor: 'pointer', transition: 'background .2s' }}>
                    {structureSaved ? '✓ Saved' : 'Save Structure'}
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      </div>
      )}

      {/* SECTION — Judges & Panels */}
      {section === 'panels' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
      <div>
        <StepHeader title="Judges" desc="The roster — group them into panels in the grid below." />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {judges.map(j => (
            <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 999, padding: '6px 8px 6px 13px' }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: j.active ? C.green : C.muted, flexShrink: 0 }} />
              {editingJudgeId === j.id ? (
                <input
                  autoFocus
                  value={editingJudgeName}
                  onChange={e => setEditingJudgeName(e.target.value)}
                  onBlur={() => commitRenameJudge(j.id)}
                  onKeyDown={e => { if (e.key === 'Enter') commitRenameJudge(j.id); if (e.key === 'Escape') setEditingJudgeId(null); }}
                  style={{ width: `${Math.max(6, editingJudgeName.length)}ch`, fontSize: 13.5, fontWeight: 600, color: C.ink, border: 'none', outline: 'none', background: 'transparent' }}
                />
              ) : (
                <span onClick={() => startRenameJudge(j)} title="Click to rename" style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, cursor: 'pointer' }}>{j.name}</span>
              )}
              <button onClick={() => removeJudge(j.id)} title="Remove judge" style={{ fontSize: 15, color: C.fail, background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              placeholder="Add judge…"
              value={newJudgeName}
              onChange={e => setNewJudgeName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addJudge(); }}
              style={{ width: 150, fontSize: 13, padding: '7px 11px', border: `1px solid ${C.cardLine}`, borderRadius: 999, outline: 'none', background: '#fff' }}
            />
            <button onClick={addJudge} style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', background: C.green, border: 'none', borderRadius: 999, padding: '7px 13px', cursor: 'pointer' }}>+ Add</button>
          </div>
          {judges.length === 0 && <span style={{ fontSize: 13, color: C.muted }}>No judges yet.</span>}
        </div>
      </div>

      {/* ── Panels & assignment: one unified grid ── */}
      <div>
        <StepHeader title="Panels & assignment" desc="Each row is a panel — name it, pick its judges, and tap the slots it scores." />

        <div style={{ background: C.cream, borderRadius: 8, boxShadow: '0 6px 22px rgba(20,40,36,.14)', padding: '18px 20px' }}>
          {slots.length === 0 ? (
            <div style={{ padding: '28px 8px', textAlign: 'center', color: C.muted, fontSize: 14 }}>No slots yet — set up Categories &amp; Divisions first.</div>
          ) : (
            <>
              {/* column header — slots */}
              <div style={{ display: 'grid', gridTemplateColumns: `280px repeat(${slots.length}, minmax(72px, 1fr))`, gap: 6, marginBottom: 8, alignItems: 'end' }}>
                <span style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, alignSelf: 'center' }}>Panel ↓ / Slot →</span>
                {slots.map(slot => (
                  <span key={slotId(slot)} style={{ fontSize: 11.5, fontWeight: 600, color: C.greenDeep, textAlign: 'center', lineHeight: 1.25 }}>
                    {catLabel(slot.category)}<br /><span style={{ color: C.muted, fontWeight: 500 }}>{divLabel(slot.division)}</span>
                  </span>
                ))}
              </div>

              {/* panel rows */}
              {panels.map((panel, pidx) => {
                const color = panelColor(pidx);
                const dropdownOpen = openDropdown === panel.id;
                return (
                  <div key={panel.id} style={{ display: 'grid', gridTemplateColumns: `280px repeat(${slots.length}, minmax(72px, 1fr))`, gap: 6, marginBottom: 6, alignItems: 'stretch' }}>
                    {/* left: name + judges dropdown + delete */}
                    <div style={{ position: 'relative', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 8, padding: '0 8px 0 12px', display: 'flex', alignItems: 'center', gap: 7, minHeight: 44 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: color, flexShrink: 0 }} />
                      {editingPanelId === panel.id ? (
                        <input
                          autoFocus
                          value={editingPanelName}
                          onChange={e => setEditingPanelName(e.target.value)}
                          onBlur={() => commitRenamePanel(panel.id)}
                          onKeyDown={e => { if (e.key === 'Enter') commitRenamePanel(panel.id); if (e.key === 'Escape') setEditingPanelId(null); }}
                          style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: C.ink, border: 'none', outline: 'none', background: 'transparent' }}
                        />
                      ) : (
                        <span onClick={() => startRenamePanel(panel)} title="Click to rename" style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: C.ink, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{panel.name}</span>
                      )}
                      <button onClick={() => setOpenDropdown(dropdownOpen ? null : panel.id)} title="Assign judges" style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 600, color: C.brassDark, background: C.pill, border: 'none', borderRadius: 999, padding: '4px 9px', cursor: 'pointer' }}>
                        {panel.judgeIds.length} {panel.judgeIds.length === 1 ? 'judge' : 'judges'} {dropdownOpen ? '▴' : '▾'}
                      </button>
                      <button onClick={() => deletePanel(panel.id)} title="Delete panel" style={{ flexShrink: 0, fontSize: 16, color: C.fail, background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>×</button>
                      {dropdownOpen && (
                        <div style={{ position: 'absolute', top: '100%', left: 8, marginTop: 5, zIndex: 50, background: '#fff', border: `1px solid ${C.cardLine}`, borderRadius: 8, boxShadow: '0 10px 28px rgba(20,40,36,.2)', padding: '9px 11px', minWidth: 190, display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {judges.length === 0 && <span style={{ fontSize: 12.5, color: C.muted }}>Add judges in the roster above.</span>}
                          {judges.map(j => {
                            const checked = panel.judgeIds.includes(j.id);
                            return (
                              <label key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                                <input type="checkbox" checked={checked} onChange={() => togglePanelJudge(panel, j.id)} style={{ accentColor: color, width: 14, height: 14 }} />
                                <span style={{ color: checked ? C.ink : C.sub, fontWeight: checked ? 600 : 400 }}>{j.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {/* slot cells */}
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
                          style={{ borderRadius: 6, border: 'none', cursor: 'pointer', background: isAssigned ? color : isOther ? panelColor(otherPanelIdx) + '30' : '#F0ECE0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isAssigned ? '#fff' : isOther ? panelColor(otherPanelIdx) : 'transparent', fontSize: 15, transition: 'background .15s' }}
                        >
                          {isAssigned ? '✓' : isOther ? '·' : ''}
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {/* add panel row */}
              <button onClick={addPanelRow} style={{ marginTop: 4, width: 280, fontSize: 13, fontWeight: 600, color: C.brassDark, background: 'none', border: `1.5px dashed ${C.cardLine}`, borderRadius: 8, padding: '10px 0', cursor: 'pointer' }}>+ Add panel</button>

              <div style={{ fontSize: 12, color: C.muted, marginTop: 14, lineHeight: 1.5 }}>
                Each slot points to one panel; a panel can cover many. Slot columns come from <strong style={{ color: C.sub }}>Categories &amp; Divisions</strong>.
              </div>
            </>
          )}
        </div>
      </div>

      {/* click-away to close any open judges dropdown */}
      {openDropdown && <div onClick={() => setOpenDropdown(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />}
      </div>
      )}

    </div>
  );
}

function StepHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 18 }}>
      <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: 21, margin: 0, color: C.greenDeep }}>{title}</h2>
      <span style={{ fontSize: 13, color: C.muted }}>{desc}</span>
    </div>
  );
}

