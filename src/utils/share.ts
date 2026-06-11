/**
 * Share URLs (docs/03 §7): `#/q=<base64url(JSON)>` carrying
 * { schema: 1, deck: {name, cards}, query: {q2…} }. Decode failures must be
 * friendly, never a crash. Payloads over ~2KB get a UI hint.
 */

import type { ConstraintKind } from "../state/queryStore.ts";

export interface ShareDeckCard {
  name: string;
  count: number;
  isBasic: boolean;
}

export interface ShareQueryCard {
  name: string;
  kind: ConstraintKind;
  n: number;
  a: number;
  b: number;
}

export interface SharePayload {
  schema: 1;
  deck: { name: string; cards: ShareDeckCard[] };
  query: { type: "q2"; tracked: ShareQueryCard[]; mulliganAware: boolean };
}

export const SHARE_PREFIX = "#/q=";
export const SHARE_SOFT_LIMIT = 2048;

function b64urlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeShare(payload: SharePayload): { fragment: string; tooLong: boolean } {
  const fragment = SHARE_PREFIX + b64urlEncode(JSON.stringify(payload));
  return { fragment, tooLong: fragment.length > SHARE_SOFT_LIMIT };
}

const KINDS: ReadonlySet<string> = new Set(["atLeast", "exactly", "atMost", "between", "avoid"]);

export function decodeShare(hash: string): { ok: true; payload: SharePayload } | { ok: false } {
  if (!hash.startsWith(SHARE_PREFIX)) return { ok: false };
  try {
    const raw: unknown = JSON.parse(b64urlDecode(hash.slice(SHARE_PREFIX.length)));
    const p = raw as SharePayload;
    if (
      p === null ||
      typeof p !== "object" ||
      p.schema !== 1 ||
      typeof p.deck?.name !== "string" ||
      !Array.isArray(p.deck.cards) ||
      p.query?.type !== "q2" ||
      !Array.isArray(p.query.tracked) ||
      typeof p.query.mulliganAware !== "boolean"
    ) {
      return { ok: false };
    }
    for (const c of p.deck.cards) {
      if (typeof c.name !== "string" || !Number.isInteger(c.count) || c.count < 0 || c.count > 60) {
        return { ok: false };
      }
    }
    for (const q of p.query.tracked) {
      if (typeof q.name !== "string" || !KINDS.has(q.kind)) return { ok: false };
    }
    return { ok: true, payload: p };
  } catch {
    return { ok: false };
  }
}
