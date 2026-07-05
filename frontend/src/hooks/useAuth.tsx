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
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let realtimeChannel: any = null;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setGlobalAuthToken(session?.access_token ?? null);
      setLoading(false);
      
      // OPTIMIZATION 6: Global WebSockets
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
              // Automatically invalidate frontend caches so dashboard re-renders with fresh data natively!
              queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
              queryClient.invalidateQueries({ queryKey: ["leads"] });
            }
          )
          .subscribe();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
