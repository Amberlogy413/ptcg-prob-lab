import { useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore, deckBasics } from "../state/deckStore.ts";
import { useQ3Store } from "../state/q3Store.ts";
import { computeQ3Single, computeQ3Joint, type Q3Mode, type Q3ReceiptData, type Q3SingleData, type Q3JointData } from "../state/q3.ts";
import { PresetStrip } from "../components/PresetStrip.tsx";
import { PrecisionRuler } from "../components/PrecisionRuler.tsx";
import { MathReceipt, type ReceiptLine } from "../components/MathReceipt.tsx";
import { DistTable } from "../components/DistTable.tsx";
import { JointTable } from "../components/JointTable.tsx";
import { HAND_SIZE, PRIZE_COUNT, DECK_SIZE } from "../constants.ts";

const MODES: Q3Mode[] = ["uncond", "givenHand", "preGame"];

function useReceiptLines(receipt: Q3ReceiptData): ReceiptLine[] {
  const t = useT();
  return [
    { label: t("receipt.label.formula"), text: receipt.formula },
    { label: t("receipt.label.subst"), text: receipt.substitution },
    {
      label: t("receipt.label.total"),
      text:
        receipt.totalKind === "atLeast"
          ? t("receipt.q3.totalAtLeast", { num: receipt.total.num ?? "", frac: receipt.total.frac })
          : t("receipt.q3.expected", { frac: receipt.total.frac, dec: receipt.total.dec ?? "" }),
    },
    ...(receipt.condPValid
      ? [{ label: t("receipt.label.cond"), text: t("receipt.q3.cond", { pValid: receipt.condPValid }) }]
      : []),
    {
      label: t("receipt.label.check"),
      text:
        (receipt.identityOk ? t("receipt.check.identity") : "✗ Σ P ≠ 1") +
        (receipt.goldenId ? ";" + t("receipt.check.golden", { id: receipt.goldenId }) : ""),
    },
  ];
}

/** 獎賞卡 workspace: Q3 three modes + multi-card joint (docs/06 Phase 4). */
export function PrizesView() {
  return (
    <div>
      <PresetStrip />
      <Q3SingleSection />
      <Q3JointSection />
    </div>
  );
}

function numInput(
  value: number,
  aria: string,
  max: number,
  onChange: (v: number) => void,
): JSX.Element {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={max}
      value={value}
      aria-label={aria}
      onChange={(e) => {
        const v = Math.max(0, Math.min(max, Math.trunc(Number(e.target.value) || 0)));
        onChange(v);
      }}
      className="h-8 w-14 rounded-ctl border hairline bg-surface text-center font-mono text-sm"
    />
  );
}

function Q3SingleSection() {
  const t = useT();
  const decks = useDeckStore((s) => s.decks);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);
  const deck = decks.find((d) => d.id === activeDeckId) ?? null;
  const mode = useQ3Store((s) => s.mode);
  const single = useQ3Store((s) => s.single);
  const setMode = useQ3Store((s) => s.setMode);
  const setSingle = useQ3Store((s) => s.setSingle);
  const saveCustomPreset = useQ3Store((s) => s.saveCustomPreset);
  const [presetLabel, setPresetLabel] = useState("");

  const deckCards = (deck?.cards ?? []).filter((c) => c.name.trim() !== "" && c.count > 0);
  const fromDeck =
    single.source !== "custom" ? deckCards.find((c) => c.id === single.source) : undefined;

  const eff = useMemo(() => {
    if (fromDeck && deck) {
      return {
        x: fromDeck.count,
        isBasic: fromDeck.isBasic,
        otherBasics: deckBasics(deck) - (fromDeck.isBasic ? fromDeck.count : 0),
        label: fromDeck.name,
      };
    }
    return {
      x: single.x,
      isBasic: single.isBasic,
      otherBasics: Math.min(single.otherBasics, DECK_SIZE - single.x),
      label: t("q3.custom"),
    };
  }, [fromDeck, deck, single, t]);

  const h = Math.min(single.h, Math.min(eff.x, HAND_SIZE));
  const preGameImpossible = mode === "preGame" && !eff.isBasic && eff.otherBasics < 1;

  const data: Q3SingleData | null = useMemo(() => {
    if (preGameImpossible) return null;
    try {
      return computeQ3Single(mode, {
        x: eff.x,
        h,
        isBasic: eff.isBasic,
        otherBasics: eff.otherBasics,
      });
    } catch (err) {
      console.warn("[q3] compute failed:", err);
      return null;
    }
  }, [mode, eff, h, preGameImpossible]);

  const segBtn = (active: boolean) =>
    "rounded-ctl px-3 py-1.5 text-sm transition-colors duration-fast " +
    (active ? "bg-blue font-medium text-white" : "border hairline bg-surface text-ink2 hover:text-ink");

  return (
    <section className="rounded-card border hairline bg-surface p-4 sm:p-6">
      <h2 className="text-xl font-medium">{t("q3.title")}</h2>

      {/* Mode segmented control + ⓘ explanation */}
      <div role="group" aria-label={t("q3.mode.aria")} className="mt-3 flex flex-wrap gap-1">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={segBtn(mode === m)}
          >
            {t(`q3.mode.${m}`)}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-ink2">{t(`q3.mode.${mode}.info`)}</p>

      {/* Sentence controls */}
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 leading-relaxed">
        <span>{t("q3.s.prefix")}</span>
        <span className="rounded-ctl border hairline bg-paper px-2 py-1 text-sm">
          {t("q3.s.prizes")}
        </span>
        <span>{t("q3.s.want")}</span>
        <span className="inline-flex items-center gap-1 rounded-ctl border border-blue px-2 py-1 text-sm text-blue">
          <select
            value={single.source}
            aria-label={t("q3.source.aria")}
            onChange={(e) => setSingle({ source: e.target.value })}
            className="h-7 rounded-ctl border hairline bg-surface px-1 text-sm text-ink"
          >
            <option value="custom">{t("q3.custom")}</option>
            {deckCards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ×{c.count}
              </option>
            ))}
          </select>
          {!fromDeck && (
            <>
              <span className="text-ink2">×</span>
              {numInput(single.x, t("q3.x.aria"), DECK_SIZE, (x) => setSingle({ x }))}
            </>
          )}
          {fromDeck && <span className="font-mono">×{eff.x}</span>}
        </span>
        {mode === "givenHand" && (
          <span className="inline-flex items-center gap-1 rounded-ctl border hairline bg-surface px-2 py-1 text-sm">
            {t("q3.h.label")}
            {numInput(h, t("q3.h.aria"), Math.min(eff.x, HAND_SIZE), (v) => setSingle({ h: v }))}
          </span>
        )}
        {mode === "preGame" && !fromDeck && (
          <span className="inline-flex items-center gap-2 rounded-ctl border hairline bg-surface px-2 py-1 text-sm">
            <button
              type="button"
              role="switch"
              aria-checked={single.isBasic}
              aria-label={t("deck.card.basicFull")}
              onClick={() => setSingle({ isBasic: !single.isBasic })}
              className={
                "rounded-ctl px-2 py-0.5 text-xs " +
                (single.isBasic ? "bg-blue text-white" : "border hairline text-ink2")
              }
            >
              {t("deck.card.basic")}
            </button>
            {t("q3.ob.label")}
            {numInput(eff.otherBasics, t("q3.ob.aria"), DECK_SIZE - eff.x, (otherBasics) =>
              setSingle({ otherBasics }),
            )}
          </span>
        )}
        {mode === "preGame" && fromDeck && (
          <span className="rounded-ctl border hairline bg-paper px-2 py-1 text-xs text-ink2">
            {fromDeck.isBasic ? t("deck.card.basicFull") : t("q3.nonBasic")} · {t("q3.ob.label")}{" "}
            <span className="font-mono">{eff.otherBasics}</span>
          </span>
        )}
        <span>{t("q3.s.prized")}</span>
        <span className="rounded-ctl border hairline bg-paper px-2 py-1 text-sm">
          {t("q3.s.atLeastOne")}
        </span>
        <span>{t("q3.s.suffix")}</span>
      </div>

      {preGameImpossible && (
        <p className="mt-3 text-sm text-warn" role="status">
          {t("q3.preGame.impossible")}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={presetLabel}
          placeholder={t("bank.save.placeholder")}
          aria-label={t("bank.save.placeholder")}
          onChange={(e) => setPresetLabel(e.target.value)}
          className="h-8 w-56 rounded-ctl border hairline bg-surface px-2 text-sm"
        />
        <button
          type="button"
          disabled={presetLabel.trim() === ""}
          onClick={() => {
            saveCustomPreset(presetLabel);
            setPresetLabel("");
          }}
          className="rounded-ctl border hairline px-2.5 py-1 text-xs text-ink2 hover:text-ink disabled:opacity-40"
        >
          {t("bank.save")}
        </button>
      </div>

      {data && <Q3SingleResult data={data} />}
    </section>
  );
}

function Q3SingleResult({ data }: { data: Q3SingleData }) {
  const t = useT();
  const lines = useReceiptLines(data.receipt);
  return (
    <div className="mt-4 border-t hairline pt-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-ink2">
        {t("q3.headline.label")}
        <span className="ml-2 normal-case">{t(`q3.mode.${data.mode}`)}</span>
      </h3>
      <p className="font-mono text-headline leading-none">{data.headline.percent}</p>
      <p className="mt-1 font-mono text-sm text-ink2">
        {data.headline.fraction} · {data.headline.oneIn}
      </p>
      <PrecisionRuler
        value={data.headline.chart}
        labels
        ariaLabel={t("q3.ruler.aria", {
          percent: data.headline.percent,
          fraction: data.headline.fraction,
        })}
      />
      {data.headline.games && (
        <p className="mt-2 text-sm">{t("q3.headline.interpret", { games: data.headline.games })}</p>
      )}
      <p className="mt-1 font-mono text-sm">
        {t("q3.expected", { fraction: data.expected.fraction, decimal: data.expected.decimal })}
      </p>
      {data.baseline && (
        <div className="mt-1 text-sm text-ink2">
          <p className="font-mono">{t("q3.baseline", { decimal: data.baseline.decimal })}</p>
          <p>{t(`q3.direction.${data.baseline.direction}`)}</p>
        </div>
      )}
      {data.pValid && (
        <p className="mt-1 font-mono text-xs text-ink2">
          {t("q2.pValid", { fraction: data.pValid.fraction, percent: data.pValid.percent })}
        </p>
      )}

      <MathReceipt lines={lines} />

      <div className="mt-5">
        <DistTable
          rows={data.rows}
          caption={t("q3.headline.label")}
          kLabelKey="q3.table.k"
          csvName="q3_prize_distribution"
        />
      </div>
    </div>
  );
}

function Q3JointSection() {
  const t = useT();
  const joint = useQ3Store((s) => s.joint);
  const addJointRow = useQ3Store((s) => s.addJointRow);
  const updateJointRow = useQ3Store((s) => s.updateJointRow);
  const removeJointRow = useQ3Store((s) => s.removeJointRow);

  const result: { data?: Q3JointData; error?: string } = useMemo(() => {
    if (joint.length === 0) return {};
    try {
      const clamped = joint.map((r) => ({
        ...r,
        inHand: Math.min(r.inHand, Math.min(r.count, HAND_SIZE)),
        min: Math.min(r.min, PRIZE_COUNT),
        max: Math.max(Math.min(r.max, PRIZE_COUNT), Math.min(r.min, PRIZE_COUNT)),
      }));
      return { data: computeQ3Joint(clamped) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }, [joint]);

  return (
    <section className="mt-4 rounded-card border hairline bg-surface p-4 sm:p-6">
      <h3 className="text-lg font-medium">{t("q3.joint.title")}</h3>
      <p className="mt-1 text-xs text-ink2">{t("q3.joint.desc")}</p>

      {joint.length === 0 ? (
        <p className="mt-3 text-sm text-ink2">{t("q3.joint.empty")}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {joint.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <input
                type="text"
                value={r.label}
                placeholder={t("q3.joint.label")}
                aria-label={t("q3.joint.label")}
                onChange={(e) => updateJointRow(r.id, { label: e.target.value })}
                className="h-8 w-32 rounded-ctl border hairline bg-surface px-2 text-sm"
              />
              <label className="flex items-center gap-1 text-xs text-ink2">
                {t("q3.joint.count")}
                {numInput(r.count, t("q3.joint.count"), DECK_SIZE, (count) =>
                  updateJointRow(r.id, { count }),
                )}
              </label>
              <label className="flex items-center gap-1 text-xs text-ink2">
                {t("q3.joint.inHand")}
                {numInput(r.inHand, t("q3.joint.inHand"), Math.min(r.count, HAND_SIZE), (inHand) =>
                  updateJointRow(r.id, { inHand }),
                )}
              </label>
              <label className="flex items-center gap-1 text-xs text-ink2">
                {t("q3.joint.min")}
                {numInput(r.min, t("q3.joint.min"), PRIZE_COUNT, (min) =>
                  updateJointRow(r.id, { min }),
                )}
              </label>
              <label className="flex items-center gap-1 text-xs text-ink2">
                {t("q3.joint.max")}
                {numInput(r.max, t("q3.joint.max"), PRIZE_COUNT, (max) =>
                  updateJointRow(r.id, { max }),
                )}
              </label>
              <button
                type="button"
                aria-label={t("q2.removeCard.aria", { name: r.label || t("q3.joint.label") })}
                onClick={() => removeJointRow(r.id)}
                className="h-8 w-8 rounded-ctl border hairline text-ink2 hover:text-bad"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {joint.length < 5 && (
        <button
          type="button"
          onClick={addJointRow}
          className="mt-3 rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2 hover:text-ink"
        >
          {t("q3.joint.add")}
        </button>
      )}

      {result.error && (
        <p className="mt-3 text-sm text-bad" role="alert">
          {t("q2.error", { message: result.error })}
        </p>
      )}
      {result.data && <Q3JointResult data={result.data} />}
    </section>
  );
}

function Q3JointResult({ data }: { data: Q3JointData }) {
  const t = useT();
  const lines = useReceiptLines(data.receipt);
  return (
    <div className="mt-4 border-t hairline pt-4">
      <h4 className="text-xs font-medium uppercase tracking-wide text-ink2">
        {t("q3.joint.headline")}
      </h4>
      <p className="font-mono text-2xl">{data.headline.percent}</p>
      <p className="mt-1 font-mono text-sm text-ink2">
        {data.headline.fraction} · {data.headline.oneIn}
      </p>
      <PrecisionRuler
        value={data.headline.chart}
        ariaLabel={t("q3.ruler.aria", {
          percent: data.headline.percent,
          fraction: data.headline.fraction,
        })}
      />
      <MathReceipt lines={lines} />
      <JointTable
        legend={data.legend}
        comboHeader={data.comboHeader}
        rows={data.rows}
        csvName="q3_prize_joint"
      />
    </div>
  );
}
