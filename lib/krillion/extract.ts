import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ExtractionSchema, type KrillionExtraction } from "./schema";
import { prepareForVision } from "./image";

export const EXTRACTION_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

const SYSTEM = `You extract a single player's Krillion results from a screenshot of the game's results screen.

Rules:
- The screenshot may show several players. Extract ONLY the player whose header block (rank like "#2", a handle, and a big total score) sits directly above the seven numbered rows you are extracting. Rows that appear ABOVE that header belong to a different player: ignore them. Set multiplePlayersVisible=true if you saw another player's rows or header.
- If a target handle is provided, prefer that player's block. If it isn't visible, still extract the block that is shown but report the handle you actually saw.
- Each row has: a row number (1-7), a prompt in small uppercase text, the player's answer in larger text beneath it, a small rarity icon on the left, and a points value on the right.
- Copy questionText and answerText EXACTLY as printed (keep original capitalisation of the answer; questionText may stay uppercase). Do not paraphrase, correct or complete them.
- points must be the number printed on the right of that row. totalScore is the large number in the player's header.
- rarityIndicator: a short visual description of the icon and its colour (e.g. "red squid icon"). Never invent a rarity name. Use null if you cannot see an icon.
- gameDate: only if a calendar date is literally printed in the image, as YYYY-MM-DD; otherwise null. gameId likewise only if literally printed. Never guess.
- If you cannot read something confidently, still give your best reading and set uncertain=true on that answer. If fewer than 7 rows are visible, return only the rows you can see. Never fabricate rows.
- Ignore status bars, ads, menus and any text that isn't part of the results.`;

const TOOL = {
  name: "record_krillion_result",
  description: "Record the extracted Krillion result for the one player.",
  input_schema: z.toJSONSchema(ExtractionSchema, { io: "input" }) as Anthropic.Tool.InputSchema,
};

export class ExtractionError extends Error {}

export async function extractKrillion(
  image: Buffer,
  opts: { expectedHandle?: string | null; client?: Anthropic } = {},
): Promise<KrillionExtraction> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const client = opts.client ?? (apiKey ? new Anthropic({ apiKey }) : null);
  if (!client) throw new ExtractionError("ANTHROPIC_API_KEY is not configured.");

  const img = await prepareForVision(image);
  const res = await client.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 3000,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } },
        { type: "text", text: opts.expectedHandle ? `Target player handle: @${opts.expectedHandle.replace(/^@/, "")}. Extract this player's result.` : "Extract the player's result." },
      ],
    }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new ExtractionError("The model returned no structured result.");
  const parsed = ExtractionSchema.safeParse(block.input);
  if (!parsed.success) throw new ExtractionError(`Extraction failed schema validation: ${parsed.error.message}`);
  return parsed.data;
}
