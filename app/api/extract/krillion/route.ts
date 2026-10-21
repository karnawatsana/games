import { NextResponse } from "next/server";
import { guardExtraction } from "@/lib/extraction/guard";
import { extractKrillion, ExtractionError } from "@/lib/krillion/extract";
import { validateExtraction } from "@/lib/krillion/validate";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const g = await guardExtraction(req);
  if ("res" in g) return g.res;
  const { buf, username, storagePath } = g.ok;
  try {
    const extraction = await extractKrillion(buf, { expectedHandle: username });
    return NextResponse.json({ extraction, issues: validateExtraction(extraction, { username }).issues, storagePath });
  } catch (e) {
    return NextResponse.json({ error: (e instanceof ExtractionError ? e.message : "We couldn't read that screenshot.") + " You can try again or enter the score by hand." }, { status: 502 });
  }
}
