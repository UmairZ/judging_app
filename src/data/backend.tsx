import { createContext, useContext, type ReactNode } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp, type DocumentData } from 'firebase/firestore';
import { db, auth } from '../firebase/app';

type DocCb = (data: (DocumentData & { id: string }) | null) => void;

export interface DbBackend {
  subscribeDoc(path: string, cb: DocCb): () => void;
  write(path: string, data: DocumentData, merge: boolean): Promise<void>;
  readonly kind: 'live' | 'demo';
}

const firestoreBackend: DbBackend = {
  kind: 'live',
  subscribeDoc: (path, cb) =>
    onSnapshot(doc(db, path), (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null), () => cb(null)),
  write: (path, data, merge) =>
    setDoc(doc(db, path), { ...data, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid ?? null }, { merge }),
};

/** Demo/testing backend: an in-memory doc store with listener notification. */
export class InMemoryBackend implements DbBackend {
  readonly kind = 'demo';
  private docs = new Map<string, DocumentData>();
  private subs = new Map<string, Set<DocCb>>();
  subscribeDoc(path: string, cb: DocCb) {
    const set = this.subs.get(path) ?? new Set();
    set.add(cb);
    this.subs.set(path, set);
    cb(this.snapshotOf(path));
    return () => { set.delete(cb); };
  }
  async write(path: string, data: DocumentData, merge: boolean) {
    const resolved = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, isSentinel(v) ? Date.now() : v]),
    );
    this.docs.set(path, merge ? { ...(this.docs.get(path) ?? {}), ...resolved } : resolved);
    this.subs.get(path)?.forEach((cb) => cb(this.snapshotOf(path)));
  }
  seed(path: string, data: DocumentData) { this.docs.set(path, data); }
  private snapshotOf(path: string) {
    const d = this.docs.get(path);
    return d ? { id: path.split('/').pop() as string, ...d } : null;
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
