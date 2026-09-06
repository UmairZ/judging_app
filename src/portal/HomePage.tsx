import { useState } from 'react';
import { EllipsisVerticalIcon } from '@heroicons/react/16/solid';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase/app';
import { useAuth } from '../auth/AuthContext';
import { useCollection, useCount, writeDoc, type WithId } from '../data/db';
import { slugifyOrgId, validateIds } from '../onboarding/logic';
import { compBasePath } from '../tenant/paths';
import { CompetitionStats, Stat } from './comp-stats';
import { navigate } from './nav';
import { setStatus, statusColor, STATUS_LABEL, timeOfDay, type CompStatus } from './lifecycle';
import { compPath } from './routes';
import { Badge } from './vendor/badge';
import { Button } from './vendor/button';
import { Dialog, DialogActions, DialogBody, DialogTitle } from './vendor/dialog';
import { Divider } from './vendor/divider';
import { Dropdown, DropdownButton, DropdownItem, DropdownMenu } from './vendor/dropdown';
import { Heading, Subheading } from './vendor/heading';
import { Input } from './vendor/input';
import { Link } from './vendor/link';

interface OrgMirror {
  role: string;
  name: string;
}

interface CompDoc {
  name: string;
  status: CompStatus;
  createdAt?: unknown;
}

function firstNameOf(user: { displayName?: string | null; email?: string | null } | null): string {
  const source = user?.displayName || user?.email || '';
  return source.split('@')[0].split(' ')[0] || 'there';
}

/** `createdAt` may be a Firestore `Timestamp` (live backend), a plain millis
 * number (InMemoryBackend's resolved sentinel), or absent — normalize all of
 * those to a millis number so "newest" can be a real sort, not array order. */
function createdAtMillis(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return -Infinity;
}

/** First live competition, else the newest by `createdAt` (missing createdAt
 * sorts oldest) — collection order from Firestore/InMemoryBackend is otherwise
 * unordered without an explicit orderBy. */
function targetCompetition<T extends { status: CompStatus; createdAt?: unknown }>(
  comps: WithId<T>[],
): WithId<T> | undefined {
  const live = comps.find((c) => c.status === 'live');
  if (live) return live;
  return [...comps].sort((a, b) => createdAtMillis(b.createdAt) - createdAtMillis(a.createdAt))[0];
}

/**
 * Org binding lives here, at the top of the tree, so a no-org account (e.g. a
 * judge) never mounts any org-scoped subscription — no path is ever built
 * from a missing orgId, so no Firestore path can contain a sentinel/reserved
 * segment (Firestore rejects any collection/doc id shaped like `__foo__`).
 * `user!` is safe: HomePage only renders once App.tsx has confirmed a
 * signed-in user (see PortalRoot.tsx), matching the legacy dashboard's convention.
 */
export function HomePage() {
  const { user } = useAuth();
  const orgs = useCollection<OrgMirror>(`users/${user!.uid}/orgs`);
  const org = orgs[0];
  const firstName = firstNameOf(user);

  if (!org) {
    return (
      <>
        <Heading>
          Good {timeOfDay()}, {firstName}
        </Heading>
        <div className="mt-8 text-sm text-zinc-500">This account doesn't belong to an organization yet.</div>
      </>
    );
  }

  return <OrgHomePage orgId={org.id} firstName={firstName} />;
}

function OrgHomePage({ orgId, firstName }: { orgId: string; firstName: string }) {
  const comps = useCollection<CompDoc>(`orgs/${orgId}/competitions`);
  const targetComp = targetCompetition(comps);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <Heading>
        Good {timeOfDay()}, {firstName}
      </Heading>

      <div className="mt-8 flex items-end justify-between">
        <Subheading>
          {targetComp
            ? `${targetComp.status === 'live' ? 'Live now' : 'Latest'} — ${targetComp.name}`
            : 'No competitions yet'}
        </Subheading>
      </div>
      <div className="mt-4 grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
        {targetComp ? (
          <CompetitionStats orgId={orgId} compId={targetComp.id} />
        ) : (
          <>
            <Stat title="Registrations" value="—" />
            <Stat title="Sessions graded" value="—" />
            <Stat title="Judges" value="—" />
            <Stat title="Categories" value="—" />
          </>
        )}
      </div>

      <div className="mt-14 flex flex-wrap items-end justify-between gap-4">
        <Subheading>Competitions</Subheading>
        <Button onClick={() => setCreating(true)}>New competition</Button>
      </div>
      <div className="mt-4">
        {comps.length > 0 ? (
          <ul>
            {comps.map((c, index) => (
              <CompetitionRow key={c.id} orgId={orgId} comp={c} isFirst={index === 0} />
            ))}
          </ul>
        ) : (
          <div className="text-sm text-zinc-500">No competitions yet — create one to get started.</div>
        )}
      </div>

      {creating && <NewCompetitionDialog orgId={orgId} onClose={() => setCreating(false)} />}
    </>
  );
}

function CompetitionRow({ orgId, comp, isFirst }: { orgId: string; comp: WithId<CompDoc>; isFirst: boolean }) {
  const base = compBasePath(orgId, comp.id);
  // The roster reads the `contestants` collection — count what the label says.
  const contestants = useCount(`${base}/contestants`);
  const judges = useCount(`${base}/judges`);
  const [renaming, setRenaming] = useState(false);

  const nextStatus: CompStatus = comp.status === 'live' ? 'archived' : 'live';
  const nextLabel = comp.status === 'live' ? 'Archive' : 'Set live';

  return (
    <li>
      <Divider soft={!isFirst} />
      <div className="flex items-center justify-between">
        <div className="flex gap-6 py-6">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-zinc-100 font-semibold text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
            {comp.id}
          </div>
          <div className="space-y-1.5">
            <div className="text-base/6 font-semibold">
              <Link href={compPath(comp.id, 'overview')}>{comp.name}</Link>
            </div>
            <div className="text-xs/6 text-zinc-600">
              {contestants == null ? '—' : contestants} contestants · {judges == null ? '—' : judges} judges
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Badge className="max-sm:hidden" color={statusColor(comp.status)}>
            {STATUS_LABEL[comp.status] ?? comp.status}
          </Badge>
          <Dropdown>
            <DropdownButton plain aria-label="More options">
              <EllipsisVerticalIcon />
            </DropdownButton>
            <DropdownMenu anchor="bottom end">
              <DropdownItem
                onClick={() => {
                  navigate(compPath(comp.id, 'overview'));
                }}
              >
                Open
              </DropdownItem>
              <DropdownItem onClick={() => setRenaming(true)}>Rename</DropdownItem>
              <DropdownItem onClick={() => void setStatus(writeDoc, orgId, comp.id, nextStatus)}>
                {nextLabel}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>
      {renaming && (
        <RenameDialog orgId={orgId} compId={comp.id} initialName={comp.name} onClose={() => setRenaming(false)} />
      )}
    </li>
  );
}

function RenameDialog({
  orgId,
  compId,
  initialName,
  onClose,
}: {
  orgId: string;
  compId: string;
  initialName: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    await writeDoc(compBasePath(orgId, compId), { name: name.trim() });
    setBusy(false);
    onClose();
  };

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Rename competition</DialogTitle>
      <DialogBody>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function NewCompetitionDialog({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [compId, setCompId] = useState('');
  const [idTouched, setIdTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Handler logic copied verbatim from the legacy dashboard's CreateCompForm
  // (validateIds, slugifyOrgId, the createCompetition callable, error shaping) —
  // only the destination after success changes, to the portal's own comp route.
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateIds(compId) || !name.trim()) {
      setError('Give the competition a name and a URL id (letters, numbers, - or _).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const fns = getFunctions(app, 'us-central1');
      await httpsCallable(fns, 'createCompetition')({ orgId, compId, name: name.trim() });
      navigate(compPath(compId, 'overview'));
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not create the competition.');
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose}>
      <form onSubmit={(e) => void submit(e)}>
        <DialogTitle>New competition</DialogTitle>
        <DialogBody>
          <Input
            placeholder="Competition name (e.g. 2027 Ramadan Contest)"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!idTouched) setCompId(slugifyOrgId(e.target.value));
            }}
            autoFocus
          />
          <Input
            className="mt-4"
            placeholder="URL id (e.g. 2027)"
            value={compId}
            onChange={(e) => {
              setIdTouched(true);
              setCompId(e.target.value);
            }}
          />
          {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
        </DialogBody>
        <DialogActions>
          <Button plain type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create & open'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
