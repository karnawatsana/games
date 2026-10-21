import Link from "next/link";
import { Flame } from "./Icons";
import { prettyDate } from "@/lib/dates";
import type { DailyState } from "@/lib/types";

export default function Header({ state }: { state: DailyState }) {
  const u = state.user;
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark serif" aria-hidden>3</span>
        <div>
          <div>The Daily 3</div>
          <div className="datestamp">{prettyDate(state.date)}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {u && (
          <span className="streak-pill" title="Current streak">
            <Flame size={16} /> {u.streak}
          </span>
        )}
        {u ? (
          <Link href="/profile" className="avatar" aria-label="Your profile">{u.name[0]?.toUpperCase()}</Link>
        ) : (
          <Link href="/login" className="btn" style={{ height: 40, padding: "0 16px", background: "var(--cream)", color: "var(--charcoal)" }}>Sign in</Link>
        )}
      </div>
    </header>
  );
}
