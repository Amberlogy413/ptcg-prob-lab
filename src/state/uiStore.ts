import { create } from "zustand";

export type WorkspaceView = "deck" | "trial" | "ask" | "prizes" | "compare" | "trainer" | "tracker";
export type AskTab = "q1" | "q2" | "curve" | "grade" | "tools";

interface UiState {
  activeView: WorkspaceView;
  askTab: AskTab;
  /** P8.4: regulation mark being previewed as rotated out (null = off). */
  rotationMark: string | null;
  setActiveView: (view: WorkspaceView) => void;
  setAskTab: (tab: AskTab) => void;
  setRotationMark: (mark: string | null) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  activeView: "deck",
  askTab: "q1",
  rotationMark: null,
  setActiveView: (activeView) => set({ activeView }),
  setAskTab: (askTab) => set({ askTab }),
  setRotationMark: (rotationMark) => set({ rotationMark }),
}));
