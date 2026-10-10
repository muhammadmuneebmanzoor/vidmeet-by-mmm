import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  firebaseUpdateProfile,
  sendPasswordResetEmail,
  isFirebaseConfigured,
  type FirebaseUser,
} from '../lib/firebase';
import { DbProfile } from '../db/schema';

export interface UserSession {
  access_token: string;
  user: {
    id: string;
    email: string | null;
    user_metadata: {
      name?: string;
      avatar_url?: string | null;
    };
  };
}

export interface UserMetadata {
  name?: string;
  avatar_url?: string | null;
}

export interface AppUser {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  user_metadata: UserMetadata;
}

interface AuthContextType {
  user: AppUser | null;
  session: UserSession | null;
  profile: DbProfile | null;
  loading: boolean;
  isConfigured: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: { name?: string; avatar_url?: string }) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const createProfileFromUser = (u: FirebaseUser, providedName?: string): DbProfile => {
  const name = providedName || u.displayName || u.email?.split('@')[0] || 'User';
  return {
    id: u.uid,
    email: u.email || '',
    name,
    avatar_url: u.photoURL || null,
    role: 'user',
    created_at: u.metadata?.creationTime || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize and persist session on mount with Firebase
  useEffect(() => {
    let mounted = true;

    // Check if returning from redirect flow
    getRedirectResult(auth).catch((err) => {
      console.warn('Firebase redirect result:', err);
    });

    const unsubscribe = onAuthStateChanged(
      auth,
      async (fbUser) => {
        if (!mounted) return;

        if (fbUser) {
          try {
            const token = await fbUser.getIdToken();
            const userObj: AppUser = {
              id: fbUser.uid,
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName,
              photoURL: fbUser.photoURL,
              user_metadata: {
                name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
                avatar_url: fbUser.photoURL || null,
              },
            };
            const sessionObj: UserSession = {
              access_token: token,
              user: userObj,
            };
            const profileObj = createProfileFromUser(fbUser);

            setUser(userObj);
            setSession(sessionObj);
            setProfile(profileObj);
          } catch (tokenErr) {
            console.warn('Error retrieving Firebase ID token:', tokenErr);
          }
        } else {
          setUser(null);
          setSession(null);
          setProfile(null);
        }

        setLoading(false);
      },
      (error) => {
        console.warn('Firebase auth state error:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Sign up with Email and Password
  const signUp = async (email: string, password: string, name: string) => {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      if (name && res.user) {
        await firebaseUpdateProfile(res.user, { displayName: name });
      }

      const fbUser = res.user;
      const token = await fbUser.getIdToken();
      const userObj: AppUser = {
        id: fbUser.uid,
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: name || fbUser.displayName,
        photoURL: fbUser.photoURL,
        user_metadata: {
          name: name || fbUser.displayName || email.split('@')[0] || 'User',
          avatar_url: fbUser.photoURL || null,
        },
      };

      setUser(userObj);
      setSession({ access_token: token, user: userObj });
      setProfile(createProfileFromUser(fbUser, name));

      return { error: null };
    } catch (err: any) {
      let msg = err.message;
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email address already exists. Please log in instead.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      return { error: new Error(msg) };
    }
  };

  // Sign in with Email and Password
  const signIn = async (email: string, password: string) => {
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      const fbUser = res.user;
      const token = await fbUser.getIdToken();
      const userObj: AppUser = {
        id: fbUser.uid,
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName,
        photoURL: fbUser.photoURL,
        user_metadata: {
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
          avatar_url: fbUser.photoURL || null,
        },
      };

      setUser(userObj);
      setSession({ access_token: token, user: userObj });
      setProfile(createProfileFromUser(fbUser));

      return { error: null };
    } catch (err: any) {
      let msg = err.message;
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        msg = 'Invalid email or password. Please try again.';
      } else if (err.code === 'auth/user-not-found') {
        msg = 'No user account found with this email.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Access temporarily disabled due to many failed attempts. Try again later.';
      }
      return { error: new Error(msg) };
    }
  };

  // Sign in with Google OAuth via Firebase
  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const token = await fbUser.getIdToken();
      const userObj: AppUser = {
        id: fbUser.uid,
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName,
        photoURL: fbUser.photoURL,
        user_metadata: {
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
          avatar_url: fbUser.photoURL || null,
        },
      };

      setUser(userObj);
      setSession({ access_token: token, user: userObj });
      setProfile(createProfileFromUser(fbUser));

      return { error: null };
    } catch (err: any) {
      console.error('Firebase Google sign-in note:', err);
      if (err.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, googleProvider);
          return { error: null };
        } catch {
          return {
            error: new Error(
              'Google popup was blocked by browser. Please allow popups or try again.'
            ),
          };
        }
      }
      if (err.code === 'auth/unauthorized-domain') {
        return {
          error: new Error(
            `Domain (${window.location.hostname}) is not authorized yet. Please add it to Firebase Console -> Authentication -> Settings -> Authorized domains.`
          ),
        };
      }
      if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        return { error: new Error('Google Sign-in was cancelled.') };
      }
      return { error: new Error(err.message || 'Google sign-in could not be completed.') };
    }
  };

  // Send password reset email
  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { error: null };
    } catch (err: any) {
      return { error: new Error(err.message || 'Failed to send password reset email.') };
    }
  };

  // Logout
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.warn('Sign out note:', err);
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  // Update authenticated profile
  const updateProfile = async (updates: { name?: string; avatar_url?: string }) => {
    if (!auth.currentUser) return { error: new Error('User is not authenticated') };

    try {
      await firebaseUpdateProfile(auth.currentUser, {
        displayName: updates.name,
        photoURL: updates.avatar_url,
      });

      setUser((prev) =>
        prev
          ? {
              ...prev,
              displayName: updates.name ?? prev.displayName,
              photoURL: updates.avatar_url ?? prev.photoURL,
              user_metadata: {
                ...prev.user_metadata,
                name: updates.name ?? prev.user_metadata.name,
                avatar_url: updates.avatar_url ?? prev.user_metadata.avatar_url,
              },
            }
          : null
      );

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              name: updates.name ?? prev.name,
              avatar_url: updates.avatar_url ?? prev.avatar_url,
              updated_at: new Date().toISOString(),
            }
          : null
      );

      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const refreshProfile = async () => {
    if (auth.currentUser) {
      setProfile(createProfileFromUser(auth.currentUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isConfigured: isFirebaseConfigured,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        updateProfile,
        refreshProfile,
        sendPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
