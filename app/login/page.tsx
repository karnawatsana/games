import { AuthForm } from "./AuthForm";

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/" } = await searchParams;
  return (
    <main className="page" style={{ maxWidth: 460, paddingBottom: 48 }}>
      <div className="brand" style={{ padding: "8px 4px 24px" }}><span className="brand-mark serif">3</span>The Daily 3</div>
      <h1 className="hero" style={{ fontSize: 52, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, padding: "0 4px 18px" }}>
        Welcome <em className="serif" style={{ color: "var(--lime)", fontWeight: 400 }}>back.</em>
      </h1>
      <AuthForm next={next} />
    </main>
  );
}
