"use client";

import React, { useEffect, useRef } from "react";

interface NativeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  ariaLabelledBy: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

/**
 * Wrapper modal berbasis elemen native <dialog> sesuai modern-web-guidance:
 * - showModal() top-layer & fokus otomatis
 * - closedby="any" + fallback pointerdown/pointerup luar bounding box (aman saat drag kanvas 3D)
 * - overscroll-behavior: contain pada globals.css
 */
export function NativeDialog({
  isOpen,
  onClose,
  ariaLabelledBy,
  maxWidthClass = "max-w-6xl",
  children,
}: NativeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.returnValue = "";
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleNativeClose = () => {
      dialog.returnValue = "";
      onClose();
    };

    dialog.addEventListener("close", handleNativeClose);

    // Fallback untuk browser tanpa dukungan <dialog closedby="any">
    let removePointerFallback: (() => void) | undefined;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const isOutside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        );
      };
      let pressedOutside = false;
      const onPointerDown = (e: PointerEvent) => {
        pressedOutside = isOutside(e);
      };
      const onPointerUp = (e: PointerEvent) => {
        if (pressedOutside && isOutside(e) && dialog.open) {
          dialog.close();
        }
        pressedOutside = false;
      };
      dialog.addEventListener("pointerdown", onPointerDown);
      dialog.addEventListener("pointerup", onPointerUp);
      removePointerFallback = () => {
        dialog.removeEventListener("pointerdown", onPointerDown);
        dialog.removeEventListener("pointerup", onPointerUp);
      };
    }

    return () => {
      dialog.removeEventListener("close", handleNativeClose);
      removePointerFallback?.();
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={ariaLabelledBy}
      {...({ closedby: "any" } as Record<string, string>)}
      className={`m-auto w-[calc(100vw-1.5rem)] ${maxWidthClass} max-h-[92vh] rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl p-0 overflow-hidden`}
    >
      {isOpen ? children : null}
    </dialog>
  );
}

