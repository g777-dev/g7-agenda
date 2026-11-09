import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://hconebxvwjiffnenwfpq.supabase.co';
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_8Tx5JEYOsy7uRALKelo1-A_tU6lbbX7';

export const supabaseConfigurado = Boolean(url && chave);

export const supabase = createClient(url || 'https://configure.supabase.co', chave || 'configure', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
