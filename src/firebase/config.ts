import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  ConfirmationResult,
  PhoneAuthProvider,
  signInWithCredential
} from 'firebase/auth';

/**
 * Firebase Client Configuration
 * Uses environment variables with fallback to window runtime config
 */
export const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || (window as any)?.__FIREBASE_CONFIG__?.apiKey || '',
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || (window as any)?.__FIREBASE_CONFIG__?.authDomain || '',
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || (window as any)?.__FIREBASE_CONFIG__?.projectId || '',
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || (window as any)?.__FIREBASE_CONFIG__?.storageBucket || '',
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || (window as any)?.__FIREBASE_CONFIG__?.messagingSenderId || '',
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || (window as any)?.__FIREBASE_CONFIG__?.appId || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.apiKey !== '' && firebaseConfig.projectId && firebaseConfig.projectId !== ''
);

// Initialize Firebase App
export const app = getApps().length > 0 
  ? getApp() 
  : isFirebaseConfigured 
    ? initializeApp(firebaseConfig) 
    : null;

// Initialize Firebase Auth
export const auth = app ? getAuth(app) : null;
