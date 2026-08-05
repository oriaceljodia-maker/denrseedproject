import { createClient } from '@supabase/supabase-js';


const SUPABASE_URL =
  import.meta.env?.SUPABASE_URL ||
  import.meta.env?.VITE_SUPABASE_URL ||
  window.ENV?.SUPABASE_URL;

const SUPABASE_ANON_KEY =
  import.meta.env?.SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env?.VITE_SUPABASE_ANON_KEY ||
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  window.ENV?.SUPABASE_PUBLISHABLE_KEY ||
  window.ENV?.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing Supabase URL or Anon Key. Check your environment variables.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
