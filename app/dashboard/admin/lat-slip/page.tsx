"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { CalendarDays, FileDown, GraduationCap, ReceiptText, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { escapePrintHtml, printHtmlDocument } from "@/lib/printDocument";

interface SlipForm {
  studentName: string;
  fatherName: string;
  program: string;
  date: string;
  admissionFee: string;
  latFee: string;
  otherCharges: string;
}

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
};

const initialForm: SlipForm = {
  studentName: "",
  fatherName: "",
  program: "",
  date: today(),
  admissionFee: "",
  latFee: "",
  otherCharges: "",
};

const fieldClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

function amount(value: string) {
  return Number(value || 0);
}

function money(value: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function LatSlipPage() {
  const [form, setForm] = useState<SlipForm>(initialForm);
  const [generating, setGenerating] = useState(false);

  const update = (field: keyof SlipForm, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  async function generateSlip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGenerating(true);
    try {
      const admissionFee = amount(form.admissionFee);
      const latFee = amount(form.latFee);
      const otherCharges = amount(form.otherCharges);
      const total = admissionFee + latFee + otherCharges;
      const issueDate = new Date(`${form.date}T00:00:00`).toLocaleDateString("en-PK", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const html = `<!doctype html>
        <html><head><meta charset="utf-8"><title>LAT Preparation Charges</title>
        <style>
          @page{size:A4;margin:8mm}
          *{box-sizing:border-box}
          body{margin:0;background:#eef2ff;font-family:Arial,Helvetica,sans-serif;color:#172554;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          .sheet{position:relative;width:194mm;min-height:281mm;margin:0 auto;background:#fff;border:1px solid #c7d2fe;overflow:hidden}
          .top-band{height:8px;background:linear-gradient(90deg,#4338ca,#7c3aed,#0891b2)}
          .watermark{position:absolute;right:-35px;top:185px;width:210px;height:210px;border-radius:50%;background:#eef2ff;opacity:.65}
          header{position:relative;padding:25px 30px 22px;text-align:center;background:linear-gradient(135deg,#eef2ff 0%,#fff 50%,#ecfeff 100%);border-bottom:1px solid #c7d2fe}
          header img{width:210px;max-height:65px;object-fit:contain;background:white;padding:5px 10px;border-radius:9px}
          h1{margin:15px 0 4px;color:#312e81;font-size:25px;letter-spacing:.3px;text-transform:uppercase}
          .subtitle{color:#64748b;font-size:11px;letter-spacing:2px;text-transform:uppercase}
          .content{position:relative;padding:24px 30px}
          .reference{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;padding:10px 14px;border-radius:9px;background:#eef2ff;color:#3730a3;font-size:11px;font-weight:700}
          .section-title{margin:0 0 10px;color:#475569;font-size:10px;letter-spacing:1.5px;text-transform:uppercase}
          .details{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px;margin-bottom:24px}
          .detail{padding:11px 13px;border:1px solid #e2e8f0;border-radius:9px;background:#f8fafc}
          .detail.full{grid-column:1/-1}
          .label{display:block;margin-bottom:4px;color:#64748b;font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}
          .value{color:#0f172a;font-size:14px;font-weight:700}
          table{width:100%;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid #c7d2fe;border-radius:10px}
          th{padding:10px 13px;background:#4338ca;color:#fff;font-size:10px;letter-spacing:.8px;text-align:left;text-transform:uppercase}
          th:last-child,td:last-child{text-align:right}
          td{padding:12px 13px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:12px}
          tr:last-child td{border-bottom:0}
          .total td{background:#eef2ff;color:#312e81;font-size:15px;font-weight:800}
          .instructions{margin-top:22px;padding:15px 18px;border-left:4px solid #0891b2;border-radius:8px;background:#ecfeff}
          .instructions h2{margin:0 0 7px;color:#155e75;font-size:12px}
          .instructions ol{margin:0;padding-left:18px;color:#475569;font-size:10px;line-height:1.65}
          .signatures{display:grid;grid-template-columns:1fr 1fr;gap:70px;margin-top:46px;text-align:center}
          .signature{padding-top:7px;border-top:1px solid #64748b;color:#475569;font-size:10px;font-weight:700}
          footer{position:absolute;bottom:0;left:0;right:0;padding:10px 25px;background:#312e81;color:#c7d2fe;text-align:center;font-size:9px}
        </style></head><body>
        <section class="sheet" data-fit-single-page data-print-width-mm="194" data-print-height-mm="281">
          <div class="top-band"></div><div class="watermark"></div>
          <header>
            <img src="${window.location.origin}/images/logo.png" alt="College Logo">
            <h1>LAT Preparation Charges</h1>
            <div class="subtitle">Official Fee Slip</div>
          </header>
          <main class="content">
            <div class="reference"><span>LAT PREPARATION PROGRAM</span><span>DATE: ${escapePrintHtml(issueDate)}</span></div>
            <p class="section-title">Student Information</p>
            <div class="details">
              <div class="detail"><span class="label">Student Name</span><span class="value">${escapePrintHtml(form.studentName)}</span></div>
              <div class="detail"><span class="label">Father Name</span><span class="value">${escapePrintHtml(form.fatherName)}</span></div>
              <div class="detail full"><span class="label">Program</span><span class="value">${escapePrintHtml(form.program)}</span></div>
            </div>
            <p class="section-title">Charges Summary</p>
            <table><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody>
              <tr><td>Admission Fee</td><td>${escapePrintHtml(money(admissionFee))}</td></tr>
              <tr><td>LAT Preparation Fee</td><td>${escapePrintHtml(money(latFee))}</td></tr>
              <tr><td>Other Charges</td><td>${escapePrintHtml(money(otherCharges))}</td></tr>
              <tr class="total"><td>Total Payable</td><td>${escapePrintHtml(money(total))}</td></tr>
            </tbody></table>
            <section class="instructions"><h2>Important Instructions</h2><ol>
              <li>Please deposit the total amount with the college accounts office.</li>
              <li>Keep the paid copy of this slip as proof of payment.</li>
              <li>Fees once deposited are non-refundable and non-transferable.</li>
              <li>Admission to LAT preparation classes is confirmed after payment verification.</li>
            </ol></section>
            <div class="signatures"><div class="signature">Student / Guardian Signature</div><div class="signature">Authorized Signature</div></div>
          </main>
          <footer>This is a computer-generated LAT preparation charges slip.</footer>
        </section></body></html>`;
      await printHtmlDocument(html, `LAT Slip — ${form.studentName}`);
      toast.success("LAT slip is ready. Choose Save as PDF in the print dialog.");
    } catch {
      toast.error("Unable to generate the LAT slip. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25">
            <ReceiptText size={22} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">LAT Slip</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Create a professional LAT preparation charges slip
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={generateSlip} className="overflow-hidden card-3d">
        <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 text-white dark:border-slate-700">
          <h2 className="text-lg font-semibold">Student &amp; Fee Details</h2>
          <p className="mt-1 text-sm text-indigo-100">Complete all fields before generating the slip.</p>
        </div>
        <div className="grid gap-5 p-6 md:grid-cols-2">
          <Field label="Student Name" icon={<UserRound size={16} />}>
            <input required value={form.studentName} onChange={(e) => update("studentName", e.target.value)} className={fieldClass} placeholder="Enter student name" />
          </Field>
          <Field label="Father Name" icon={<UserRound size={16} />}>
            <input required value={form.fatherName} onChange={(e) => update("fatherName", e.target.value)} className={fieldClass} placeholder="Enter father name" />
          </Field>
          <Field label="Program" icon={<GraduationCap size={16} />}>
            <input required value={form.program} onChange={(e) => update("program", e.target.value)} className={fieldClass} placeholder="e.g. LAT Preparation Program" />
          </Field>
          <Field label="Date" icon={<CalendarDays size={16} />}>
            <input required type="date" value={form.date} onChange={(e) => update("date", e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Admission Fee (PKR)">
            <input required min="0" step="1" type="number" value={form.admissionFee} onChange={(e) => update("admissionFee", e.target.value)} className={fieldClass} placeholder="0" />
          </Field>
          <Field label="LAT Fee (PKR)">
            <input required min="0" step="1" type="number" value={form.latFee} onChange={(e) => update("latFee", e.target.value)} className={fieldClass} placeholder="0" />
          </Field>
          <Field label="Other Charges (PKR)">
            <input required min="0" step="1" type="number" value={form.otherCharges} onChange={(e) => update("otherCharges", e.target.value)} className={fieldClass} placeholder="0" />
          </Field>
          <div className="flex items-end">
            <div className="w-full rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/30">
              <span className="block text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">Total Payable</span>
              <span className="mt-1 block text-xl font-bold text-indigo-950 dark:text-white">
                {money(amount(form.admissionFee) + amount(form.latFee) + amount(form.otherCharges))}
              </span>
            </div>
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-900/40">
          <button type="submit" disabled={generating} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
            <FileDown size={18} /> {generating ? "Preparing Slip..." : "Generate Slip"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{icon}{label}</span>
      {children}
    </label>
  );
}