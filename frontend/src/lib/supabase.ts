import { createClient } from '@supabase/supabase-js';
import WebSocket from 'isomorphic-ws';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    !supabaseUrl.includes('your-project-ref') &&
    !supabaseUrl.includes('placeholder-project') &&
    supabaseUrl.startsWith('https://')
  );
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
  },
  global: {
    WebSocket: WebSocket,
  },
  realtime: {
    transport: WebSocket,
  },
});
