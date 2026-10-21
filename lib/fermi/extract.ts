import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { FermiExtractionSchema, type FermiExtraction } from "./schema";
import { prepareForVision } from "@/lib/krillion/image";
import { EXTRACTION_MODEL, ExtractionError } from "@/lib/krillion/extract";

const SYSTEM = `You read a Fermi (fermi.gg) result card screenshot.
- The card shows "Fermi No. NNN - <date>", a big SCORE like "4.09×", a "TOP NN%" pill, a histogram (ignore it) and a QUESTIONS list where each question has a multiplier on its right.
- Copy values exactly as printed. questionText is the full question as printed (it may wrap onto several lines; join them). If a question's text is cut off on the card, return what is visible.
- If a value on the right has a "<" in front of it, set lessThan=true and still give the number. Do not interpret what "<" means.
- gameDate only if a calendar date is printed (convert to YYYY-MM-DD), else null. Never guess.
- Never invent questions, values or percentages. Use null if something isn't visible.`;

const TOOL = { name: "record_fermi_result", description: "Record the Fermi card contents.", input_schema: z.toJSONSchema(FermiExtractionSchema, { io: "input" }) as Anthropic.Tool.InputSchema };

export async function extractFermi(image: Buffer, client?: Anthropic): Promise<FermiExtraction> {
  const c = client ?? (process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null);
  if (!c) throw new ExtractionError("ANTHROPIC_API_KEY is not configured.");
  const img = await prepareForVision(image);
  const res = await c.messages.create({
    model: EXTRACTION_MODEL, max_tokens: 2000, system: SYSTEM, tools: [TOOL], tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } }, { type: "text", text: "Extract this Fermi result." }] }],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new ExtractionError("The model returned no structured result.");
  const parsed = FermiExtractionSchema.safeParse(block.input);
  if (!parsed.success) throw new ExtractionError(`Extraction failed schema validation: ${parsed.error.message}`);
  return parsed.data;
}
