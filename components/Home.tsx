import BottomNav from "./BottomNav";
import Header from "./Header";
import Progress from "./Progress";
import GameCard from "./GameCard";
import MysteryCard from "./MysteryCard";
import FriendsPreview from "./FriendsPreview";
import type { DailyState } from "@/lib/types";

export default function HomeView({ state, onReveal }: { state: DailyState; onReveal?: () => Promise<void> }) {
  const done = [state.krillion, state.fermi, state.mystery.result].filter((r) => r.completed).length;
  return (
    <>
      <main className="page">
        <Header state={state} />
        <div className="page-grid">
          <section className="hero area-hero">
            <h1>Ready for your daily <em>three?</em></h1>
            <p>Two favorites, one surprise. Play, log your result, and see how the group did.</p>
          </section>
          <div className="area-progress"><Progress done={done} /></div>
          <div className="area-games">
            <GameCard index={1} name="Krillion" slug="krillion" url="https://krillion.io/" color="coral" result={state.krillion}
              tagline="Seven prompts. Rarer answers earn more." tags={["Trivia", "~5 min"]} />
            <GameCard index={2} name="Fermi" slug="fermi" url="https://fermi.gg/" color="butter" result={state.fermi}
              tagline="Estimate the unknowable. Closer is better." tags={["Estimation", "~5 min"]} />
            <MysteryCard mystery={state.mystery} signedIn={!!state.user} onReveal={onReveal} />
          </div>
          <div className="area-friends"><FriendsPreview groups={state.groups} signedIn={!!state.user} /></div>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
