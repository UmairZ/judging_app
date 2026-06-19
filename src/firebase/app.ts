import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Public client config (safe to commit — access is gated by Firestore rules + Auth).
const firebaseConfig = {
  apiKey: 'AIzaSyCF4f8xPnA-QuP6k4CoYiVNjJ4fnrXbHEI',
  authDomain: 'ibn-katheer-judging-bc25d.firebaseapp.com',
  projectId: 'ibn-katheer-judging-bc25d',
  storageBucket: 'ibn-katheer-judging-bc25d.firebasestorage.app',
  messagingSenderId: '452214610959',
  appId: '1:452214610959:web:97b12d3c73b195628bd77a',
};

export const app = initializeApp(firebaseConfig);
// Offline-first: judge devices write locally and sync when connectivity returns.
export const db = initializeFirestore(app, { localCache: persistentLocalCache({}) });
export const auth = getAuth(app);
export const storage = getStorage(app);

// Dev against the local emulator suite when VITE_USE_EMULATOR=1 (see .env.development).
// Production builds talk to the real project above.
if (import.meta.env.VITE_USE_EMULATOR === '1') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}
