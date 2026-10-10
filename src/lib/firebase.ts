import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as firebaseUpdateProfile,
  sendPasswordResetEmail,
  type User as FirebaseUser,
} from 'firebase/auth';

const rawApiKey = (import.meta.env.VITE_FIREBASE_API_KEY || '').trim();
const isPlaceholderKey =
  !rawApiKey ||
  rawApiKey.includes('your-') ||
  rawApiKey.includes('placeholder') ||
  !rawApiKey.startsWith('AIza');

export const firebaseConfig = {
  apiKey: isPlaceholderKey ? 'AIzaSyDqHlyyfn30XDkuajl6_uUzIY3XepAiek8' : rawApiKey,
  authDomain:
    !import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN.includes('your-')
      ? 'vidmeet-by-mmm.firebaseapp.com'
      : import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:
    !import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    import.meta.env.VITE_FIREBASE_PROJECT_ID.includes('your-')
      ? 'vidmeet-by-mmm'
      : import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:
    !import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET.includes('your-')
      ? 'vidmeet-by-mmm.firebasestorage.app'
      : import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    !import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID.includes('your-')
      ? '923165872179'
      : import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:
    !import.meta.env.VITE_FIREBASE_APP_ID ||
    import.meta.env.VITE_FIREBASE_APP_ID.includes('your-')
      ? '1:923165872179:web:3a53bd1c1bc80624141346'
      : import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey.startsWith('AIza')
);

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  firebaseUpdateProfile,
  sendPasswordResetEmail,
  type FirebaseUser,
};
