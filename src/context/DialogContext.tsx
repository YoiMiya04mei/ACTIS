"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Info,
  RotateCcw,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

export type DialogVariant = "danger" | "warning" | "info" | "success";

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
}

export interface AlertDialogOptions {
  title?: string;
  message: string;
  okText?: string;
  variant?: DialogVariant;
}

interface ActiveDialogState {
  kind: "confirm" | "alert";
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant: DialogVariant;
  actionType: "delete" | "reset" | "sync" | "confirm" | "info";
}

interface DialogContextValue {
  confirm: (options: string | ConfirmDialogOptions) => Promise<boolean>;
  alert: (options: string | AlertDialogOptions) => Promise<void>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

let cachedSupportsDisplayTransition: boolean | undefined;

function canTransitionDisplay(): boolean {
  if (cachedSupportsDisplayTransition !== undefined) {
    return cachedSupportsDisplayTransition;
  }
  if (
    typeof window === "undefined" ||
    !window.CSS?.supports?.("transition-behavior", "allow-discrete") ||
    !document.body
  ) {
    return false;
  }
  const probe = document.createElement("div");
  probe.style.cssText =
    "transition: display 1s allow-discrete !important; display: block;";
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = "none";
  cachedSupportsDisplayTransition = getComputedStyle(probe).display === "block";
  probe.remove();
  return cachedSupportsDisplayTransition;
}

function supportsTopLayerExit(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.CSS?.supports?.("overlay", "auto")) &&
    canTransitionDisplay()
  );
}

async function closeTopLayerWithFallback(
  dialog: HTMLDialogElement,
  returnValue = ""
) {
  if (!dialog.open) return;

  if (!supportsTopLayerExit()) {
    dialog.setAttribute("data-closing", "");
    const animations = dialog.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((r) => setTimeout(r, 400)),
      ]);
    }
    if (!dialog.hasAttribute("data-closing")) return;
    dialog.removeAttribute("data-closing");
  }

  dialog.close(returnValue);
}

function inferDialogPresentation(
  kind: "confirm" | "alert",
  options: string | ConfirmDialogOptions | AlertDialogOptions
): ActiveDialogState {
  const opts = typeof options === "string" ? { message: options } : options;
  const msg = (opts.message || "").trim();
  const lower = msg.toLowerCase();

  let actionType: ActiveDialogState["actionType"] =
    kind === "alert" ? "info" : "confirm";
  let inferredVariant: DialogVariant = "info";
  let inferredTitle = kind === "confirm" ? "Konfirmasi Tindakan" : "Informasi";
  let inferredConfirmText =
    kind === "confirm" ? "Ya, Lanjutkan" : "Mengerti";

  if (
    lower.includes("hapus") ||
    lower.includes("permanen") ||
    lower.includes("peringatan") ||
    lower.includes("gagal") ||
    lower.includes("ditolak") ||
    lower.includes("kesalahan")
  ) {
    inferredVariant = "danger";
    if (lower.includes("hapus") || lower.includes("permanen")) {
      actionType = "delete";
      inferredTitle = "Konfirmasi Penghapusan";
      inferredConfirmText = "Ya, Hapus";
    } else {
      inferredTitle = kind === "confirm" ? "Peringatan Tindakan" : "Terjadi Kendala";
    }
  } else if (
    lower.includes("reset") ||
    lower.includes("kembalikan") ||
    lower.includes("kosongkan") ||
    lower.includes("bersihkan") ||
    lower.includes("belum") ||
    lower.includes("tidak ada") ||
    lower.includes("tidak didukung") ||
    lower.includes("pastikan") ||
    lower.includes("silakan") ||
    lower.includes("harus") ||
    lower.includes("hanya ")
  ) {
    inferredVariant = "warning";
    if (
      lower.includes("reset") ||
      lower.includes("kembalikan") ||
      lower.includes("kosongkan")
    ) {
      actionType = "reset";
      inferredTitle = "Konfirmasi Reset";
      inferredConfirmText = "Ya, Reset";
    } else {
      inferredTitle = kind === "confirm" ? "Konfirmasi" : "Perhatian";
    }
  } else if (
    lower.includes("berhasil") ||
    lower.includes("go-live") ||
    lower.includes("force sync") ||
    lower.includes("sinkron")
  ) {
    inferredVariant = "success";
    if (lower.includes("force sync") || lower.includes("sinkron")) {
      actionType = "sync";
      inferredTitle = "Konfirmasi Sinkronisasi";
      inferredConfirmText = "Ya, Jalankan Sync";
    } else if (lower.includes("go-live")) {
      inferredTitle = "Konfirmasi Go-Live";
      inferredConfirmText = "Ya, Selesaikan Go-Live";
    } else {
      inferredTitle = "Berhasil";
    }
  }

  const confirmOpts = opts as ConfirmDialogOptions;
  const alertOpts = opts as AlertDialogOptions;

  return {
    kind,
    title: opts.title || inferredTitle,
    message: msg,
    confirmText:
      kind === "confirm"
        ? confirmOpts.confirmText || inferredConfirmText
        : alertOpts.okText || "Mengerti",
    cancelText:
      kind === "confirm" ? confirmOpts.cancelText || "Batal" : "",
    variant: opts.variant || inferredVariant,
    actionType,
  };
}

/** Format quoted substrings ('item', "item", [SITE]) cleanly for faster visual scanning. */
function renderHighlightedMessage(message: string) {
  const tokens = message.split(/('[^']+'|"[^"]+"|\[[^\]]+\])/g);
  return tokens.map((part, idx) => {
    if (
      (part.startsWith("'") && part.endsWith("'")) ||
      (part.startsWith('"') && part.endsWith('"')) ||
      (part.startsWith("[") && part.endsWith("]"))
    ) {
      return (
        <span
          key={idx}
          className="inline-block px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-slate-100 text-[13px]"
        >
          {part}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

const VARIANT_STYLES: Record<
  DialogVariant,
  {
    accentBar: string;
    iconWrapper: string;
    iconColor: string;
    confirmButton: string;
  }
> = {
  danger: {
    accentBar: "from-rose-500 via-red-500 to-orange-500",
    iconWrapper:
      "bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800/70 ring-4 ring-rose-500/10",
    iconColor: "text-rose-600 dark:text-rose-400",
    confirmButton:
      "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/25 focus-visible:ring-rose-500",
  },
  warning: {
    accentBar: "from-amber-400 via-orange-500 to-amber-500",
    iconWrapper:
      "bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/70 ring-4 ring-amber-500/10",
    iconColor: "text-amber-600 dark:text-amber-400",
    confirmButton:
      "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/25 focus-visible:ring-amber-500",
  },
  success: {
    accentBar: "from-emerald-500 via-teal-500 to-emerald-400",
    iconWrapper:
      "bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/70 ring-4 ring-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    confirmButton:
      "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 focus-visible:ring-emerald-500",
  },
  info: {
    accentBar: "from-blue-600 via-indigo-500 to-sky-500",
    iconWrapper:
      "bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/70 ring-4 ring-blue-500/10",
    iconColor: "text-blue-600 dark:text-blue-400",
    confirmButton:
      "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 focus-visible:ring-blue-500",
  },
};

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const queueRef = useRef<
    Array<{
      state: ActiveDialogState;
      resolve: (confirmed: boolean) => void;
    }>
  >([]);
  const titleId = useId();
  const descId = useId();

  const [active, setActive] = useState<ActiveDialogState | null>(null);

  const openNext = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open || resolverRef.current) return;

    const next = queueRef.current.shift();
    if (!next) return;

    resolverRef.current = next.resolve;
    setActive(next.state);
  }, []);

  // Show modal once React renders the active dialog content
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!active || !dialog || dialog.open) return;

    dialog.removeAttribute("data-closing");
    dialog.returnValue = "";
    dialog.showModal();
  }, [active]);

  // Wire native dialog close/cancel events and light-dismiss fallback
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      const value = dialog.returnValue;
      dialog.returnValue = "";

      const resolve = resolverRef.current;
      resolverRef.current = null;
      setActive(null);
      resolve?.(value === "confirm");

      // Open next queued dialog on the following frame if any
      if (queueRef.current.length > 0) {
        requestAnimationFrame(() => openNext());
      }
    };

    const handleCancel = (event: Event) => {
      if (!supportsTopLayerExit()) {
        event.preventDefault();
        void closeTopLayerWithFallback(dialog, "");
      }
    };

    let cleanupLightDismiss: (() => void) | undefined;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      let pressedOutside = false;
      const isOutside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        );
      };
      const onPointerDown = (e: PointerEvent) => {
        pressedOutside = isOutside(e);
      };
      const onPointerUp = (e: PointerEvent) => {
        if (pressedOutside && isOutside(e)) {
          void closeTopLayerWithFallback(dialog, "");
        }
        pressedOutside = false;
      };
      dialog.addEventListener("pointerdown", onPointerDown);
      dialog.addEventListener("pointerup", onPointerUp);
      cleanupLightDismiss = () => {
        dialog.removeEventListener("pointerdown", onPointerDown);
        dialog.removeEventListener("pointerup", onPointerUp);
      };
    }

    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("cancel", handleCancel);

    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("cancel", handleCancel);
      cleanupLightDismiss?.();
    };
  }, [openNext]);

  const confirm = useCallback(
    (options: string | ConfirmDialogOptions): Promise<boolean> => {
      const state = inferDialogPresentation("confirm", options);
      return new Promise<boolean>((resolve) => {
        queueRef.current.push({ state, resolve });
        openNext();
      });
    },
    [openNext]
  );

  const alert = useCallback(
    (options: string | AlertDialogOptions): Promise<void> => {
      const state = inferDialogPresentation("alert", options);
      return new Promise<void>((resolve) => {
        queueRef.current.push({
          state,
          resolve: () => resolve(),
        });
        openNext();
      });
    },
    [openNext]
  );

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!supportsTopLayerExit()) {
      e.preventDefault();
      const submitter = (e.nativeEvent as SubmitEvent)
        .submitter as HTMLButtonElement | null;
      void closeTopLayerWithFallback(dialog, submitter?.value || "");
    }
  };

  const style = active ? VARIANT_STYLES[active.variant] : VARIANT_STYLES.info;

  const renderIcon = () => {
    if (!active) return null;
    const cls = `w-6 h-6 ${style.iconColor}`;
    if (active.actionType === "delete") return <Trash2 className={cls} />;
    if (active.actionType === "reset") return <RotateCcw className={cls} />;
    if (active.actionType === "sync") return <RefreshCw className={cls} />;
    if (active.variant === "danger" || active.variant === "warning") {
      return <AlertTriangle className={cls} />;
    }
    if (active.variant === "success") return <CheckCircle2 className={cls} />;
    return active.kind === "confirm" ? (
      <HelpCircle className={cls} />
    ) : (
      <Info className={cls} />
    );
  };

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}

      <dialog
        ref={dialogRef}
        {...({ closedby: "any" } as Record<string, string>)}
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="actis-dialog p-0 m-auto bg-transparent border-0 shadow-none w-full max-w-[calc(100vw-2rem)] sm:max-w-[440px] max-h-[calc(100dvh-2rem)] overflow-visible"
      >
        {active && (
          <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 shadow-2xl shadow-slate-950/25 dark:shadow-black/70 text-left">
            {/* Top gradient accent stripe */}
            <div className={`h-1.5 w-full bg-gradient-to-r ${style.accentBar}`} />

            <form method="dialog" onSubmit={handleFormSubmit}>
              {/* Header + Body */}
              <div className="p-6 pb-5">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${style.iconWrapper}`}
                  >
                    {renderIcon()}
                  </div>

                  <div className="flex-1 min-w-0 pt-0.5">
                    <h2
                      id={titleId}
                      className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug pr-7"
                    >
                      {active.title}
                    </h2>
                    <p
                      id={descId}
                      className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words"
                    >
                      {renderHighlightedMessage(active.message)}
                    </p>
                  </div>

                  <button
                    type="submit"
                    value="cancel"
                    aria-label="Tutup dialog"
                    className="p-1.5 -mt-1 -mr-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 bg-slate-50/90 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline">
                  Tekan <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">Esc</kbd> untuk tutup
                </span>

                <div className="flex items-center justify-end gap-2.5 w-full sm:w-auto">
                  {active.kind === "confirm" && (
                    <button
                      type="submit"
                      value="cancel"
                      {...({ autofocus: "" } as Record<string, string>)}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    >
                      {active.cancelText}
                    </button>
                  )}

                  <button
                    type="submit"
                    value="confirm"
                    {...(active.kind === "alert"
                      ? ({ autofocus: "" } as Record<string, string>)
                      : {})}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${style.confirmButton}`}
                  >
                    {active.confirmText}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </dialog>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return ctx;
}

