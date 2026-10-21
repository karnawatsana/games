import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const safe = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");

/**
 * Server Components can't write cookies, so an expired access token can't be refreshed there.
 * Route handlers can: getSession() refreshes with the refresh token and persists the new cookies.
 * Tried once per navigation (r=1) to avoid loops, then falls through to /login.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safe(url.searchParams.get("next"));
  const tried = url.searchParams.get("r") === "1";
  if (!tried) {
    try {
      const sb = await createClient();
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        const { data: { user } } = await sb.auth.getUser();
        if (user) return NextResponse.redirect(new URL(next, url.origin));
      }
    } catch { /* fall through to login */ }
  }
  return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url.origin));
}
