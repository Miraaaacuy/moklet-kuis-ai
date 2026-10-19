import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAnonKey, supabaseUrl } from "./env";

/** Client Supabase di server dengan sesi login guru (dilindungi RLS). */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Dipanggil dari Server Component — refresh sesi ditangani middleware.
        }
      },
    },
  });
}

/** Pastikan guru sudah login; kalau belum, arahkan ke halaman login. */
export async function requireTeacher() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/guru/login");
  return { supabase, user };
}
