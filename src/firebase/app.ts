import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { resolveFirebaseConfig } from './config';

const firebaseConfig = resolveFirebaseConfig(import.meta.env as Record<string, string | undefined>);

export const app = initializeApp(firebaseConfig);

// App Check is opt-in by configuration: set VITE_APPCHECK_SITE_KEY (reCAPTCHA v3)
// to attest this web app. Unset (dev, self-hosters) → no-op.
const appCheckKey = import.meta.env.VITE_APPCHECK_SITE_KEY as string | undefined;
if (appCheckKey) {
  if (import.meta.env.DEV) {
    // Emulator/dev: use a debug token instead of real attestation.
    (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(app, { provider: new ReCaptchaV3Provider(appCheckKey), isTokenAutoRefreshEnabled: true });
}

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
  connectFunctionsEmulator(getFunctions(app, 'us-central1'), '127.0.0.1', 5001);
}
