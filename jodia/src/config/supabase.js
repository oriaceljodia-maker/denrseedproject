import { createClient } from '@supabase/supabase-js';

// Environment Variable Resolution (Vite / Netlify / Window Injection / Fallback)
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || window.ENV?.SUPABASE_URL || 'https://mxlfrjwoontxytwlvbia.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || window.ENV?.SUPABASE_ANON_KEY || 'sb_publishable_2DvIEE0B3XW1MV82jP6Aew_tH4V4Sqa';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing Supabase URL or Anon Key. Check your environment variables.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);