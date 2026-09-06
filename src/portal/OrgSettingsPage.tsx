import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useCollection, writeDoc } from '../data/db';
import { renameOrg } from './orgRename';
import { Button } from './vendor/button';
import { Description, Field, Fieldset, Label } from './vendor/fieldset';
import { Heading } from './vendor/heading';
import { Input } from './vendor/input';
import { Text } from './vendor/text';

interface OrgMirror {
  role: string;
  name: string;
}

export function OrgSettingsPage() {
  const { user } = useAuth();
  const orgs = useCollection<OrgMirror>(`users/${user!.uid}/orgs`);
  const org = orgs[0];
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Seed the input ONCE from the resolved org mirror — the subscription resolves
  // after first render, so a useState initializer would seed '' forever. Never
  // re-seed, or live snapshots would clobber in-progress edits (same pattern as
  // CategoriesPage/ScoringPage's `seeded` ref).
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !org) return;
    setName(org.name);
    seeded.current = true;
  }, [org]);

  if (!org) {
    return (
      <>
        <Heading>Organization</Heading>
        <div className="mt-8 text-sm text-zinc-500">This account doesn't belong to an organization yet.</div>
      </>
    );
  }

  const handleSave = async () => {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await renameOrg(writeDoc, user!.uid, org.id, name);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not rename organization.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Heading>Organization</Heading>

      <Fieldset className="mt-8">
        <Field>
          <Label>Organization name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <Description>URL id: /{org.id}</Description>
        </Field>

        <div className="mt-8">
          <Button onClick={() => void handleSave()} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>

        {error && <Text className="mt-3 text-red-600 dark:text-red-500">{error}</Text>}
        {saved && <Text className="mt-3 text-green-600 dark:text-green-500">Saved!</Text>}
      </Fieldset>
    </>
  );
}
