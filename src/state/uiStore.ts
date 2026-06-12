import { create } from "zustand";

export type WorkspaceView = "deck" | "trial" | "ask" | "prizes" | "compare" | "trainer" | "tracker";
export type AskTab = "q1" | "q2" | "curve" | "grade" | "tools";

interface UiState {
  activeView: WorkspaceView;
  askTab: AskTab;
  setActiveView: (view: WorkspaceView) => void;
  setAskTab: (tab: AskTab) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  activeView: "deck",
  askTab: "q1",
  setActiveView: (activeView) => set({ activeView }),
  setAskTab: (askTab) => set({ askTab }),
}));
