import { describe, expect, it } from 'vitest';
import { resolveFirebaseConfig } from './config';

const FULL = {
  VITE_FB_API_KEY: 'k', VITE_FB_AUTH_DOMAIN: 'a.firebaseapp.com',
  VITE_FB_PROJECT_ID: 'p', VITE_FB_STORAGE_BUCKET: 'p.firebasestorage.app',
  VITE_FB_MESSAGING_SENDER_ID: '1', VITE_FB_APP_ID: '1:1:web:x',
};

describe('resolveFirebaseConfig', () => {
  it('maps VITE_FB_* vars to the web config', () => {
    expect(resolveFirebaseConfig(FULL)).toEqual({
      apiKey: 'k', authDomain: 'a.firebaseapp.com', projectId: 'p',
      storageBucket: 'p.firebasestorage.app', messagingSenderId: '1', appId: '1:1:web:x',
    });
  });

  it('names the missing var in its error', () => {
    const { VITE_FB_APP_ID: _omit, ...partial } = FULL;
    expect(() => resolveFirebaseConfig(partial)).toThrow(/VITE_FB_APP_ID/);
  });

  it('returns an offline demo config under the emulator flag, ignoring missing vars', () => {
    expect(resolveFirebaseConfig({ VITE_USE_EMULATOR: '1' }).projectId).toBe('demo-ubayy');
  });
});
