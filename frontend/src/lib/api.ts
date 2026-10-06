import { supabase } from './supabase';

let globalAuthToken: string | null = null;

export const setGlobalAuthToken = (token: string | null) => {
  globalAuthToken = token;
};

export const apiFetch = async (url: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers || {});
  
  if (globalAuthToken) {
    headers.set('Authorization', `Bearer ${globalAuthToken}`);
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
};
