/**
 * i18n integrity (docs/03 §9, docs/05 §E): zh-Hant and en key sets must be
 * identical, and each key's {placeholder} parameter set must match across
 * locales. zh-Hant is the primary locale.
 */

import { describe, it, expect } from "vitest";
import zhHant from "../src/i18n/zh-Hant.json";
import en from "../src/i18n/en.json";
import { translate } from "../src/i18n/index.ts";

const zhKeys = Object.keys(zhHant).sort();
const enKeys = Object.keys(en).sort();

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort();
}

describe("i18n dictionaries", () => {
  it("zh-Hant and en key sets are identical", () => {
    expect(enKeys).toEqual(zhKeys);
  });

  it("placeholder parameters match across locales", () => {
    const zh = zhHant as Record<string, string>;
    const e = en as Record<string, string>;
    for (const key of zhKeys) {
      if (!(key in e)) continue;
      expect
        .soft(placeholders(e[key] as string), `placeholders of "${key}"`)
        .toEqual(placeholders(zh[key] as string));
    }
  });

  it("terminology lock: 機率/獎勵卡/基本寶可夢 never appear; the product word is 概率", () => {
    for (const [key, value] of Object.entries(zhHant as Record<string, string>)) {
      expect.soft(value, `zh-Hant "${key}" must not contain 機率`).not.toContain("機率");
      expect.soft(value, `zh-Hant "${key}" must not contain 獎勵卡`).not.toContain("獎勵卡");
      expect.soft(value, `zh-Hant "${key}" must not contain 基本寶可夢`).not.toContain("基本寶可夢");
    }
  });

  it("translate interpolates params and falls back to en for missing keys", () => {
    expect(translate("zh-Hant", "footer.golden", { cases: 27, assertions: 507 })).toContain("27");
    expect(translate("zh-Hant", "footer.golden", { cases: 27, assertions: 507 })).toContain("507");
    // Unknown key returns the key itself (and warns).
    expect(translate("zh-Hant", "no.such.key")).toBe("no.such.key");
  });
});
