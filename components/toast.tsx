"use client";

import { useEffect, useState } from "react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
};

let toastIdCounter = 0;
const listeners = new Set<(toast: Toast) => void>();

export const showToast = {
  success: (message: string, duration = 4000) => {
    const toast: Toast = {
      id: `toast-${++toastIdCounter}`,
      message,
      type: "success",
      duration,
    };
    listeners.forEach((listener) => listener(toast));
  },
  error: (message: string, duration = 5000) => {
    const toast: Toast = {
      id: `toast-${++toastIdCounter}`,
      message,
      type: "error",
      duration,
    };
    listeners.forEach((listener) => listener(toast));
  },
  info: (message: string, duration = 4000) => {
    const toast: Toast = {
      id: `toast-${++toastIdCounter}`,
      message,
      type: "info",
      duration,
    };
    listeners.forEach((listener) => listener(toast));
  },
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handleToast = (toast: Toast) => {
      setToasts((prev) => [...prev, toast]);

      // Auto-remove após duração
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, toast.duration || 4000);
    };

    listeners.add(handleToast);
    return () => {
      listeners.delete(handleToast);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        }} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 200);
  };

  const bgColor = {
    success: "bg-emerald-900/95 border-emerald-700",
    error: "bg-red-900/95 border-red-700",
    info: "bg-sky-900/95 border-sky-700",
  }[toast.type];

  const icon = {
    success: (
      <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="h-5 w-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  }[toast.type];

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border ${bgColor} px-4 py-3 shadow-xl backdrop-blur-sm transition-all duration-200 ${
        isExiting ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"
      }`}
      style={{ minWidth: "300px", maxWidth: "400px" }}
    >
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <p className="flex-1 text-sm font-medium text-white">{toast.message}</p>
      <button
        onClick={handleClose}
        className="flex-shrink-0 text-slate-400 hover:text-white transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
