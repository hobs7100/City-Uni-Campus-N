"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ReceiptText,
  X,
} from "lucide-react";
import type { AttendanceFineAssessment } from "@/lib/attendance-fines";

type FineWithPaidAmount = AttendanceFineAssessment & { paid_amount: number };

type FinePaymentDialogProps = {
  fine: Pick<
    FineWithPaidAmount,
    | "name"
    | "class_name"
    | "semester_number"
    | "gross_amount"
    | "discount_amount"
    | "paid_amount"
    | "net_amount"
  >;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (fid: string, paidDate: string) => Promise<void>;
};

const money = (value: number) =>
  `PKR ${Number(value || 0).toLocaleString("en-PK", {
    maximumFractionDigits: 0,
  })}`;

const getLocalDate = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

export default function FinePaymentDialog({
  fine,
  submitting,
  onClose,
  onSubmit,
}: FinePaymentDialogProps) {
  const [fid, setFid] = useState("");
  const [paidDate, setPaidDate] = useState(getLocalDate);
  const fidInputRef = useRef<HTMLInputElement>(null);
  const submitLock = useRef(false);
  const payable = Math.max(0, Number(fine.net_amount || 0) - Number(fine.paid_amount || 0));
  const canSubmit = fid.trim().length > 0 && paidDate.length > 0 && payable > 0;

  useEffect(() => {
    fidInputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting && !submitLock.current) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, submitting]);

  const close = () => {
    if (!submitting && !submitLock.current) onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || submitting || submitLock.current) return;
    submitLock.current = true;
    try {
      await onSubmit(fid.trim(), paidDate);
    } catch {
      // The manager owns request errors and their presentation.
    } finally {
      submitLock.current = false;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex min-h-[100dvh] items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[3px] sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        aria-labelledby="fine-payment-title"
        aria-modal="true"
        className="w-full max-w-[560px] overflow-hidden rounded-t-[26px] border border-slate-200/80 bg-[#fbfcfb] shadow-[0_28px_90px_rgba(15,23,42,0.28)] sm:rounded-[26px]"
        role="dialog"
      >
        <header className="relative overflow-hidden bg-[#f1f7f5] px-5 pb-5 pt-6 sm:px-7 sm:pt-7">
          <div className="absolute -right-8 -top-12 h-36 w-36 rounded-full border-[18px] border-teal-700/[0.06]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-md shadow-teal-900/15">
                <ReceiptText className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.19em] text-teal-800">
                  Attendance fine · receipt
                </p>
                <h2
                  className="mt-1 text-[22px] font-black tracking-[-0.04em] text-slate-950"
                  id="fine-payment-title"
                >
                  Record payment
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Verify the receipt details before saving.
                </p>
              </div>
            </div>
            <button
              aria-label="Close payment dialog"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-slate-500 transition hover:border-teal-300 hover:text-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-600/15 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={submitting}
              onClick={close}
              type="button"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="relative mt-5 flex items-center gap-3 rounded-2xl border border-white/90 bg-white/75 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <span className="text-xs font-black">{fine.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-slate-800">{fine.name}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                {fine.class_name}
                <span className="px-1.5 text-slate-300">·</span>
                Semester {fine.semester_number}
              </p>
            </div>
          </div>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
            <section aria-label="Fine amount breakdown">
              <div className="mb-2 flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4 text-teal-700" aria-hidden="true" />
                <h3 className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                  Amount reconciliation
                </h3>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="divide-y divide-slate-100 px-4">
                  <div className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className="font-medium text-slate-500">Gross fine</span>
                    <span className="font-bold tabular-nums text-slate-800">{money(fine.gross_amount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className="font-medium text-slate-500">Discount</span>
                    <span className="font-bold tabular-nums text-indigo-700">− {money(fine.discount_amount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className="font-medium text-slate-500">Fine after adjustment</span>
                    <span className="font-bold tabular-nums text-slate-800">{money(fine.net_amount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className="font-medium text-slate-500">Already paid</span>
                    <span className="font-bold tabular-nums text-teal-800">{money(fine.paid_amount)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 bg-[#edf6f3] px-4 py-3.5">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-teal-800">
                      Payable now
                    </p>
                    <p className="mt-0.5 text-[11px] text-teal-800/70">Read-only · exact balance due</p>
                  </div>
                  <p className="text-xl font-black tracking-tight tabular-nums text-teal-900">{money(payable)}</p>
                </div>
              </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                  Receipt FID <span className="text-rose-600">*</span>
                </span>
                <span className="relative block">
                  <ReceiptText className="absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                  <input
                    ref={fidInputRef}
                    autoComplete="off"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 disabled:bg-slate-50"
                    disabled={submitting}
                    onChange={(event) => setFid(event.target.value)}
                    placeholder="Enter receipt reference"
                    required
                    type="text"
                    value={fid}
                  />
                </span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                  Payment date <span className="text-rose-600">*</span>
                </span>
                <span className="relative block">
                  <CalendarDays className="absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                  <input
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 disabled:bg-slate-50"
                    disabled={submitting}
                    onChange={(event) => setPaidDate(event.target.value)}
                    required
                    type="date"
                    value={paidDate}
                  />
                </span>
              </label>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/75 px-3.5 py-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="text-xs leading-[1.55] text-amber-950/80">
                <strong className="font-extrabold text-amber-950">Fine payment only.</strong>{" "}
                Collecting this fine does not change student enrollment, restore enrollment, or restart the attendance protection period.
              </p>
            </div>
          </div>

          <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-[#f8faf9] px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            <button
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={submitting}
              onClick={close}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-extrabold text-white shadow-sm shadow-teal-900/15 transition hover:bg-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-600/20 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canSubmit || submitting}
              type="submit"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Saving receipt…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Record payment
                </>
              )}
            </button>
          </footer>
          <span className="sr-only" aria-live="polite">
            {submitting ? "Payment receipt is being saved." : ""}
          </span>
        </form>
      </section>
    </div>
  );
}
