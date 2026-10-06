import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import { getAnalytics, initializeAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { cleanupBrowserStorage } from '../storage/storageCleanup';
import {
  FIREBASE_RUNTIME_CONFIG,
  validateFirebaseClientOptions,
  type FirebaseClientOptions,
} from './firebaseRuntimeConfig';
import { ANALYTICS_CONFIG, validateMeasurementId } from './analyticsConfig';

// Purge any leaked or orphaned firestore_ keys from previous persistentMultipleTabManager sessions
cleanupBrowserStorage();

export function isFirebaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID
  );
}

const rawMeasurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;

const firebaseConfig: FirebaseClientOptions = {
  apiKey: String(import.meta.env.VITE_FIREBASE_API_KEY || ''),
  authDomain: String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || ''),
  projectId: String(import.meta.env.VITE_FIREBASE_PROJECT_ID || ''),
  storageBucket: String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || ''),
  messagingSenderId: String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''),
  appId: String(import.meta.env.VITE_FIREBASE_APP_ID || ''),
  ...(typeof rawMeasurementId === 'string' && rawMeasurementId.trim().length > 0
    ? { measurementId: rawMeasurementId.trim() }
    : {}),
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

// Memoized single-flight initialization: every caller awaits the same promise (O(1) after first call).
let analyticsInitPromise: Promise<Analytics | null> | null = null;

/**
 * Lazily initializes Firebase Analytics with privacy settings from ANALYTICS_CONFIG.
 * Resolves `null` when analytics is disabled, Firebase is unconfigured, or the
 * environment is unsupported (SSR/tests, cookies/IndexedDB blocked).
 */
export function initAnalytics(): Promise<Analytics | null> {
  if (analyticsInitPromise) return analyticsInitPromise;

  const firebaseApp = app;
  if (!ANALYTICS_CONFIG.enabled || !firebaseApp || typeof window === 'undefined') {
    return Promise.resolve(null);
  }

  const { sendDefaultPageView, allowGoogleSignals, allowAdPersonalizationSignals } = ANALYTICS_CONFIG.privacy;

  analyticsInitPromise = isSupported()
    .then((supported) => {
      if (!supported) return null;
      try {
        return initializeAnalytics(firebaseApp, {
          config: {
            send_page_view: sendDefaultPageView,
            allow_google_signals: allowGoogleSignals,
            allow_ad_personalization_signals: allowAdPersonalizationSignals,
          },
        });
      } catch {
        // Already initialized for this app (e.g. HMR module re-evaluation reusing getApps()[0])
        return getAnalytics(firebaseApp);
      }
    })
    .catch((err: unknown) => {
      console.warn('Firebase Analytics unavailable in this environment:', err);
      return null;
    });

  return analyticsInitPromise;
}

if (isFirebaseConfigured()) {
  validateFirebaseClientOptions(firebaseConfig);
  if (ANALYTICS_CONFIG.enabled) {
    validateMeasurementId(firebaseConfig.measurementId);
  }

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

  // Warm up analytics off the critical path so the first page_view dispatches without delay
  void initAnalytics();
}

export { app, auth, db };
