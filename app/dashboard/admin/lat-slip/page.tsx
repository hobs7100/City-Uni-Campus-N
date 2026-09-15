"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  CalendarDays,
  FileDown,
  GraduationCap,
  History,
  Printer,
  ReceiptText,
  Search,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import { escapePrintHtml, printHtmlDocument } from "@/lib/printDocument";
import { usePortalAccess } from "@/lib/usePortalAccess";

const BATCHES = ["Batch-1", "Batch-2", "Batch-3", "Batch-4", "Batch-5"] as const;
type Batch = (typeof BATCHES)[number];
type Tab = "generate" | "all";

interface SlipForm {
  studentName: string;
  fatherName: string;
  program: string;
  academicYear: string;
  batch: Batch;
  admissionFee: string;
  latFee: string;
  otherCharges: string;
}

interface SavedSlip {
  id: string;
  fid: string;
  student_name: string;
  father_name: string;
  program: string;
  academic_year: number;
  batch: Batch;
  admission_fee: string;
  lat_fee: string;
  other_charges: string;
  total_amount: string;
  generated_by_name: string | null;
  created_at: string;
}

interface BatchCounter {
  batch: Batch;
  slip_count: number;
  revenue: string;
}

const currentYear = new Date().getFullYear();
const initialForm: SlipForm = {
  studentName: "",
  fatherName: "",
  program: "",
  academicYear: String(currentYear),
  batch: "Batch-1",
  admissionFee: "",
  latFee: "",
  otherCharges: "",
};

const fieldClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

function amount(value: string) {
  return Number(value || 0);
}

function money(value: string | number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

async function printSlip(slip: SavedSlip) {
  const generatedDate = new Date(slip.created_at).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const html = `<!doctype html>
    <html><head><meta charset="utf-8"><title>LAT Preparation Charges — FID ${escapePrintHtml(slip.fid)}</title>
    <style>
      @page{size:A4;margin:8mm}
      *{box-sizing:border-box}
      body{margin:0;background:#eef2ff;font-family:Arial,Helvetica,sans-serif;color:#172554;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .sheet{position:relative;width:194mm;min-height:281mm;margin:0 auto;background:#fff;border:1px solid #c7d2fe;overflow:hidden}
      .top-band{height:8px;background:linear-gradient(90deg,#4338ca,#7c3aed,#0891b2)}
      .watermark{position:absolute;right:-35px;top:185px;width:210px;height:210px;border-radius:50%;background:#eef2ff;opacity:.65}
      header{position:relative;padding:22px 30px 19px;text-align:center;background:linear-gradient(135deg,#eef2ff 0%,#fff 50%,#ecfeff 100%);border-bottom:1px solid #c7d2fe}
      header img{width:210px;max-height:65px;object-fit:contain;background:white;padding:5px 10px;border-radius:9px}
      h1{margin:13px 0 5px;color:#312e81;font-size:25px;letter-spacing:.3px;text-transform:uppercase}
      .fid{display:inline-block;padding:5px 13px;border-radius:99px;background:#312e81;color:#fff;font-size:12px;font-weight:800;letter-spacing:1px}
      .content{position:relative;padding:21px 30px}
      .reference{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding:10px 14px;border-radius:9px;background:#eef2ff;color:#3730a3;font-size:11px;font-weight:700}
      .section-title{margin:0 0 9px;color:#475569;font-size:10px;letter-spacing:1.5px;text-transform:uppercase}
      .details{display:grid;grid-template-columns:1fr 1fr;gap:9px 16px;margin-bottom:20px}
      .detail{padding:10px 13px;border:1px solid #e2e8f0;border-radius:9px;background:#f8fafc}
      .detail.full{grid-column:1/-1}
      .label{display:block;margin-bottom:4px;color:#64748b;font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}
      .value{color:#0f172a;font-size:13px;font-weight:700}
      table{width:100%;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid #c7d2fe;border-radius:10px}
      th{padding:9px 13px;background:#4338ca;color:#fff;font-size:10px;letter-spacing:.8px;text-align:left;text-transform:uppercase}
      th:last-child,td:last-child{text-align:right}
      td{padding:10px 13px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:11px}
      tr:last-child td{border-bottom:0}
      .total td{background:#eef2ff;color:#312e81;font-size:14px;font-weight:800}
      .instructions{margin-top:19px;padding:13px 17px;border-left:4px solid #0891b2;border-radius:8px;background:#ecfeff}
      .instructions h2{margin:0 0 6px;color:#155e75;font-size:11px}
      .instructions ol{margin:0;padding-left:18px;color:#475569;font-size:9px;line-height:1.55}
      .signatures{display:grid;grid-template-columns:1fr 1fr;gap:70px;margin-top:38px;text-align:center}
      .signature{padding-top:7px;border-top:1px solid #64748b;color:#475569;font-size:10px;font-weight:700}
      footer{position:absolute;bottom:0;left:0;right:0;padding:10px 25px;background:#312e81;color:#c7d2fe;text-align:center;font-size:9px}
    </style></head><body>
    <section class="sheet" data-fit-single-page data-print-width-mm="194" data-print-height-mm="281">
      <div class="top-band"></div><div class="watermark"></div>
      <header>
        <img src="${window.location.origin}/images/logo.png" alt="College Logo">
        <h1>LAT Preparation Charges</h1>
        <div class="fid">FID: ${escapePrintHtml(slip.fid)}</div>
      </header>
      <main class="content">
        <div class="reference"><span>${escapePrintHtml(slip.batch)} · ${escapePrintHtml(slip.academic_year)}</span><span>GENERATED: ${escapePrintHtml(generatedDate)}</span></div>
        <p class="section-title">Student Information</p>
        <div class="details">
          <div class="detail"><span class="label">Student Name</span><span class="value">${escapePrintHtml(slip.student_name)}</span></div>
          <div class="detail"><span class="label">Father Name</span><span class="value">${escapePrintHtml(slip.father_name)}</span></div>
          <div class="detail full"><span class="label">Program</span><span class="value">${escapePrintHtml(slip.program)}</span></div>
          <div class="detail"><span class="label">Year</span><span class="value">${escapePrintHtml(slip.academic_year)}</span></div>
          <div class="detail"><span class="label">Batch</span><span class="value">${escapePrintHtml(slip.batch)}</span></div>
        </div>
        <p class="section-title">Charges Summary</p>
        <table><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody>
          <tr><td>Admission Fee</td><td>${escapePrintHtml(money(slip.admission_fee))}</td></tr>
          <tr><td>LAT Preparation Fee</td><td>${escapePrintHtml(money(slip.lat_fee))}</td></tr>
          <tr><td>Other Charges</td><td>${escapePrintHtml(money(slip.other_charges))}</td></tr>
          <tr class="total"><td>Total Payable</td><td>${escapePrintHtml(money(slip.total_amount))}</td></tr>
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
  await printHtmlDocument(html, `LAT Slip — FID ${slip.fid}`, { waitForFrameLoad: true });
}

export default function LatSlipPage() {
  const { canEdit, loading: accessLoading } = usePortalAccess("lat_slip");
  const [tab, setTab] = useState<Tab>("generate");
  const [form, setForm] = useState<SlipForm>(initialForm);
  const [generating, setGenerating] = useState(false);
  const [slips, setSlips] = useState<SavedSlip[]>([]);
  const [counters, setCounters] = useState<BatchCounter[]>([]);
  const [search, setSearch] = useState("");
  const [loadingSlips, setLoadingSlips] = useState(false);

  const years = useMemo(
    () => Array.from({ length: 8 }, (_, index) => currentYear + 2 - index),
    [],
  );

  const update = (field: keyof SlipForm, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const loadSlips = useCallback(async (query = "") => {
    setLoadingSlips(true);
    try {
      const response = await fetch(`/api/admin/lat-slip?search=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Unable to load LAT slips.");
        return;
      }
      setSlips(data.slips ?? []);
      setCounters(data.batch_counters ?? []);
    } finally {
      setLoadingSlips(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== "all") return;
    const timer = window.setTimeout(() => void loadSlips(search), 250);
    return () => window.clearTimeout(timer);
  }, [loadSlips, search, tab]);

  async function generateSlip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) {
      toast.error("Generating slips is locked by Portal Management.");
      return;
    }
    setGenerating(true);
    try {
      const response = await fetch("/api/admin/lat-slip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: form.studentName,
          father_name: form.fatherName,
          program: form.program,
          academic_year: Number(form.academicYear),
          batch: form.batch,
          admission_fee: amount(form.admissionFee),
          lat_fee: amount(form.latFee),
          other_charges: amount(form.otherCharges),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Unable to save the LAT slip.");
        return;
      }
      const slip = data.slip as SavedSlip;
      await printSlip(slip);
      setForm({ ...initialForm, academicYear: form.academicYear, batch: form.batch });
      toast.success(`LAT slip FID ${slip.fid} was saved and generated.`);
    } catch {
      toast.error("Unable to generate the LAT slip. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25">
          <ReceiptText size={22} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">LAT Slip</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Generate and manage LAT preparation charge slips
          </p>
        </div>
      </div>

      <div className="mb-6 flex w-fit rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <TabButton active={tab === "generate"} onClick={() => setTab("generate")} icon={<FileDown size={16} />} label="Generate Slip" />
        <TabButton active={tab === "all"} onClick={() => setTab("all")} icon={<History size={16} />} label="All Slips" />
      </div>

      {tab === "generate" ? (
        <form onSubmit={generateSlip} className="mx-auto max-w-5xl overflow-hidden card-3d">
          <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 text-white dark:border-slate-700">
            <h2 className="text-lg font-semibold">Student &amp; Fee Details</h2>
            <p className="mt-1 text-sm text-indigo-100">The FID is assigned automatically when the slip is saved.</p>
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
            <Field label="Select Year" icon={<CalendarDays size={16} />}>
              <select required value={form.academicYear} onChange={(e) => update("academicYear", e.target.value)} className={fieldClass}>
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </Field>
            <Field label="Select Batch" icon={<Users size={16} />}>
              <select required value={form.batch} onChange={(e) => update("batch", e.target.value)} className={fieldClass}>
                {BATCHES.map((batch) => <option key={batch} value={batch}>{batch}</option>)}
              </select>
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
            <button type="submit" disabled={generating || accessLoading || !canEdit} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
              <FileDown size={18} /> {generating ? "Saving & Preparing..." : "Generate Slip"}
            </button>
          </div>
        </form>
      ) : (
        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {BATCHES.map((batch) => {
              const counter = counters.find((item) => item.batch === batch);
              return (
                <div key={batch} className="card-3d p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800 dark:text-white">{batch}</span>
                    <Wallet size={17} className="text-indigo-500" />
                  </div>
                  <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{counter?.slip_count ?? 0}</p>
                  <p className="text-xs text-slate-500">Slips generated</p>
                  <p className="mt-3 border-t border-slate-100 pt-3 text-sm font-semibold text-emerald-700 dark:border-slate-800 dark:text-emerald-400">
                    {money(counter?.revenue ?? 0)}
                  </p>
                  <p className="text-xs text-slate-500">Revenue</p>
                </div>
              );
            })}
          </div>

          <div className="card-3d overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">All LAT Slips</h2>
                <p className="text-xs text-slate-500">{slips.length} matching record{slips.length === 1 ? "" : "s"}</p>
              </div>
              <div className="relative w-full sm:w-80">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} className={`${fieldClass} pl-9`} placeholder="Search by FID or name..." />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">FID</th>
                    <th className="px-4 py-3">Student / Father</th>
                    <th className="px-4 py-3">Program</th>
                    <th className="px-4 py-3">Year / Batch</th>
                    <th className="px-4 py-3 text-right">Admission</th>
                    <th className="px-4 py-3 text-right">LAT Fee</th>
                    <th className="px-4 py-3 text-right">Other</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Generated</th>
                    <th className="px-4 py-3 text-right">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingSlips ? (
                    <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">Loading slips...</td></tr>
                  ) : slips.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">No LAT slips found.</td></tr>
                  ) : slips.map((slip) => (
                    <tr key={slip.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-bold text-indigo-700 dark:text-indigo-300">{slip.fid}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{slip.student_name}</div>
                        <div className="text-xs text-slate-500">Father: {slip.father_name}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{slip.program}</td>
                      <td className="px-4 py-3"><div>{slip.academic_year}</div><div className="text-xs text-slate-500">{slip.batch}</div></td>
                      <td className="px-4 py-3 text-right">{money(slip.admission_fee)}</td>
                      <td className="px-4 py-3 text-right">{money(slip.lat_fee)}</td>
                      <td className="px-4 py-3 text-right">{money(slip.other_charges)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700 dark:text-emerald-400">{money(slip.total_amount)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <div>{new Date(slip.created_at).toLocaleDateString("en-PK")}</div>
                        <div>{slip.generated_by_name || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => void printSlip(slip)} title={`Print FID ${slip.fid}`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10">
                          <Printer size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
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

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${active ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
      {icon}{label}
    </button>
  );
}