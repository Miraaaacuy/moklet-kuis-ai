import Link from "next/link";
import { signOut } from "../actions";
import { requireTeacher } from "@/lib/supabase/server";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireTeacher();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/guru" className="flex items-center gap-2 text-lg font-black">
            <span aria-hidden>🤖</span> Kuis AI <span className="text-sm font-bold text-muted">· Guru</span>
          </Link>
          <div className="flex items-center gap-3 text-sm font-semibold">
            <span className="hidden text-muted sm:inline">{user.email}</span>
            <form action={signOut}>
              <button className="rounded-lg px-3 py-1.5 text-muted hover:bg-canvas hover:text-ink">Keluar</button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}
