import "server-only";
import { redirect } from "next/navigation";
import { getViewer } from "./data";
import { supabaseConfigured } from "./supabase/env";

/**
 * Page-level auth gate (does not depend on middleware). Call at the top of every protected page.
 * - Not configured: back to the public home page.
 * - No valid session: try a cookie refresh once (route handlers may set cookies), then the login page.
 */
export async function requireViewer(path: string) {
  if (!supabaseConfigured()) redirect("/");
  const v = await getViewer();
  if (v) return v;
  redirect(`/auth/refresh?next=${encodeURIComponent(path)}`);
}
