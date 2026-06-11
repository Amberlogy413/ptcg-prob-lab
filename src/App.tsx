import { useEffect } from "react";
import { TopNav } from "./components/TopNav.tsx";
import { Footer } from "./components/Footer.tsx";
import { DeckSummary } from "./components/DeckSummary.tsx";
import { DeckView } from "./views/DeckView.tsx";
import { AskView } from "./views/AskView.tsx";
import { PrizesView } from "./views/PrizesView.tsx";
import { PlaceholderView } from "./views/PlaceholderView.tsx";
import { useUiStore } from "./state/uiStore.ts";
import { useSettingsStore } from "./state/settingsStore.ts";

export default function App() {
  const activeView = useUiStore((s) => s.activeView);
  const locale = useSettingsStore((s) => s.locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-6 px-4 py-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <DeckSummary />
        <div className="min-w-0">
          {activeView === "deck" && <DeckView />}
          {activeView === "ask" && <AskView />}
          {activeView === "prizes" && <PrizesView />}
          {activeView === "compare" && (
            <PlaceholderView titleKey="view.compare.title" descKey="view.compare.desc" />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
