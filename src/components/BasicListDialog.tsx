import { useState } from "react";
import { useT } from "../i18n/index.ts";
import { Modal } from "./Modal.tsx";
import { useDeckStore } from "../state/deckStore.ts";

/**
 * D2 community basics list (docs/07 §D2): paste a {"卡名": true/false} JSON
 * (card names only — IP-safe), merge into the global basicTags memory and
 * retag matching cards in every deck. The names may be in any language, which
 * also covers bilingual lists.
 */
export function BasicListDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const importBasicList = useDeckStore((s) => s.importBasicList);
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  const [done, setDone] = useState<{ names: number; rows: number } | null>(null);

  function run(): void {
    setError(false);
    setDone(null);
    try {
      const raw: unknown = JSON.parse(text);
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw new Error("shape");
      const tags: Record<string, boolean> = {};
      for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof value !== "boolean" || name.trim() === "") throw new Error("entry");
        tags[name] = value;
      }
      if (Object.keys(tags).length === 0) throw new Error("empty");
      const rows = importBasicList(tags);
      setDone({ names: Object.keys(tags).length, rows });
    } catch {
      setError(true);
    }
  }

  return (
    <Modal title={t("basiclist.title")} onClose={onClose}>
      <p className="text-sm text-ink2">{t("basiclist.desc")}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'{"火球鼠": true, "Cyndaquil": true, "超夢風暴": false}'}
        aria-label={t("basiclist.title")}
        rows={8}
        className="mt-2 w-full rounded-ctl border hairline bg-surface p-2 font-mono text-sm"
      />
      {error && (
        <p className="mt-2 text-sm text-bad" role="alert">
          {t("basiclist.error")}
        </p>
      )}
      {done && (
        <p className="mt-2 text-sm text-ink2" role="status">
          {t("basiclist.done", { names: done.names, rows: done.rows })}
        </p>
      )}
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
          onClick={run}
          disabled={text.trim() === ""}
          className="rounded-ctl bg-blue px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {t("basiclist.apply")}
        </button>
      </div>
    </Modal>
  );
}
