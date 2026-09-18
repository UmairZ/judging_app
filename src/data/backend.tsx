import { createContext, useContext, type ReactNode } from 'react';
import {
  collection,
  doc,
  getCountFromServer,
  onSnapshot,
  query,
  setDoc,
  serverTimestamp,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { db, auth } from '../firebase/app';

type DocCb = (data: (DocumentData & { id: string }) | null) => void;
type ColCb = (docs: (DocumentData & { id: string })[]) => void;

export interface DbBackend {
  subscribeDoc(path: string, cb: DocCb): () => void;
  subscribeCollection(path: string, cb: ColCb): () => void;
  write(path: string, data: DocumentData, merge: boolean): Promise<void>;
  count(path: string, presentField?: string): Promise<number>;
  readonly kind: 'live' | 'demo';
}

/** Firestore TERMINATES a listener on error — e.g. a listen that starts during
 * an auth transition (the judge-device admin re-entry flow does exactly this)
 * gets permission-denied once and then never recovers. A dead config/scoring
 * listener would silently score judges on DEFAULTS, so instead of dying quietly
 * we log and re-subscribe with backoff. Attempts reset on any successful
 * snapshot; after 6 failures we stop retrying (the error log is the trail). */
function resilient(start: (onNext: () => void, onError: () => void) => () => void): () => void {
  let stopped = false;
  let attempt = 0;
  let unsub: () => void = () => {};
  const go = () => {
    if (stopped) return;
    unsub = start(
      () => { attempt = 0; },
      () => {
        unsub();
        attempt += 1;
        if (attempt > 6) return;
        setTimeout(go, Math.min(8000, 500 * 2 ** attempt));
      },
    );
  };
  go();
  return () => { stopped = true; unsub(); };
}

const firestoreBackend: DbBackend = {
  kind: 'live',
  subscribeDoc: (path, cb) =>
    resilient((onNext, onError) =>
      onSnapshot(
        doc(db, path),
        (snap) => { onNext(); cb(snap.exists() ? { id: snap.id, ...snap.data() } : null); },
        (err) => { console.error(`[db] doc listen failed, retrying: ${path}`, err); cb(null); onError(); },
      ),
    ),
  subscribeCollection: (path, cb) =>
    resilient((onNext, onError) =>
      onSnapshot(
        collection(db, path),
        (snap) => { onNext(); cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); },
        (err) => { console.error(`[db] collection listen failed, retrying: ${path}`, err); onError(); },
      ),
    ),
  write: (path, data, merge) =>
    setDoc(doc(db, path), { ...data, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid ?? null }, { merge }),
  count: async (path, presentField) => {
    const target = presentField ? query(collection(db, path), where(presentField, '!=', null)) : collection(db, path);
    const snap = await getCountFromServer(target);
    return snap.data().count;
  },
};

/** Demo/testing backend: an in-memory doc store with listener notification. */
export class InMemoryBackend implements DbBackend {
  readonly kind = 'demo';
  private docs = new Map<string, DocumentData>();
  private subs = new Map<string, Set<DocCb>>();
  private colSubs = new Map<string, Set<ColCb>>();
  subscribeDoc(path: string, cb: DocCb) {
    const set = this.subs.get(path) ?? new Set();
    set.add(cb);
    this.subs.set(path, set);
    cb(this.snapshotOf(path));
    return () => { set.delete(cb); };
  }
  subscribeCollection(path: string, cb: ColCb) {
    const set = this.colSubs.get(path) ?? new Set();
    set.add(cb);
    this.colSubs.set(path, set);
    cb(this.collectionSnapshot(path));
    return () => { set.delete(cb); };
  }
  async write(path: string, data: DocumentData, merge: boolean) {
    const resolved = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, isSentinel(v) ? Date.now() : v]),
    );
    this.docs.set(path, merge ? { ...(this.docs.get(path) ?? {}), ...resolved } : resolved);
    this.subs.get(path)?.forEach((cb) => cb(this.snapshotOf(path)));
    const parentPath = path.split('/').slice(0, -1).join('/');
    this.colSubs.get(parentPath)?.forEach((cb) => cb(this.collectionSnapshot(parentPath)));
  }
  async count(path: string, presentField?: string) {
    const docs = this.collectionSnapshot(path);
    return presentField ? docs.filter((d) => d[presentField] != null).length : docs.length;
  }
  seed(path: string, data: DocumentData) { this.docs.set(path, data); }
  private snapshotOf(path: string) {
    const d = this.docs.get(path);
    return d ? { id: path.split('/').pop() as string, ...d } : null;
  }
  private collectionSnapshot(path: string) {
    const out: (DocumentData & { id: string })[] = [];
    for (const [docPath, data] of this.docs) {
      const parts = docPath.split('/');
      const id = parts.pop() as string;
      if (parts.join('/') === path) out.push({ id, ...data });
    }
    return out;
  }
}

// Firestore's serverTimestamp() sentinel and our demo sentinel both count.
const isSentinel = (v: unknown): boolean =>
  v != null && typeof v === 'object' &&
  ((v as { __sentinel?: string }).__sentinel === 'serverTimestamp' || (v as { _methodName?: string })._methodName === 'serverTimestamp');

const Ctx = createContext<DbBackend>(firestoreBackend);
export const DbProvider = ({ backend, children }: { backend: DbBackend; children: ReactNode }) => (
  <Ctx.Provider value={backend}>{children}</Ctx.Provider>
);
export const useBackend = () => useContext(Ctx);
/** Write path for screens that must work in demo mode (GradingScreen). */
export const useDb = () => {
  const b = useBackend();
  return { write: (path: string, data: DocumentData, merge = true) => b.write(path, data, merge) };
};
