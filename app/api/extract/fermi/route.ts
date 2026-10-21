import { NextResponse } from "next/server";
import { guardExtraction } from "@/lib/extraction/guard";
import { extractFermi } from "@/lib/fermi/extract";
import { ExtractionError } from "@/lib/krillion/extract";
import { checkFermi } from "@/lib/fermi/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const g = await guardExtraction(req);
  if ("res" in g) return g.res;
  try {
    const extraction = await extractFermi(g.ok.buf);
    return NextResponse.json({ extraction, warnings: checkFermi(extraction), storagePath: g.ok.storagePath });
  } catch (e) {
    return NextResponse.json({ error: (e instanceof ExtractionError ? e.message : "We couldn't read that card.") + " You can paste the share text instead." }, { status: 502 });
  }
}
