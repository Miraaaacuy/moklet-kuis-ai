"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

/** Client Supabase di browser — dipakai di halaman guru (dilindungi RLS). */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
