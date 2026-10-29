import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn('Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Copia .env.example a .env.local.');
}

/**
 * Cliente de Supabase de solo lectura, con la clave anon. Lee exclusivamente
 * public.public_results; RLS impide ver eventos no publicados (sección 4.4 del prompt).
 */
export const supabasePublic = createClient(url || 'http://localhost', anonKey || 'anon');
