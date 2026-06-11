import { create } from "zustand";

export type WorkspaceView = "deck" | "ask" | "prizes" | "compare";

interface UiState {
  activeView: WorkspaceView;
  setActiveView: (view: WorkspaceView) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  activeView: "deck",
  setActiveView: (activeView) => set({ activeView }),
}));
