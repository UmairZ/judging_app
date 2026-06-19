import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

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
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
