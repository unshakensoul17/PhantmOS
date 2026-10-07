import React, { createContext, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { setGlobalAuthToken } from "../lib/api";

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
    const initAuth = async () => {
      // 1. Check existing Supabase session first
      try {
        const {
          data: { session: existingSession },
        } = await supabase.auth.getSession();
        if (existingSession?.user) {
          setSession(existingSession);
          setUser(existingSession.user);
          setGlobalAuthToken(existingSession.access_token);
          setLoading(false);
          return;
        }
      } catch {
        // Fallback to Telegram auth
      }

      // 2. Seamless zero-click authentication for Telegram Mini App users
      try {
        const tg = (window as any).Telegram?.WebApp;
        const initData = tg?.initData;
        const tgUser = tg?.initDataUnsafe?.user;

        if (initData || tgUser) {
          const res = await fetch("/api/auth/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              init_data: initData || "",
              user_id: tgUser?.id ? String(tgUser.id) : "",
            }),
          });

          if (res.ok) {
            const authData = await res.json();
            if (authData.access_token) {
              setGlobalAuthToken(authData.access_token);
              const syntheticUser = {
                id: authData.user_id,
                email: authData.email || "telegram-user@phantmos.ai",
                user_metadata: authData.user_metadata || {},
              } as any;
              setUser(syntheticUser);
              setSession({ access_token: authData.access_token, user: syntheticUser } as any);
              setLoading(false);
              return;
            }
          }
        }
      } catch (tgErr) {
        console.warn("Telegram auto-auth check failed:", tgErr);
      }

      setLoading(false);
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setGlobalAuthToken(session?.access_token ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
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
