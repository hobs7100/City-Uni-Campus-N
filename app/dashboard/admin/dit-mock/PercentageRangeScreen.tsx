"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from "react";
import { Printer, RefreshCw } from "lucide-react";
import AnalyticsFilterFields from "./AnalyticsFilterFields";
import { type AnalyticsFilters, type AnalyticsOptions } from "./analyticsFilters";
import { escapePrintHtml, printHtmlDocument } from "@/lib/printDocument";

type PercentageStudent = {
  student_id: string | number;
  name: string;
  father_name?: string | null;
  roll_no?: string | null;
  class_name?: string | null;
  session?: string | null;
  semester_number?: string | number | null;
  term_type?: string | null;
  total_obtained: number;
  total_marks: number;
  percentage: number;
  grade?: string | null;
  test_count?: number;
};

type EffectiveFilters = Record<string, string | number | null | undefined>;
type PercentageResponse = {
  students?: PercentageStudent[];
  filter_options?: AnalyticsOptions;
  effective_filters?: EffectiveFilters;
};

const initialFilters: AnalyticsFilters = {
  class_id: "",
  session: "",
  semester_id: "",
  course_id: "",
  test_series_id: "",
};

const formatNumber = (value: unknown, digits = 1) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "0.0";
};

const displayValue = (value: unknown) =>
  value === null || value === undefined || value === "" ? "—" : String(value);

function validateRange(
  fromDate: string,
  toDate: string,
  minPercentage: string,
  maxPercentage: string,
) {
  const errors: Record<string, string> = {};
  const parsePercentage = (value: string, field: string, label: string) => {
    if (value.trim() === "") {
      errors[field] = `${label} is required.`;
      return null;
    }
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 100) {
      errors[field] = `${label} must be a number from 0 to 100.`;
      return null;
    }
    return number;
  };
  const min = parsePercentage(minPercentage, "min", "Minimum percentage");
  const max = parsePercentage(maxPercentage, "max", "Maximum percentage");
  if (min !== null && max !== null && min > max) {
    errors.max = "Maximum percentage must be greater than or equal to minimum.";
  }
  if (fromDate && toDate && fromDate > toDate) {
    errors.dates = "From date must not be after To date.";
  }
  return { errors, min, max, valid: Object.keys(errors).length === 0 };
}

function optionLabel(options: AnalyticsOptions, field: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "All";
  const key = String(value);
  const match = (options[field] ?? []).find((option) =>
    typeof option === "string" ? option === key : String(option.id) === key,
  );
  if (!match) return key;
  if (typeof match === "string") return match;
  if (field === "semester_id") {
    return `Semester ${match.name ?? match.id}${match.term_type ? ` · ${match.term_type}` : ""}`;
  }
  return `${match.code ? `${match.code} — ` : ""}${match.name ?? match.title ?? match.id}`;
}

export default function PercentageRangeScreen() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filters, setFilters] = useState<AnalyticsFilters>(initialFilters);
  const [minPercentage, setMinPercentage] = useState("0");
  const [maxPercentage, setMaxPercentage] = useState("100");
  const [students, setStudents] = useState<PercentageStudent[]>([]);
  const [options, setOptions] = useState<AnalyticsOptions>({});
  const [effectiveFilters, setEffectiveFilters] = useState<EffectiveFilters | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [loadedRefreshKey, setLoadedRefreshKey] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const requestId = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const validation = useMemo(
    () => validateRange(fromDate, toDate, minPercentage, maxPercentage),
    [fromDate, toDate, minPercentage, maxPercentage],
  );
  const queryKey = useMemo(
    () => JSON.stringify({ fromDate, toDate, filters, minPercentage, maxPercentage }),
    [fromDate, toDate, filters, minPercentage, maxPercentage],
  );

  useEffect(() => {
    const id = ++requestId.current;
    controllerRef.current?.abort();
    if (!validation.valid || validation.min === null || validation.max === null) {
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    const params = new URLSearchParams();
    if (fromDate) params.set("from_date", fromDate);
    if (toDate) params.set("to_date", toDate);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    params.set("min_percentage", String(validation.min));
    params.set("max_percentage", String(validation.max));

    setLoading(true);
    setError("");
    void (async () => {
      try {
        const response = await fetch(`/api/admin/dit/analytics/percentage-range?${params.toString()}`, {
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error || "Unable to load percentage results.");
        if (controller.signal.aborted || id !== requestId.current) return;
        const result = body as PercentageResponse;
        setStudents(Array.isArray(result.students) ? result.students : []);
        setOptions(result.filter_options ?? {});
        setEffectiveFilters(result.effective_filters ?? {});
        setLoadedKey(queryKey);
        setLoadedRefreshKey(refreshKey);
      } catch (cause) {
        if (controller.signal.aborted || id !== requestId.current) return;
        setStudents([]);
        setEffectiveFilters(null);
        setLoadedKey("");
        setError(cause instanceof Error ? cause.message : "Unable to load percentage results.");
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    })();
    return () => {
      controller.abort();
    };
  }, [queryKey, refreshKey, fromDate, toDate, filters, validation.valid, validation.min, validation.max]);

  const currentData = loadedKey === queryKey && loadedRefreshKey === refreshKey && validation.valid && !loading && !error;
  const visibleStudents = useMemo(() => currentData ? students : [], [currentData, students]);
  const gradeCounts = useMemo(() => visibleStudents.reduce<Record<string, number>>((counts, student) => {
    const grade = displayValue(student.grade);
    counts[grade] = (counts[grade] ?? 0) + 1;
    return counts;
  }, {}), [visibleStudents]);
  const totalObtained = visibleStudents.reduce((sum, student) => sum + (Number(student.total_obtained) || 0), 0);
  const totalMaximum = visibleStudents.reduce((sum, student) => sum + (Number(student.total_marks) || 0), 0);
  const canPrint = currentData && visibleStudents.length > 0;

  const printReport = () => {
    if (!canPrint || !effectiveFilters) return;
    const selected = [
      ["From date", effectiveFilters.from_date === "1900-01-01" ? "All dates" : displayValue(effectiveFilters.from_date)],
      ["To date", effectiveFilters.to_date === "9999-12-31" ? "All dates" : displayValue(effectiveFilters.to_date)],
      ["Class", optionLabel(options, "class_id", effectiveFilters.class_id)],
      ["Session", displayValue(effectiveFilters.session) === "—" ? "All" : displayValue(effectiveFilters.session)],
      ["Semester", optionLabel(options, "semester_id", effectiveFilters.semester_id)],
      ["Course", optionLabel(options, "course_id", effectiveFilters.course_id)],
      ["Test series", optionLabel(options, "test_series_id", effectiveFilters.test_series_id)],
      ["Inclusive percentage range", `${displayValue(effectiveFilters.min_percentage)}% – ${displayValue(effectiveFilters.max_percentage)}%`],
    ];
    const meta = selected.map(([label, value]) =>
      `<div><strong>${escapePrintHtml(label)}:</strong> ${escapePrintHtml(value)}</div>`,
    ).join("");
    const columns = ["Roll No", "Student", "Class", "Session", "Marks", "Percentage", "Grade"];
    const headings = columns.map((column) => `<th>${escapePrintHtml(column)}</th>`).join("");
    const rows = visibleStudents.map((student) => `<tr>
      <td>${escapePrintHtml(displayValue(student.roll_no))}</td>
      <td>${escapePrintHtml(displayValue(student.name))}</td>
      <td>${escapePrintHtml(displayValue(student.class_name))}</td>
      <td>${escapePrintHtml(displayValue(student.session))}</td>
      <td>${escapePrintHtml(`${formatNumber(student.total_obtained)} / ${formatNumber(student.total_marks)}`)}</td>
      <td>${escapePrintHtml(`${formatNumber(student.percentage)}%`)}</td>
      <td>${escapePrintHtml(displayValue(student.grade))}</td>
    </tr>`).join("");
    const gradeSummary = Object.entries(gradeCounts)
      .map(([grade, count]) => `${grade}: ${count}`).join(" · ") || "—";
    const html = `<html><head><title>Marks Percentage Report</title><style>
      @page{size:A4 landscape;margin:14mm}body{font:12px Arial,sans-serif;color:#172033}
      h1{color:#3730a3;margin:0 0 5px}.college{font-size:15px;font-weight:bold;margin-bottom:4px}
      .printed{color:#64748b;margin-bottom:14px}.filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px 14px;border:1px solid #cbd5e1;padding:10px;margin-bottom:12px}
      .summary{margin:10px 0;color:#334155}table{width:100%;border-collapse:collapse}
      th{background:#eef2ff;color:#312e81;text-align:left}th,td{border:1px solid #cbd5e1;padding:6px}
      tr{break-inside:avoid;page-break-inside:avoid}
    </style></head><body>
      <div class="college">${escapePrintHtml("CITY COLLEGE (University Campus)")}</div>
      <h1>Marks Percentage Report</h1>
      <div class="printed">Printed ${escapePrintHtml(new Date().toLocaleDateString())}</div>
      <div class="filters">${meta}</div>
      <p class="summary"><strong>Students:</strong> ${visibleStudents.length} &nbsp; · &nbsp; <strong>Grades:</strong> ${escapePrintHtml(gradeSummary)}<br>
      <strong>Total marks:</strong> ${escapePrintHtml(`${formatNumber(totalObtained)} / ${formatNumber(totalMaximum)}`)}<br>
      Percentage is calculated as total obtained marks ÷ total maximum marks × 100; the inclusive range is applied to unrounded weighted percentages.</p>
      <table><thead><tr>${headings}</tr></thead><tbody>${rows}</tbody></table>
    </body></html>`;
    void printHtmlDocument(html, "Marks Percentage Report");
  };

  return <div className="space-y-5">
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-800">Marks Percentage</h2>
        <p className="mt-1 text-sm text-slate-500">Review students whose weighted result falls within an inclusive percentage range.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="text-xs font-semibold text-slate-500">From date
          <input aria-label="From date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 block rounded border px-2 py-2 text-sm text-slate-800" />
        </label>
        <label className="text-xs font-semibold text-slate-500">To date
          <input aria-label="To date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 block rounded border px-2 py-2 text-sm text-slate-800" />
        </label>
        <AnalyticsFilterFields filters={filters} options={options} onChange={setFilters} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600">
          Minimum percentage (inclusive)
          <span className="mt-1 block font-normal text-slate-500">Students at or above this weighted percentage are included.</span>
          <input aria-label="Minimum percentage inclusive" inputMode="decimal" type="number" min="0" max="100" step="any" value={minPercentage} onChange={(event) => setMinPercentage(event.target.value)} aria-invalid={Boolean(validation.errors.min)} aria-describedby={validation.errors.min ? "percentage-min-error" : "percentage-formula"} className="mt-2 block w-full max-w-xs rounded border px-3 py-2 text-sm text-slate-800" />
          {validation.errors.min && <span id="percentage-min-error" role="alert" className="mt-1 block text-xs font-medium text-red-600">{validation.errors.min}</span>}
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Maximum percentage (inclusive)
          <span className="mt-1 block font-normal text-slate-500">Students at or below this weighted percentage are included.</span>
          <input aria-label="Maximum percentage inclusive" inputMode="decimal" type="number" min="0" max="100" step="any" value={maxPercentage} onChange={(event) => setMaxPercentage(event.target.value)} aria-invalid={Boolean(validation.errors.max)} aria-describedby={validation.errors.max ? "percentage-max-error" : "percentage-formula"} className="mt-2 block w-full max-w-xs rounded border px-3 py-2 text-sm text-slate-800" />
          {validation.errors.max && <span id="percentage-max-error" role="alert" className="mt-1 block text-xs font-medium text-red-600">{validation.errors.max}</span>}
        </label>
      </div>
      <p id="percentage-formula" className="mt-3 text-xs text-slate-500">Weighted percentage = total obtained marks ÷ total maximum marks × 100. Range checks use the unrounded result.</p>
      {validation.errors.dates && <p role="alert" className="mt-2 text-sm font-medium text-red-600">{validation.errors.dates}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={!validation.valid || loading} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />{loading ? "Loading…" : "Apply / Refresh"}
        </button>
        <button type="button" onClick={printReport} disabled={!canPrint} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
          <Printer className="h-4 w-4" aria-hidden="true" />Print / Save PDF
        </button>
      </div>
    </div>

    {loading && <div role="status" aria-live="polite" className="space-y-3 rounded-xl border bg-white p-4">
      <span className="text-sm font-medium text-slate-600">Loading percentage results…</span>
      {[0, 1, 2].map((item) => <div key={item} className="h-9 animate-pulse rounded bg-indigo-50" />)}
    </div>}
    {!validation.valid && !loading && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Correct the highlighted filters to load results.</div>}
    {error && !loading && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-semibold text-red-800">{error}</p>
      <button type="button" onClick={() => setRefreshKey((value) => value + 1)} className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-800">Retry</button>
    </div>}
    {currentData && visibleStudents.length === 0 && <div className="rounded-xl border bg-white p-8 text-center">
      <h3 className="font-semibold text-slate-800">No students in this percentage range</h3>
      <p className="mt-1 text-sm text-slate-500">Adjust the dates, class filters, or inclusive percentage bounds and try again.</p>
    </div>}
    {currentData && visibleStudents.length > 0 && <section aria-label="Percentage report results" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h3 className="text-base font-bold text-slate-800">Matching students</h3><p className="text-sm text-slate-500">{visibleStudents.length} student{visibleStudents.length === 1 ? "" : "s"} · Grades: {Object.entries(gradeCounts).map(([grade, count]) => `${grade} ${count}`).join(" · ")}</p></div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">Student marks percentage results matching the selected inclusive percentage range</caption>
          <thead><tr className="bg-indigo-50 text-xs font-semibold uppercase tracking-wide text-indigo-950">
            {["Roll No", "Student", "Class", "Session", "Marks obtained / total", "Percentage", "Grade"].map((heading) => <th key={heading} scope="col" className="whitespace-nowrap p-3">{heading}</th>)}
          </tr></thead>
          <tbody>{visibleStudents.map((student) => <tr key={student.student_id} className="border-t border-slate-100">
            <td className="whitespace-nowrap p-3 text-slate-600">{displayValue(student.roll_no)}</td>
            <td className="p-3 font-medium text-slate-800">{displayValue(student.name)}</td>
            <td className="p-3 text-slate-600">{displayValue(student.class_name)}</td>
            <td className="p-3 text-slate-600">{displayValue(student.session)}</td>
            <td className="whitespace-nowrap p-3 tabular-nums text-slate-700">{formatNumber(student.total_obtained)} / {formatNumber(student.total_marks)}</td>
            <td className="whitespace-nowrap p-3 font-semibold tabular-nums text-slate-800">{formatNumber(student.percentage)}%</td>
            <td className="p-3 font-semibold text-slate-700">{displayValue(student.grade)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>}
  </div>;
}
