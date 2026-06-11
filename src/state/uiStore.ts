import { create } from "zustand";

export type WorkspaceView = "deck" | "ask" | "prizes" | "compare";
export type AskTab = "q1" | "q2";

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
