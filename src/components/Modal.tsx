import { useEffect, useRef, type ReactNode } from "react";
import { useT } from "../i18n/index.ts";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Wide layout for browse-style dialogs (deck builder). */
  wide?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, onClose, children, wide }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // The latest onClose without re-running the effect: parents pass inline
  // closures, and re-running would re-fire panel focus on every render
  // (e.g. each builder card-add would steal focus from the tapped button).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();

    const isTopmost = () => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      return dialogs[dialogs.length - 1] === panelRef.current;
    };
    const onKey = (e: KeyboardEvent) => {
      // Nested dialogs (builder → card visual): only the topmost one reacts.
      if (!isTopmost()) return;
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      // Focus trap (aria-modal contract): Tab cycles inside the panel.
      const panel = panelRef.current;
      if (panel === null) return;
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (active !== null && active instanceof Node && !panel.contains(active)) {
        e.preventDefault();
        first?.focus();
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Hand focus back to whatever opened the dialog.
      if (opener !== null && document.contains(opener)) opener.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={
          "w-full rounded-card border hairline bg-surface p-6 " +
          (wide ? "max-w-5xl" : "max-w-2xl")
        }
      >
        <ModalHeader title={title} onClose={onClose} />
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const t = useT();
  return (
    <div className="flex items-start justify-between gap-3">
      <h2 className="text-lg font-medium">{title}</h2>
      <button
        type="button"
        aria-label={t("modal.close")}
        onClick={onClose}
        className="h-9 w-9 shrink-0 rounded-ctl border hairline bg-surface text-ink2 hover:text-ink"
      >
        ✕
      </button>
    </div>
  );
}
