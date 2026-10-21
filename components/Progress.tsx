export default function Progress({ done }: { done: number }) {
  const msg = ["Nothing yet. Pick one.", "One down.", "Two down. One to go.", "All three. Nicely done."][done];
  return (
    <section className="progress" aria-label={`${done} of 3 games completed`}>
      <div className="count">{done}<small>/3</small></div>
      <div style={{ flex: 1 }}>
        <div className="segs" aria-hidden>
          {[0, 1, 2].map((i) => <span key={i} className={`seg ${i < done ? "on" : ""}`} />)}
        </div>
        <p className="msg" style={{ marginTop: 8 }} aria-live="polite">{msg}</p>
      </div>
    </section>
  );
}
