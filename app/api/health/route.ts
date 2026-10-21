import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Deployment self-check. Reports presence/shape only, never values. Safe to leave public. */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const jwtShape = (k: string) => k.trim().split(".").length === 3;
  let host: string | null = null, urlOk = false;
  try { host = new URL(url.trim()).host; urlOk = true; } catch { /* reported below */ }

  let reach: string = "skipped";
  if (urlOk && anon) {
    try {
      const r = await fetch(`${url.trim()}/auth/v1/health`, { headers: { apikey: anon.trim() }, signal: AbortSignal.timeout(8000) });
      reach = `HTTP ${r.status}`;
    } catch (e) { reach = `failed: ${e instanceof Error ? e.message : "unknown"}`; }
  }
  return NextResponse.json({
    supabaseUrl: { set: !!url, valid: urlOk, host, hasWhitespaceOrQuotes: url !== url.trim() || /["']/.test(url), expectedHost: "kfstsvtfzhhoiidpewdm.supabase.co" },
    anonKey: { set: !!anon, looksLikeJwt: jwtShape(anon), hasWhitespaceOrQuotes: anon !== anon.trim() || /["']/.test(anon) },
    serviceRoleKey: { set: !!svc, looksLikeJwt: jwtShape(svc), sameAsAnon: !!svc && svc === anon },
    anthropicKeySet: !!process.env.ANTHROPIC_API_KEY,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
    supabaseAuthReachable: reach,
    node: process.version,
  });
}
