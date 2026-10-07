import { supabase } from './supabase';

let globalAuthToken: string | null = null;

export const setGlobalAuthToken = (token: string | null) => {
  globalAuthToken = token;
};

export const apiFetch = async (url: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers || {});
  
  let token = globalAuthToken;
  if (!token) {
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token || null;
      if (token) {
        globalAuthToken = token;
      }
    } catch {
      // Ignore session fetch errors on unauthenticated requests
    }
  }
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
};
