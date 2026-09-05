import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/app';

export type WaitlistInput = { email: string; name?: string; org?: string };
export type Validated = { ok: true; value: { email: string; name?: string; org?: string } } | { ok: false; error: string };

export function validateWaitlist(input: WaitlistInput): Validated {
  const email = input.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  const clean = (s?: string) => (s && s.trim() ? s.trim() : undefined);
  return { ok: true, value: { email, name: clean(input.name), org: clean(input.org) } };
}

export async function submitWaitlist(input: WaitlistInput): Promise<void> {
  const v = validateWaitlist(input);
  if (!v.ok) throw new Error(v.error);
  await addDoc(collection(db, 'waitlist'), {
    email: v.value.email,
    ...(v.value.name ? { name: v.value.name } : {}),
    ...(v.value.org ? { org: v.value.org } : {}),
    createdAt: serverTimestamp(),
    source: 'landing',
  });
}
