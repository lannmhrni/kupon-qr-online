import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.warn("Supabase belum dikonfigurasi. Isi file .env atau Environment Variables Vercel.");
}

export const supabase = createClient(url || "https://placeholder.supabase.co", key || "placeholder-key");
