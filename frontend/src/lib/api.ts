import { supabase } from "./supabase";

let globalAuthToken: string | null = null;

export const setGlobalAuthToken = (token: string | null) => {
  globalAuthToken = token;
};

export const getAuthToken = async (): Promise<string | null> => {
  if (globalAuthToken) {
    return globalAuthToken;
  }
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || null;
    if (token) {
      globalAuthToken = token;
    }
    return token;
  } catch {
    return null;
  }
};

export const apiFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(options.headers || {});

  const token = await getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let res = await fetch(url, {
    ...options,
    headers,
  });

  // If 401 Unauthorized, refresh the session and retry once
  if (res.status === 401) {
    try {
      globalAuthToken = null;
      const { data } = await supabase.auth.refreshSession();
      const freshToken = data.session?.access_token || null;
      if (freshToken) {
        globalAuthToken = freshToken;
        const retryHeaders = new Headers(options.headers || {});
        retryHeaders.set("Authorization", `Bearer ${freshToken}`);
        res = await fetch(url, {
          ...options,
          headers: retryHeaders,
        });
      }
    } catch {
      // Refresh failed, return original 401 response
    }
  }

  return res;
};
