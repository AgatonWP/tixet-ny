import { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  initializing: boolean;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    profile?: { fullName?: string; phoneNumber?: string },
  ) => Promise<{ userId: string; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setInitializing(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      initializing,
      session,
      user: session?.user ?? null,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          throw new Error(error.message);
        }
      },
      async signUp(email, password, profile) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: Linking.createURL('/'),
            data: {
              full_name: profile?.fullName || undefined,
              phone_number: profile?.phoneNumber || undefined,
            },
          },
        });

        if (error) {
          throw new Error(error.message);
        }
        if (!data.user) {
          throw new Error('Kunde inte skapa kontot.');
        }

        // With "Confirm email" enabled in Supabase, signUp succeeds but
        // returns no session until the user clicks the emailed link.
        return { userId: data.user.id, needsEmailConfirmation: !data.session };
      },
      async signOut() {
        const { error } = await supabase.auth.signOut();

        if (error) {
          throw new Error(error.message);
        }
      },
    }),
    [initializing, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
