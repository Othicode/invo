import { createClient } from '@supabase/supabase-js';

// Support both Vite (import.meta.env) and Node.js (process.env)
let supabaseUrl = '';
let supabaseAnonKey = '';

try {
  // Vite environment
  // @ts-ignore
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  // @ts-ignore
  supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
} catch (e) {
  // Node.js / Vercel environment
  // @ts-ignore
  supabaseUrl = typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL || '' : '';
  // @ts-ignore
  supabaseAnonKey = typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY || '' : '';
}

// For local testing without environment variables, use placeholder values
// to prevent the Supabase client from crashing the app
const finalUrl = supabaseUrl || 'https://placeholder-project.supabase.co';
const finalKey = supabaseAnonKey || 'placeholder-key';

export const isMock = !supabaseUrl || !supabaseAnonKey;

if (isMock) {
  console.warn('Supabase URL or Anon Key is missing. Using placeholder values for local testing.');
}

export const supabase = createClient(finalUrl, finalKey);
