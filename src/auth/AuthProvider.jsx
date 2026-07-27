import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';
import {
  signInWithPassword,
  signOutCurrentSession,
  signUpWithPassword,
} from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initializationError, setInitializationError] = useState(null);

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setInitializationError(null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setInitializationError(error);
      } else {
        setSession(data.session);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (credentials) => {
    const data = await signUpWithPassword(credentials);
    if (data.session) setSession(data.session);
    return data;
  }, []);

  const signIn = useCallback(async (credentials) => {
    const data = await signInWithPassword(credentials);
    setSession(data.session);
    return data;
  }, []);

  const signOut = useCallback(async () => {
    await signOutCurrentSession();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      initializationError,
      signUp,
      signIn,
      signOut,
    }),
    [initializationError, loading, session, signIn, signOut, signUp],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth は AuthProvider の内側で使用してください。');
  }
  return context;
}
