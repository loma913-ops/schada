import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import { cleanupBrowserStorage } from '../storage/storageCleanup';
import {
  FIREBASE_RUNTIME_CONFIG,
  validateFirebaseClientOptions,
  type FirebaseClientOptions,
} from './firebaseRuntimeConfig';

// Purge any leaked or orphaned firestore_ keys from previous persistentMultipleTabManager sessions
cleanupBrowserStorage();

export function isFirebaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID
  );
}

const firebaseConfig: FirebaseClientOptions = {
  apiKey: String(import.meta.env.VITE_FIREBASE_API_KEY || ''),
  authDomain: String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || ''),
  projectId: String(import.meta.env.VITE_FIREBASE_PROJECT_ID || ''),
  storageBucket: String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || ''),
  messagingSenderId: String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''),
  appId: String(import.meta.env.VITE_FIREBASE_APP_ID || ''),
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured()) {
  validateFirebaseClientOptions(firebaseConfig);
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  try {
    db = initializeFirestore(app, {
      localCache: memoryLocalCache(),
    });
  } catch {
    db = getFirestore(app);
  }

  if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
    const { authEmulatorUrl, firestoreEmulatorHost, firestoreEmulatorPort } =
      FIREBASE_RUNTIME_CONFIG.emulators;
    connectAuthEmulator(auth, authEmulatorUrl);
    connectFirestoreEmulator(db, firestoreEmulatorHost, firestoreEmulatorPort);
  }
}


export { app, auth, db };
