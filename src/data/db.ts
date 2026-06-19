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
import { db } from '../firebase/app';

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
  const [state, setState] = useState<{ data: WithId<T> | null; loading: boolean }>({ data: null, loading: true });
  useEffect(() => {
    return onSnapshot(doc(db, path), (snap) => {
      setState({ data: snap.exists() ? ({ id: snap.id, ...(snap.data() as T) }) : null, loading: false });
    });
  }, [path]);
  return state;
}

/** Create or merge a document at an explicit path/id. */
export const writeDoc = (path: string, data: DocumentData, merge = true) =>
  setDoc(doc(db, path), data, { merge });

/** Delete a document (admin paths only; registrations/sessions are protected by rules). */
export const removeDoc = (path: string) => deleteDoc(doc(db, path));

/** Server timestamp sentinel for createdAt/updatedAt fields. */
export const now = () => serverTimestamp();
