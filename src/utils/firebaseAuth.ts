import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, User } from 'firebase/auth';

// Read Firebase config from environment or default from firebase-applet-config
const firebaseConfig = {
  projectId: "centering-exchanger-t07pf",
  appId: "1:230399945155:web:265dc8720ec5eda8f1f576",
  apiKey: "AIzaSyC359DNeotoo8zJzKy5JF9HuKXDQmnMID8",
  authDomain: "centering-exchanger-t07pf.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-192f3d82-aca3-46d1-8f56-b6dcd4d6e218",
  storageBucket: "centering-exchanger-t07pf.firebasestorage.app",
  messagingSenderId: "230399945155"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export interface GoogleAuthResult {
  email: string;
  displayName: string;
  photoURL?: string;
  uid: string;
}

/**
 * Sign in with Google Account popup.
 * Returns the authenticated user's email, name, and uid.
 */
export async function loginWithGooglePopup(): Promise<GoogleAuthResult> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user: User = result.user;
    if (!user.email) {
      throw new Error('Google account did not provide an email address.');
    }
    return {
      email: user.email.toLowerCase(),
      displayName: user.displayName || user.email.split('@')[0],
      photoURL: user.photoURL || undefined,
      uid: user.uid
    };
  } catch (error: any) {
    console.error('Firebase Google Sign-In Error:', error);
    // Provide clean readable error messages
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Google sign-in popup was closed before completion.');
    }
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Google popup was blocked by browser. Please allow popups for this site.');
    }
    if (error.code === 'auth/cancelled-popup-request') {
      throw new Error('Another sign-in popup is already open.');
    }
    throw new Error(error.message || 'Google authentication failed.');
  }
}
