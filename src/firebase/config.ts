export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Dev/emulator builds run against a fake "demo-" project: the emulator suite
// treats demo-* ids as offline-only, so no dev mistake can reach a real backend.
const EMULATOR_CONFIG: FirebaseWebConfig = {
  apiKey: 'demo',
  authDomain: 'localhost',
  projectId: 'demo-ubayy',
  storageBucket: 'demo-ubayy.appspot.com',
  messagingSenderId: '0',
  appId: 'demo',
};

export function resolveFirebaseConfig(env: Record<string, string | undefined>): FirebaseWebConfig {
  if (env.VITE_USE_EMULATOR === '1') return EMULATOR_CONFIG;
  const need = (key: string): string => {
    const value = env[key];
    if (!value) throw new Error(`Missing ${key}: copy this environment's Firebase web config into .env.sandbox / .env.production (see README "Environments").`);
    return value;
  };
  return {
    apiKey: need('VITE_FB_API_KEY'),
    authDomain: need('VITE_FB_AUTH_DOMAIN'),
    projectId: need('VITE_FB_PROJECT_ID'),
    storageBucket: need('VITE_FB_STORAGE_BUCKET'),
    messagingSenderId: need('VITE_FB_MESSAGING_SENDER_ID'),
    appId: need('VITE_FB_APP_ID'),
  };
}
