import { useEffect, useState } from "react";
import { TopNav } from "./components/TopNav.tsx";
import { Footer } from "./components/Footer.tsx";
import { DeckSummary } from "./components/DeckSummary.tsx";
import { DeckView } from "./views/DeckView.tsx";
import { AskView } from "./views/AskView.tsx";
import { PrizesView } from "./views/PrizesView.tsx";
import { CompareView } from "./views/CompareView.tsx";
import { TrainerView, LuckMeter, FallacyMuseum } from "./views/TrainerView.tsx";
import { TrackerView } from "./views/TrackerView.tsx";
import { useUiStore } from "./state/uiStore.ts";
import { useSettingsStore } from "./state/settingsStore.ts";
import { useDeckStore } from "./state/deckStore.ts";
import { useQueryStore } from "./state/queryStore.ts";
import { useT } from "./i18n/index.ts";
import { decodeShare, SHARE_PREFIX } from "./utils/share.ts";

export default function App() {
  const t = useT();
  const activeView = useUiStore((s) => s.activeView);
  const locale = useSettingsStore((s) => s.locale);
  const [shareError, setShareError] = useState(false);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Share-URL intake (docs/03 §7): #/q=… imports the deck + query, then
  // clears the fragment. A bad payload shows a friendly error, never a crash.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith(SHARE_PREFIX)) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    const decoded = decodeShare(hash);
    if (!decoded.ok) {
      setShareError(true);
      return;
    }
    const p = decoded.payload;
    const deckId = useDeckStore
      .getState()
      .importDeck(p.deck.name, p.deck.cards.map((c) => ({ name: c.name, count: c.count, isBasic: c.isBasic })));
    const deck = useDeckStore.getState().decks.find((d) => d.id === deckId);
    if (!deck) return;
    const tracked = p.query.tracked.flatMap((q) => {
      const card = deck.cards.find((c) => c.name === q.name);
      return card ? [{ cardId: card.id, kind: q.kind, n: q.n, a: q.a, b: q.b }] : [];
    });
    useQueryStore.setState({ tracked, mulliganAware: p.query.mulliganAware });
    useUiStore.getState().setAskTab("q2");
    useUiStore.getState().setActiveView("ask");
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      {shareError && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-3">
          <p
            role="alert"
            className="flex items-center justify-between rounded-ctl border border-bad px-3 py-2 text-sm text-bad"
          >
            {t("share.error")}
            <button
              type="button"
              onClick={() => setShareError(false)}
              aria-label={t("common.cancel")}
              className="ml-3 text-ink2 hover:text-ink"
            >
              ✕
            </button>
          </p>
        </div>
      )}
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-6 px-4 py-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <DeckSummary />
        <div className="min-w-0">
          {activeView === "deck" && <DeckView />}
          {activeView === "ask" && <AskView />}
          {activeView === "prizes" && <PrizesView />}
          {activeView === "compare" && <CompareView />}
          {activeView === "trainer" && (
            <>
              <TrainerView />
              <LuckMeter />
              <FallacyMuseum />
            </>
          )}
          {activeView === "tracker" && <TrackerView />}
        </div>
      </main>
      <Footer />
    </div>
  );
}
