import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/", "/login", "/auth", "/preview"];

const isPublic = (path: string) => PUBLIC.some((p) => path === p || (p !== "/" && path.startsWith(p + "/")));

function configured(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  try { new URL(url); } catch { return null; }
  return { url, key };
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const cfg = configured();
  if (!cfg) {
    // Not configured (or misconfigured): only the public shell renders; everything else needs the database.
    return isPublic(path) ? NextResponse.next() : NextResponse.redirect(new URL("/", req.url));
  }
  try {
    let res = NextResponse.next({ request: req });
    const supabase = createServerClient(cfg.url, cfg.key, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (all) => {
          all.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          all.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    });
    const { data: { user } } = await supabase.auth.getUser(); // refreshes the session cookie
    if (!user && !isPublic(path)) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path + req.nextUrl.search);
      return NextResponse.redirect(url);
    }
    return res;
  } catch (e) {
    // Never take the whole site down because auth couldn't be reached. Public pages still render; others go to login.
    console.error("middleware auth check failed", e instanceof Error ? e.message : e);
    return isPublic(path) ? NextResponse.next() : NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"] };
