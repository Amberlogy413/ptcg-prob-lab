/**
 * Shared 寶可夢功能 classifier (owner request 2026-06-14: deeply + responsibly
 * classify each card's ability & attacks into precise function sub-categories).
 *
 * DETERMINISTIC keyword rules over the OFFICIAL zh card text — every tag is
 * reproducible from the card's own words, no judgment calls (so it stays
 * "negligible-guess": we under-tag rather than mis-tag). Top-level `fn` drives
 * the existing 功能 layer; `fnSub` adds the finer breakdown. Used by both
 * fetch_catalog.mjs (fresh crawl) and reclassify.mjs (re-run, no re-crawl).
 */

// [key, regex] — coarse function tags (unchanged keys; stable identifiers).
export const FN_RULES = [
  ["search", /從(自己的)?牌庫(中|上方)?選擇|搜尋(自己的)?牌庫/],
  ["draw", /抽出|抽\d+張|抽\s*\d+\s*張/],
  ["accel", /從(自己的)?(棄牌區|牌庫|手牌)[^。]{0,25}能量[^。]{0,15}附/],
  ["heal", /恢復[^。]{0,8}HP/],
  ["disrupt", /對手的(手牌|牌庫)/],
  ["gust", /對手[^。]{0,15}備戰寶可夢[^。]{0,15}互換/],
  ["recover", /從(自己的)?棄牌區[^。]{0,30}(加入手牌|放回牌庫|加入牌庫)/],
  ["protect", /不會受到[^。]{0,15}(傷害|效果)|防止[^。]{0,10}傷害/],
  ["boost", /傷害[^。]{0,4}[+＋]\s*\d|[+＋]\s*\d+\s*點/],
];

// [subKey, parentFn, regex] — finer sub-categories. A sub-tag is added only
// when its parent fn also fires (keeps them coherent), so the UI can group them.
export const SUB_RULES = [
  // search: what you can fetch
  ["search.pokemon", "search", /選擇[^。]{0,16}寶可夢[^。]{0,12}(加入手牌|放到備戰區|放置於備戰區)/],
  ["search.energy", "search", /選擇[^。]{0,12}能量[^。]{0,12}加入手牌/],
  ["search.trainer", "search", /選擇[^。]{0,16}(訓練家|物品卡|支援者卡|競技場卡)[^。]{0,12}加入手牌/],
  // draw: shape of the draw
  ["draw.refill", "draw", /手牌(全部)?(丟棄|翻回反面並重洗)[^。]{0,60}抽(出)?\s*\d+\s*張/],
  ["draw.until", "draw", /直到[^。]{0,8}(手牌|變成)[^。]{0,4}\d+\s*張|抽到手牌(有|變成)\s*\d+\s*張/],
  ["draw.fixed", "draw", /抽(出)?\s*\d+\s*張/],
  // accel: where the energy comes from
  ["accel.discard", "accel", /從(自己的)?棄牌區[^。]{0,25}能量[^。]{0,15}附/],
  ["accel.deck", "accel", /從(自己的)?牌庫[^。]{0,25}能量[^。]{0,15}附/],
  ["accel.hand", "accel", /從(自己的)?手牌[^。]{0,25}能量[^。]{0,15}附/],
  // disrupt: what you hit
  ["disrupt.hand", "disrupt", /對手的手牌/],
  ["disrupt.deck", "disrupt", /對手的牌庫/],
  // heal: amount vs full
  ["heal.full", "heal", /恢復[^。]{0,6}(所有|全部)[^。]{0,4}HP/],
  // recover: destination
  ["recover.hand", "recover", /棄牌區[^。]{0,30}加入手牌/],
  ["recover.deck", "recover", /棄牌區[^。]{0,30}(放回牌庫|加入牌庫)/],
];

// [subKey, regex] — what an ABILITY does, matched over the ABILITY text ONLY
// (owner request 2026-06-15: 特性系之下都要有子分類). Kept off the attack text so
// an attack's wording never mis-tags the ability. Parent fn is always "ability".
export const ABILITY_SUB_RULES = [
  ["ability.draw", /抽(出)?\s*\d*\s*張|抽一張/],
  ["ability.search", /(從|在)(自己的)?牌庫[^。]{0,16}(選擇|搜尋)|搜尋(自己的)?牌庫/],
  ["ability.accel", /能量[^。]{0,15}附(加)?(到|於|在)|從[^。]{0,15}能量[^。]{0,12}附/],
  ["ability.gust", /備戰寶可夢[^。]{0,15}(互換|替換)|改為對手的備戰寶可夢/],
  ["ability.damage", /放置[^。]{0,10}傷害指示物|傷害指示物[^。]{0,10}放置|(造成|給予)[^。]{0,6}\d+\s*點?傷害/],
  ["ability.heal", /恢復[^。]{0,8}HP/],
  ["ability.disrupt", /對手的(手牌|牌庫)/],
  ["ability.protect", /不會受到[^。]{0,15}(傷害|效果)|防止[^。]{0,10}傷害/],
];

/** Set card.fn (coarse) and card.fnSub (fine) from the card's own text. */
export function classify(card) {
  const texts = [
    card.effect ?? "",
    ...(card.attacks ?? []).map((a) => a.effect ?? ""),
    ...(card.abilities ?? []).map((a) => a.effect ?? ""),
    card.item?.effect ?? "",
  ].join("\n");

  const fn = [];
  for (const [key, re] of FN_RULES) {
    if (re.test(texts)) fn.push(key);
  }
  if (card.category === "Pokemon") {
    const maxDamage = Math.max(
      0,
      ...(card.attacks ?? []).map((a) => {
        const m = String(a.damage ?? "").match(/\d+/);
        return m ? Number(m[0]) : 0;
      }),
    );
    if (maxDamage >= 120) fn.push("attacker");
    if ((card.abilities ?? []).length > 0) fn.push("ability");
  }

  const fnSet = new Set(fn);
  const fnSub = [];
  for (const [sub, parent, re] of SUB_RULES) {
    if (fnSet.has(parent) && re.test(texts) && !fnSub.includes(sub)) fnSub.push(sub);
  }
  // Ability sub-categories — over the ability text only, so attack wording
  // never leaks in. Only when this Pokémon actually has an ability.
  if (fnSet.has("ability")) {
    const abilityText = (card.abilities ?? []).map((a) => a.effect ?? "").join("\n");
    for (const [sub, re] of ABILITY_SUB_RULES) {
      if (re.test(abilityText) && !fnSub.includes(sub)) fnSub.push(sub);
    }
  }

  if (fn.length > 0) card.fn = fn;
  else delete card.fn;
  if (fnSub.length > 0) card.fnSub = fnSub;
  else delete card.fnSub;
}
