/**
 * Deck domain store (docs/03 §7). One Zustand store, persisted through a
 * custom PersistStorage that splits state across the spec-mandated keys:
 * ppl.v1.decks / ppl.v1.activeDeckId / ppl.v1.basicTags. The basicTags
 * dictionary is the global card-name → isBasic memory: tagging a name once
 * auto-fills every later occurrence (docs/03 §8).
 */

import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import { STORAGE_KEYS, readJSON, writeJSON, removeKey } from "../utils/storage.ts";
import { uid } from "../utils/uid.ts";

export type DeckSection = "pokemon" | "trainer" | "energy" | "unknown";

export interface DeckCard {
  id: string;
  name: string;
  count: number;
  /** Whether this card is a 基礎寶可夢 — the input to all mulligan math. */
  isBasic: boolean;
  section: DeckSection;
  /** Set code / collector number from PTCG Live import; kept, never used in math. */
  set?: string;
  number?: string;
}

export interface Deck {
  id: string;
  name: string;
  cards: DeckCard[];
  createdAt: number;
  updatedAt: number;
}

export interface NewCardInput {
  name: string;
  count: number;
  isBasic?: boolean;
  section?: DeckSection;
  set?: string;
  number?: string;
}

interface DeckPersisted {
  decks: Deck[];
  activeDeckId: string | null;
  basicTags: Record<string, boolean>;
}

interface DeckState extends DeckPersisted {
  createDeck: (name?: string) => string;
  renameDeck: (deckId: string, name: string) => void;
  deleteDeck: (deckId: string) => void;
  setActiveDeck: (deckId: string) => void;
  importDeck: (name: string, cards: NewCardInput[]) => string;
  addCard: (deckId: string) => void;
  updateCard: (deckId: string, cardId: string, patch: Partial<Omit<DeckCard, "id">>) => void;
  removeCard: (deckId: string, cardId: string) => void;
  rememberBasicTags: (tags: Record<string, boolean>) => void;
}

/** Split one store state across the three spec keys (docs/DECISIONS.md). */
const splitStorage: PersistStorage<DeckPersisted> = {
  getItem: () => {
    const decks = readJSON<Deck[]>(STORAGE_KEYS.decks);
    const activeDeckId = readJSON<string | null>(STORAGE_KEYS.activeDeckId);
    const basicTags = readJSON<Record<string, boolean>>(STORAGE_KEYS.basicTags);
    if (decks === null && activeDeckId === null && basicTags === null) return null;
    return {
      state: {
        decks: decks ?? [],
        activeDeckId: activeDeckId ?? null,
        basicTags: basicTags ?? {},
      },
      version: 1,
    };
  },
  setItem: (_name, value) => {
    writeJSON(STORAGE_KEYS.decks, value.state.decks);
    writeJSON(STORAGE_KEYS.activeDeckId, value.state.activeDeckId);
    writeJSON(STORAGE_KEYS.basicTags, value.state.basicTags);
  },
  removeItem: () => {
    removeKey(STORAGE_KEYS.decks);
    removeKey(STORAGE_KEYS.activeDeckId);
    removeKey(STORAGE_KEYS.basicTags);
  },
};

function touch(deck: Deck): Deck {
  return { ...deck, updatedAt: Date.now() };
}

function clampCount(count: number): number {
  if (!Number.isFinite(count)) return 1;
  return Math.max(0, Math.min(60, Math.trunc(count)));
}

export const useDeckStore = create<DeckState>()(
  persist(
    (set, get) => ({
      decks: [],
      activeDeckId: null,
      basicTags: {},

      createDeck: (name) => {
        const id = uid();
        const now = Date.now();
        const deck: Deck = { id, name: name ?? "", cards: [], createdAt: now, updatedAt: now };
        set((s) => ({ decks: [...s.decks, deck], activeDeckId: id }));
        return id;
      },

      renameDeck: (deckId, name) => {
        set((s) => ({
          decks: s.decks.map((d) => (d.id === deckId ? touch({ ...d, name }) : d)),
        }));
      },

      deleteDeck: (deckId) => {
        set((s) => {
          const decks = s.decks.filter((d) => d.id !== deckId);
          const activeDeckId =
            s.activeDeckId === deckId ? (decks[0]?.id ?? null) : s.activeDeckId;
          return { decks, activeDeckId };
        });
      },

      setActiveDeck: (deckId) => {
        if (get().decks.some((d) => d.id === deckId)) set({ activeDeckId: deckId });
      },

      importDeck: (name, cards) => {
        const id = uid();
        const now = Date.now();
        const { basicTags } = get();
        const deck: Deck = {
          id,
          name,
          cards: cards.map((c) => ({
            id: uid(),
            name: c.name,
            count: clampCount(c.count),
            isBasic: c.isBasic ?? basicTags[c.name] ?? false,
            section: c.section ?? "unknown",
            ...(c.set !== undefined ? { set: c.set } : {}),
            ...(c.number !== undefined ? { number: c.number } : {}),
          })),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ decks: [...s.decks, deck], activeDeckId: id }));
        return id;
      },

      addCard: (deckId) => {
        set((s) => ({
          decks: s.decks.map((d) =>
            d.id === deckId
              ? touch({
                  ...d,
                  cards: [
                    ...d.cards,
                    { id: uid(), name: "", count: 1, isBasic: false, section: "unknown" },
                  ],
                })
              : d,
          ),
        }));
      },

      updateCard: (deckId, cardId, patch) => {
        set((s) => {
          let basicTags = s.basicTags;
          const decks = s.decks.map((d) => {
            if (d.id !== deckId) return d;
            return touch({
              ...d,
              cards: d.cards.map((card) => {
                if (card.id !== cardId) return card;
                const next: DeckCard = { ...card, ...patch };
                next.count = clampCount(next.count);
                // Renaming to a known name auto-fills the remembered tag —
                // unless this very patch also sets isBasic explicitly.
                if (
                  patch.name !== undefined &&
                  patch.isBasic === undefined &&
                  s.basicTags[next.name] !== undefined
                ) {
                  next.isBasic = s.basicTags[next.name] as boolean;
                }
                // An explicit isBasic toggle is remembered globally by name.
                if (patch.isBasic !== undefined && next.name.trim() !== "") {
                  basicTags = { ...basicTags, [next.name]: patch.isBasic };
                }
                return next;
              }),
            });
          });
          return { decks, basicTags };
        });
      },

      removeCard: (deckId, cardId) => {
        set((s) => ({
          decks: s.decks.map((d) =>
            d.id === deckId ? touch({ ...d, cards: d.cards.filter((c) => c.id !== cardId) }) : d,
          ),
        }));
      },

      rememberBasicTags: (tags) => {
        set((s) => ({ basicTags: { ...s.basicTags, ...tags } }));
      },
    }),
    {
      name: "ppl.v1.deckStore", // logical name; real keys live in splitStorage
      storage: splitStorage,
      version: 1,
      partialize: (s) => ({
        decks: s.decks,
        activeDeckId: s.activeDeckId,
        basicTags: s.basicTags,
      }),
    },
  ),
);

export function deckTotal(deck: Deck): number {
  return deck.cards.reduce((sum, c) => sum + c.count, 0);
}

export function deckBasics(deck: Deck): number {
  return deck.cards.reduce((sum, c) => sum + (c.isBasic ? c.count : 0), 0);
}
