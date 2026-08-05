import { createClient } from '@supabase/supabase-js';

// Environment Variable Resolution (Vite / Netlify / Window Injection / Fallback)
//
// The project exposes these env vars (see .env / Netlify):
//   SUPABASE_URL
//   SUPABASE_PUBLISHABLE_KEY  (the anon / publishable key for the browser)
//   SUPABASE_SECRET_KEY       (service_role key - NEVER use in the browser!)
//   SUPABASE_JWKS_URL
//
// Vite only exposes variables prefixed with VITE_ to the client, so we map
// the plain names to the Vite-prefixed ones. We read them from window.ENV
// (for Netlify runtime injection) and fall back to bundled values.
const SUPABASE_URL =
  import.meta.env?.SUPABASE_URL ||
  import.meta.env?.VITE_SUPABASE_URL ||
  window.ENV?.SUPABASE_URL ||
  'https://mxlfrjwoontxytwlvbia.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env?.SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env?.VITE_SUPABASE_ANON_KEY ||
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  window.ENV?.SUPABASE_PUBLISHABLE_KEY ||
  window.ENV?.SUPABASE_ANON_KEY ||
  'sb_publishable_2DvIEE0B3XW1MV82jP6Aew_tH4V4Sqa';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing Supabase URL or Anon Key. Check your environment variables.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
