"use client";

import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";
import { ButtonLoader } from "./Loaders";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} widthClass="max-w-sm">
      <div className="flex flex-col items-center text-center">
        <div className={`icon-tile mb-3 h-14 w-14 ${danger ? "grad-rose" : "grad-primary"}`}>
          <AlertTriangle size={24} />
        </div>
        <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">{message}</p>
        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`card-hover card-press focus-ring flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white shadow-lg transition disabled:opacity-60 ${
              danger ? "grad-rose" : "grad-primary"
            }`}
          >
            {loading && <ButtonLoader className="border-white/40 border-t-white" />}
            {loading ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
