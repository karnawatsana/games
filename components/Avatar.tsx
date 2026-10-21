const tints = ["var(--lime)", "var(--butter, #ffd16a)", "var(--coral)", "var(--mint)", "var(--sky)", "var(--lavender)"];
export const tint = (s: string) => tints[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % tints.length];

export default function Avatar({ name, url, size = 40, id }: { name: string; url?: string; size?: number; id?: string }) {
  if (url) /* eslint-disable-next-line @next/next/no-img-element */ return <img src={url} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} />;
  return <span className="pfp" aria-hidden style={{ width: size, height: size, background: tint(id ?? name), fontSize: size * 0.36 }}>{name[0]?.toUpperCase()}</span>;
}
