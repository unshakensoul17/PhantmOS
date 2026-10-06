import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { setGlobalAuthToken } from '../lib/api';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  guestLogin: () => void;
}

const GUEST_USER = {
  id: '00000000-0000-0000-0000-000000000000',
  app_metadata: {},
  user_metadata: { name: 'Commander Demo' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email: 'demo@phantmos.ai',
  role: 'authenticated',
} as unknown as User;

const GUEST_SESSION = {
  access_token: 'guest-demo-token',
  token_type: 'bearer',
  expires_in: 86400,
  refresh_token: 'guest-refresh-token',
  user: GUEST_USER,
} as unknown as Session;

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
  guestLogin: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const guestLogin = () => {
    localStorage.setItem('phantmos_guest', 'true');
    setSession(GUEST_SESSION);
    setUser(GUEST_USER);
    setGlobalAuthToken('guest-demo-token');
    setLoading(false);
  };

  useEffect(() => {
    if (localStorage.getItem('phantmos_guest') === 'true') {
      setSession(GUEST_SESSION);
      setUser(GUEST_USER);
      setGlobalAuthToken('guest-demo-token');
      setLoading(false);
      return;
    }

    let realtimeChannel: any = null;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setGlobalAuthToken(session?.access_token ?? null);
      setLoading(false);
      
      // Global WebSockets
      if (session?.user && !realtimeChannel) {
        realtimeChannel = supabase.channel('dashboard-realtime')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'user_job_pipelines',
              filter: `user_id=eq.${session.user.id}`
            },
            () => {
              queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
              queryClient.invalidateQueries({ queryKey: ["leads"] });
            }
          )
          .subscribe();
      }
    }).catch(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (localStorage.getItem('phantmos_guest') === 'true') return;
      setSession(session);
      setUser(session?.user ?? null);
      setGlobalAuthToken(session?.access_token ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [queryClient]);

  const signOut = async () => {
    localStorage.removeItem('phantmos_guest');
    setSession(null);
    setUser(null);
    setGlobalAuthToken(null);
    try {
      await supabase.auth.signOut();
    } catch (_) {}
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut, guestLogin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
