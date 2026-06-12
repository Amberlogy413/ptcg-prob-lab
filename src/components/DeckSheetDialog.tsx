import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../i18n/index.ts";
import { Modal } from "./Modal.tsx";
import type { Deck } from "../state/deckStore.ts";
import { groupDeckRows, deckBadges } from "../utils/deckSheet.ts";

/**
 * P8.3 tournament registration sheet (docs/08 §5A): an ORIGINAL text-only
 * layout carrying the information a paper deck sheet needs — never a copy of
 * the official form's design (docs/DECISIONS.md). Printing swaps the app for
 * the sheet via a body class + print-only portal (see index.css).
 */

export interface SheetFields {
  event: string;
  date: string;
  venue: string;
  player: string;
  playerId: string;
  birth: string;
}

const EMPTY_FIELDS: SheetFields = {
  event: "",
  date: "",
  venue: "",
  player: "",
  playerId: "",
  birth: "",
};

function SheetPaper({ deck, fields }: { deck: Deck; fields: SheetFields }) {
  const t = useT();
  const groups = groupDeckRows(deck);
  const badges = deckBadges(deck);
  const info: Array<[string, string]> = [
    [t("sheet.event"), fields.event],
    [t("sheet.date"), fields.date],
    [t("sheet.venue"), fields.venue],
    [t("sheet.player"), fields.player],
    [t("sheet.playerId"), fields.playerId],
    [t("sheet.birth"), fields.birth],
  ];
  return (
    <div className="bg-white p-6 text-ink">
      <h1 className="text-lg font-medium">{t("sheet.title")}</h1>
      <table className="mt-3 w-full border-collapse text-sm">
        <tbody>
          {[0, 2, 4].map((i) => (
            <tr key={i}>
              {[info[i], info[i + 1]].map((pair, j) => (
                <td key={j} className="border border-line px-2 py-1.5">
                  <span className="text-xs text-ink2">{pair?.[0]}</span>
                  <span className="ml-2">{pair?.[1] || "　"}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-line px-2 py-1 text-left text-xs text-ink2">
              {t("sheet.countCol")}
            </th>
            <th className="border border-line px-2 py-1 text-left text-xs text-ink2">
              {t("sheet.nameCol")}
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <FragmentRows key={g.section} sectionLabel={`${t(`sheet.${g.section}`)} · ${g.count}`} rows={g.rows} />
          ))}
          <tr>
            <td className="border border-line px-2 py-1 font-mono font-medium">{badges.total}</td>
            <td className="border border-line px-2 py-1 font-medium">{t("sheet.total")}</td>
          </tr>
        </tbody>
      </table>

      <p className="mt-4 text-xs text-ink2">{t("sheet.declare")}</p>
      <p className="mt-6 text-sm">
        {t("sheet.signature")}:<span className="ml-2 inline-block w-56 border-b border-ink" />
      </p>
      <p className="mt-4 text-[10px] text-ink2">{t("footer.disclaimer")}</p>
    </div>
  );
}

function FragmentRows({
  sectionLabel,
  rows,
}: {
  sectionLabel: string;
  rows: Array<{ name: string; count: number }>;
}) {
  return (
    <>
      <tr>
        <td colSpan={2} className="border border-line bg-paper px-2 py-1 text-xs text-ink2">
          {sectionLabel}
        </td>
      </tr>
      {rows.map((r, i) => (
        <tr key={i}>
          <td className="w-16 border border-line px-2 py-1 font-mono">{r.count}</td>
          <td className="border border-line px-2 py-1">{r.name}</td>
        </tr>
      ))}
    </>
  );
}

export function DeckSheetDialog({ deck, onClose }: { deck: Deck; onClose: () => void }) {
  const t = useT();
  const [fields, setFields] = useState<SheetFields>(EMPTY_FIELDS);

  // While the dialog is open, printing shows ONLY the sheet (index.css).
  useEffect(() => {
    document.body.classList.add("print-deck-sheet");
    return () => document.body.classList.remove("print-deck-sheet");
  }, []);

  const inputs: Array<{ key: keyof SheetFields; label: string }> = [
    { key: "event", label: t("sheet.event") },
    { key: "date", label: t("sheet.date") },
    { key: "venue", label: t("sheet.venue") },
    { key: "player", label: t("sheet.player") },
    { key: "playerId", label: t("sheet.playerId") },
    { key: "birth", label: t("sheet.birth") },
  ];

  return (
    <>
      <Modal title={t("sheet.title")} onClose={onClose}>
        <p className="text-xs text-ink2">{t("sheet.desc")}</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {inputs.map(({ key, label }) => (
            <label key={key} className="block text-sm">
              <span className="text-xs text-ink2">{label}</span>
              <input
                type="text"
                value={fields[key]}
                onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
                className="mt-0.5 h-9 w-full rounded-ctl border hairline bg-surface px-2 text-sm"
              />
            </label>
          ))}
        </div>

        <h3 className="mt-4 text-sm font-medium text-ink2">{t("sheet.preview")}</h3>
        <div className="mt-1 max-h-80 overflow-y-auto rounded-ctl border hairline">
          <SheetPaper deck={deck} fields={fields} />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2"
          >
            {t("export.close")}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-ctl bg-blue px-4 py-1.5 text-sm font-medium text-white"
          >
            {t("sheet.print")}
          </button>
        </div>
      </Modal>
      {createPortal(
        <div className="deck-sheet-print hidden print:block">
          <SheetPaper deck={deck} fields={fields} />
        </div>,
        document.body,
      )}
    </>
  );
}
