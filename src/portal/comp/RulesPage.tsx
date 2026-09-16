import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { now, useDocData, writeDoc } from '../../data/db';
import { useTenant } from '../../tenant/TenantContext';
import { Button } from '../vendor/button';
import { Heading } from '../vendor/heading';
import { Text } from '../vendor/text';
import { Textarea } from '../vendor/textarea';
import { Explainer } from '../Explainer';

interface PoliciesDoc {
  rulesText?: string;
}

/**
 * Rules page — plain-text house rules the organizer writes once and the judge
 * app renders verbatim (RulesModal, split on blank lines into paragraphs).
 * Same shape as ScoringPage: loading gate, seed-once ref, green Save.
 */
export function RulesPage() {
  const { user } = useAuth();
  const { tp } = useTenant();
  const { data, loading } = useDocData<PoliciesDoc>(tp('config/policies'));
  const [edited, setEdited] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Seed local state ONCE — re-seeding on every live snapshot would wipe edits.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || loading) return;
    setEdited(data?.rulesText ?? '');
    seeded.current = true;
  }, [loading, data]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    await writeDoc(tp('config/policies'), { rulesText: edited, updatedAt: now(), updatedBy: user!.uid }, false);
    setSaving(false);
    setSaved(true);
  }

  return (
    <>
      <Heading>Rules</Heading>

      {loading && <Text className="mt-8">Loading config…</Text>}

      {!loading && (
        <>
          <div className="mt-8">
            <Explainer title="What your judges see">
              <Text className="text-sm">
                Whatever you write here appears word-for-word in the judge app under &quot;Rules&quot; — house
                rules, prompting conventions, etiquette, tie-break customs. Leave it empty and the judges see no
                Rules button at all.
              </Text>
            </Explainer>
          </div>

          <div className="mt-8">
            <Textarea
              rows={14}
              value={edited}
              onChange={(e) => {
                setEdited(e.target.value);
                setSaved(false);
              }}
            />
            <Text className="mt-2 text-sm">Blank line starts a new paragraph.</Text>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-end gap-4">
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
