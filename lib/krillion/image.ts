import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** Re-encode to a vision-friendly JPEG (<5MB, ≤2600px tall). The original is stored separately, untouched. */
export async function prepareForVision(buf: Buffer): Promise<{ data: string; mediaType: "image/jpeg" }> {
  const out = await sharp(buf, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 1400, height: 2800, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#000" })
    .jpeg({ quality: 88 })
    .toBuffer();
  return { data: out.toString("base64"), mediaType: "image/jpeg" };
}
