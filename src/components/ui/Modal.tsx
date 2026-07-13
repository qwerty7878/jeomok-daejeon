"use client";
import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  hideClose?: boolean;
  dismissable?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  hideClose = false,
  dismissable = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissable, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={() => dismissable && onClose?.()}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "gs-pop relative z-10 flex w-full max-w-md max-h-[85dvh] flex-col overflow-y-auto rounded-3xl border-2 border-foreground/10 bg-card p-6 shadow-2xl",
          className
        )}
      >
        {(title || (!hideClose && dismissable)) && (
          <div className="mb-4 flex items-center justify-between gap-3">
            {title ? (
              <h2 className="font-serif text-2xl text-foreground">{title}</h2>
            ) : (
              <span />
            )}
            {!hideClose && dismissable && (
              <button
                onClick={onClose}
                className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="닫기"
              >
                <X className="size-5" />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
