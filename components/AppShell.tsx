import BottomNav from "./BottomNav";

export default function AppShell({ title, eyebrow, children }: { title: React.ReactNode; eyebrow?: string; children: React.ReactNode }) {
  return (
    <>
      <main className="page" style={{ maxWidth: 760 }}>
        <header style={{ padding: "12px 4px 18px" }}>
          {eyebrow && <p className="datestamp" style={{ marginBottom: 6 }}>{eyebrow}</p>}
          <h1 style={{ fontSize: "clamp(40px, 9vw, 64px)", lineHeight: 1, fontWeight: 700, letterSpacing: "-0.04em" }}>{title}</h1>
        </header>
        <div className="grid gap-3">{children}</div>
      </main>
      <BottomNav />
    </>
  );
}
