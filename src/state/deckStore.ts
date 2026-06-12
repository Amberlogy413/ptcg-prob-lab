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
  /** Regulation mark (single letter); drives the rotation preview only (P8.4). */
  mark?: string;
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
  /** D1: alias name -> canonical name; basicTags lookups fall through it. */
  aliases: Record<string, string>;
}

interface DeckState extends DeckPersisted {
  createDeck: (name?: string) => string;
  renameDeck: (deckId: string, name: string) => void;
  duplicateDeck: (deckId: string, name?: string) => string | null;
  /** P8.4 rotation fork: a copy without the rows whose mark matches. */
  forkWithoutMark: (deckId: string, mark: string, name: string) => string | null;
  deleteDeck: (deckId: string) => void;
  setActiveDeck: (deckId: string) => void;
  importDeck: (name: string, cards: NewCardInput[]) => string;
  addCard: (deckId: string) => void;
  updateCard: (deckId: string, cardId: string, patch: Partial<Omit<DeckCard, "id">>) => void;
  removeCard: (deckId: string, cardId: string) => void;
  rememberBasicTags: (tags: Record<string, boolean>) => void;
  setAlias: (alias: string, canonical: string) => void;
  removeAlias: (alias: string) => void;
  /** D2 community basics list: merge into basicTags AND retag matching cards
   *  in every deck. Returns how many deck rows were updated. */
  importBasicList: (tags: Record<string, boolean>) => number;
}

/** Split one store state across the three spec keys (docs/DECISIONS.md). */
const splitStorage: PersistStorage<DeckPersisted> = {
  getItem: () => {
    const decks = readJSON<Deck[]>(STORAGE_KEYS.decks);
    const activeDeckId = readJSON<string | null>(STORAGE_KEYS.activeDeckId);
    const basicTags = readJSON<Record<string, boolean>>(STORAGE_KEYS.basicTags);
    const aliases = readJSON<Record<string, string>>(STORAGE_KEYS.aliases);
    if (decks === null && activeDeckId === null && basicTags === null && aliases === null) {
      return null;
    }
    return {
      state: {
        decks: decks ?? [],
        activeDeckId: activeDeckId ?? null,
        basicTags: basicTags ?? {},
        aliases: aliases ?? {},
      },
      version: 1,
    };
  },
  setItem: (_name, value) => {
    writeJSON(STORAGE_KEYS.decks, value.state.decks);
    writeJSON(STORAGE_KEYS.activeDeckId, value.state.activeDeckId);
    writeJSON(STORAGE_KEYS.basicTags, value.state.basicTags);
    writeJSON(STORAGE_KEYS.aliases, value.state.aliases);
  },
  removeItem: () => {
    removeKey(STORAGE_KEYS.decks);
    removeKey(STORAGE_KEYS.activeDeckId);
    removeKey(STORAGE_KEYS.basicTags);
    removeKey(STORAGE_KEYS.aliases);
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
      aliases: {},

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

      duplicateDeck: (deckId, name) => {
        const source = get().decks.find((d) => d.id === deckId);
        if (!source) return null;
        const id = uid();
        const now = Date.now();
        const copy: Deck = {
          id,
          name: name ?? `${source.name || "deck"} B`,
          cards: source.cards.map((c) => ({ ...c, id: uid() })),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ decks: [...s.decks, copy] }));
        return id;
      },

      forkWithoutMark: (deckId, mark, name) => {
        const source = get().decks.find((d) => d.id === deckId);
        if (!source) return null;
        const id = uid();
        const now = Date.now();
        const fork: Deck = {
          id,
          name,
          cards: source.cards.filter((c) => c.mark !== mark).map((c) => ({ ...c, id: uid() })),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ decks: [...s.decks, fork] }));
        return id;
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
        const { basicTags, aliases } = get();
        const deck: Deck = {
          id,
          name,
          cards: cards.map((c) => ({
            id: uid(),
            name: c.name,
            count: clampCount(c.count),
            isBasic: c.isBasic ?? resolveBasicTag(basicTags, aliases, c.name) ?? false,
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
                if (patch.name !== undefined && patch.isBasic === undefined) {
                  const known = resolveBasicTag(s.basicTags, s.aliases, next.name);
                  if (known !== undefined) next.isBasic = known;
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

      setAlias: (alias, canonical) => {
        const a = alias.trim();
        const c = canonical.trim();
        if (a === "" || c === "" || a === c) return;
        set((s) => ({ aliases: { ...s.aliases, [a]: c } }));
      },

      removeAlias: (alias) => {
        set((s) => {
          const aliases = { ...s.aliases };
          delete aliases[alias];
          return { aliases };
        });
      },

      importBasicList: (tags) => {
        let updated = 0;
        set((s) => ({
          basicTags: { ...s.basicTags, ...tags },
          decks: s.decks.map((d) => {
            let touched = false;
            const cards = d.cards.map((c) => {
              const flag = tags[c.name];
              if (flag !== undefined && c.isBasic !== flag) {
                touched = true;
                updated += 1;
                return { ...c, isBasic: flag };
              }
              return c;
            });
            return touched ? touch({ ...d, cards }) : d;
          }),
        }));
        return updated;
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
        aliases: s.aliases,
      }),
    },
  ),
);

/** D1 lookup: direct tag, else the canonical name's tag via the alias map. */
export function resolveBasicTag(
  basicTags: Record<string, boolean>,
  aliases: Record<string, string>,
  name: string,
): boolean | undefined {
  if (basicTags[name] !== undefined) return basicTags[name];
  const canonical = aliases[name];
  return canonical !== undefined ? basicTags[canonical] : undefined;
}

export function deckTotal(deck: Deck): number {
  return deck.cards.reduce((sum, c) => sum + c.count, 0);
}

export function deckBasics(deck: Deck): number {
  return deck.cards.reduce((sum, c) => sum + (c.isBasic ? c.count : 0), 0);
}
