"use client";
import { useEffect, useState } from "react";

interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

let _addToast: ((msg: string, type?: ToastItem["type"]) => void) | null = null;

export function toast(message: string, type: ToastItem["type"] = "info") {
  _addToast?.(message, type);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    _addToast = (message, type = "info") => {
      const id = Math.random().toString(36);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    };
    return () => { _addToast = null; };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-2 rounded shadow-lg text-sm font-medium text-white animate-fade-in ${
            t.type === "error"
              ? "bg-red-600"
              : t.type === "success"
              ? "bg-green-600"
              : "bg-gray-800"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
