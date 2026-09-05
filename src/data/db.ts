import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import { db, auth } from '../firebase/app';
import { useBackend } from './backend';

export type WithId<T> = T & { id: string };

/**
 * Live subscription to an entire collection. Contest data is tiny (dozens of
 * docs), so screens subscribe to the whole collection and filter in memory —
 * no composite-index plumbing required.
 */
export function useCollection<T>(colName: string): WithId<T>[] {
  const [rows, setRows] = useState<WithId<T>[]>([]);
  useEffect(() => {
    return onSnapshot(collection(db, colName), (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
    });
  }, [colName]);
  return rows;
}

/** Live subscription to a single document (e.g. `config/scoring`). */
export function useDocData<T>(path: string): { data: WithId<T> | null; loading: boolean } {
  const backend = useBackend();
  const [state, setState] = useState<{ data: WithId<T> | null; loading: boolean }>({ data: null, loading: true });
  useEffect(() => {
    // The Firestore backend folds listener errors (e.g. permission-denied) into cb(null) —
    // either way this must not wedge screens that gate on `loading`.
    return backend.subscribeDoc(path, (d) => {
      setState({ data: d as WithId<T> | null, loading: false });
    });
  }, [backend, path]);
  return state;
}

/**
 * Real save status for a single doc, for the offline-first judge UI:
 *  - 'offline' — no network; writes are queued in the local cache, safe on device
 *  - 'saving'  — online with un-acknowledged local writes in flight
 *  - 'saved'   — online and everything is committed to the server
 */
export function useSyncState(path: string): 'saved' | 'saving' | 'offline' {
  const backend = useBackend();
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => {
    if (backend.kind === 'demo') return;
    return onSnapshot(doc(db, path), { includeMetadataChanges: true }, (snap) => {
      setPending(snap.metadata.hasPendingWrites);
    });
  }, [backend, path]);
  if (backend.kind === 'demo') return 'saved';
  if (!online) return 'offline';
  return pending ? 'saving' : 'saved';
}

/**
 * Create or merge a document. Every write is stamped with updatedAt/updatedBy —
 * the audit-log hook: a later phase surfaces the trail, nothing else changes.
 */
export const writeDoc = (path: string, data: DocumentData, merge = true) =>
  setDoc(doc(db, path), { ...data, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid ?? null }, { merge });

/** Delete a document (admin paths only; registrations/sessions are protected by rules). */
export const removeDoc = (path: string) => deleteDoc(doc(db, path));

/** Server timestamp sentinel for createdAt/updatedAt fields. */
export const now = () => serverTimestamp();
