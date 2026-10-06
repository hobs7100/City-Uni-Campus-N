"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from "react";
import { FileDown, Printer, Search, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import toast from "react-hot-toast";
import { escapePrintHtml, printHtmlDocument } from "@/lib/printDocument";
import { reportChartsHtml, reportSignaturesHtml, type DitReportChartData } from "./ReportCharts";
import { formatReportDate, localReportDate } from "./reportDate";
import { printResultReports } from "./ReportPrint";
import AnalyticsFilterFields from "./AnalyticsFilterFields";
import PercentageRangeScreen from "./PercentageRangeScreen";

type Zone = "toppers" | "good" | "average" | "warning" | "danger";
const zones: Zone[] = ["toppers", "good", "average", "warning", "danger"];
const zoneLabels: Record<Zone, string> = { toppers: "Toppers", good: "Good", average: "Average", warning: "Warning", danger: "Danger" };
const zoneName = (value: unknown) => { const key = String(value); return Object.prototype.hasOwnProperty.call(zoneLabels, key) ? zoneLabels[key as Zone] : key; };
const zoneColors: Record<Zone, string> = { toppers: "#10b981", good: "#3b82f6", average: "#f59e0b", warning: "#f97316", danger: "#ef4444" };
type AnyRecord = Record<string, any>;
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const testKey = (t: AnyRecord) => `${t.date ?? t.test_date}|${t.test_number ?? t.test_series_id ?? t.series_name}|${t.course_code ?? t.course_id}`;

function printTable(title: string, columns: string[], rows: string[][], header = "", footer = "", landscapeSinglePage = false) {
  const h = columns.map((x) => `<th>${escapePrintHtml(x)}</th>`).join("");
  const b = rows.map((r) => `<tr>${r.map((x) => `<td>${escapePrintHtml(String(x ?? "—"))}</td>`).join("")}</tr>`).join("");
  const content = `${header}<h1>${escapePrintHtml(title)}</h1><table><thead><tr>${h}</tr></thead><tbody>${b}</tbody></table>${footer}`;
  const page = landscapeSinglePage
    ? `<main data-fit-single-page data-print-width-mm="279" data-print-height-mm="180" style="width:279mm">${content}</main>`
    : content;
  const layout = landscapeSinglePage
    ? `@page{size:A4 landscape;margin:0}body{width:279mm;padding:8mm;margin:0;box-sizing:content-box;font-size:11px}
       h1{margin:8px 0}h2,p{margin:4px 0}table{margin-top:8px}th,td{padding:1px 5px}
       .report-charts{grid-template-columns:repeat(2,minmax(0,1fr))!important;overflow:visible!important}
       .report-charts{margin-top:10px!important}.report-chart{min-width:0;padding:8px!important}
       .report-signatures{margin-top:18px!important}
       .report-signatures>div{flex:0 0 125px!important;max-width:125px}`
    : `@media print{body{padding:0}}`;
  void printHtmlDocument(`<html><head><title>${escapePrintHtml(title)}</title><style>
    body{font:12px Arial;color:#172033;padding:24px}h1{color:#3730a3}
    table{border-collapse:collapse;width:100%;margin-top:18px}
    th{background:#3730a3;color:#fff}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}
    .report-chart,.report-signatures{break-inside:avoid;page-break-inside:avoid}
    ${layout}</style></head><body>${page}</body></html>`, title,
    landscapeSinglePage ? { waitForFrameLoad: true, frameWidthMm: 297, frameHeightMm: 210 } : {});
}

export default function DitAnalytics() {
  const [tab, setTab] = useState<"subjects" | "result" | "zones" | "percentage">("subjects");
  const [from, setFrom] = useState(""), [to, setTo] = useState("");
  const [zoneFrom, setZoneFrom] = useState(""), [zoneTo, setZoneTo] = useState("");
  const [filters, setFilters] = useState<AnyRecord>({}), [zoneFilters, setZoneFilters] = useState<AnyRecord>({});
  const [subjects, setSubjects] = useState<AnyRecord[]>([]), [summary, setSummary] = useState<AnyRecord>({});
  const [optionsData, setOptionsData] = useState<AnyRecord>({}), [zoneOptionsData, setZoneOptionsData] = useState<AnyRecord>({});
  const [loading, setLoading] = useState(false), [zoneLoading, setZoneLoading] = useState(false);
  const [subjectError, setSubjectError] = useState(""), [zoneError, setZoneError] = useState("");
  const [studentQ, setStudentQ] = useState(""), [students, setStudents] = useState<AnyRecord[]>([]);
  const [studentId, setStudentId] = useState(""), [report, setReport] = useState<AnyRecord | null>(null);
  const [selectedZone, setSelectedZone] = useState<Zone>("toppers"), [zoneData, setZoneData] = useState<AnyRecord | null>(null);
  const [detail, setDetail] = useState<AnyRecord | null>(null);
  const subjectRequest = useRef<AbortController | null>(null);
  const zoneRequest = useRef<AbortController | null>(null);
  const subjectQuery = (extra: AnyRecord = {}) => new URLSearchParams({ ...(from ? { from_date: from } : {}), ...(to ? { to_date: to } : {}), ...Object.fromEntries(Object.entries(filters).filter(([k, v]) => k !== "__options" && v)), ...extra }).toString();
  const loadSubjects = useCallback(async () => {
    subjectRequest.current?.abort();
    const controller = new AbortController();
    subjectRequest.current = controller;
    setLoading(true); setSubjects([]); setSummary({}); setDetail(null); setSubjectError("");
    const query = new URLSearchParams({ ...(from ? { from_date: from } : {}), ...(to ? { to_date: to } : {}),
      ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) });
    try {
      const response = await fetch(`/api/admin/dit/analytics?${query}`, { signal: controller.signal });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(data.error || "Unable to load analytics.");
      setSubjects(data.subjects ?? []); setSummary(data.summary ?? {}); setOptionsData(data.filter_options ?? {});
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : "Unable to load analytics.";
        setSubjectError(message); toast.error(message);
      }
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [from, to, filters]);
  useEffect(() => { void loadSubjects(); return () => subjectRequest.current?.abort(); }, [loadSubjects]);
  useEffect(() => { if (studentQ.trim().length < 2) { setStudents([]); return; } const timer = setTimeout(async () => { try { const d = await (await fetch(`/api/admin/dit/analytics/student-search?q=${encodeURIComponent(studentQ)}`)).json(); setStudents(Array.isArray(d) ? d : d.students ?? []); } catch { /* optional search */ } }, 350); return () => clearTimeout(timer); }, [studentQ]);
  async function loadReport() { if (!studentId) return toast.error("Select a student first."); try { const r = await fetch(`/api/admin/dit/analytics/student-report?${subjectQuery({ student_id: studentId })}`); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Unable to load report."); setReport(d); } catch (e) { setReport(null); toast.error(e instanceof Error ? e.message : "Unable to load report."); } }
  const loadZones = useCallback(async () => {
    zoneRequest.current?.abort();
    const controller = new AbortController();
    zoneRequest.current = controller;
    setZoneLoading(true); setZoneData(null); setDetail(null); setZoneError("");
    const query = new URLSearchParams({ ...(zoneFrom ? { from_date: zoneFrom } : {}), ...(zoneTo ? { to_date: zoneTo } : {}),
      scope: "overall", zone: selectedZone, ...Object.fromEntries(Object.entries(zoneFilters).filter(([, value]) => value)) });
    try {
      const response = await fetch(`/api/admin/dit/analytics/zones?${query}`, { signal: controller.signal });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(data.error || "Unable to load zones.");
      setZoneData(data); setZoneOptionsData(data.filter_options ?? {});
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : "Unable to load zones.";
        setZoneError(message); toast.error(message);
      }
    } finally { if (!controller.signal.aborted) setZoneLoading(false); }
  }, [zoneFrom, zoneTo, zoneFilters, selectedZone]);
  async function loadSubjectZone(zone: Zone, courseId: string) { const request = subjectRequest.current; try { const d = await (await fetch(`/api/admin/dit/analytics/zones?${subjectQuery({ scope: "subject", zone, course_id: courseId })}`)).json(); if (request?.signal.aborted) return; if (d.error) throw new Error(d.error); setDetail(d); } catch (e) { if (!request?.signal.aborted) toast.error(e instanceof Error ? e.message : "Unable to load zone details."); } }
  useEffect(() => { if (tab === "zones") void loadZones(); return () => zoneRequest.current?.abort(); }, [tab, loadZones]);
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2 border-b">{([["subjects", "Subject Analytics"], ["result", "Overall Result"], ["zones", "Overall Zones"], ["percentage", "Marks Percentage"]] as const).map(([v, l]) => <button key={v} onClick={() => setTab(v)} className={`border-b-2 px-3 py-2 text-sm font-semibold ${tab === v ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500"}`}>{l}</button>)}</div>
    {tab === "subjects" && subjectError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{subjectError}</p>}
    {tab === "subjects" && <><DateFilters from={from} to={to} setFrom={setFrom} setTo={setTo} /><div className="flex flex-wrap gap-2 rounded-xl border bg-white p-4"><AnalyticsFilterFields filters={filters} options={optionsData} onChange={setFilters} /><button disabled={loading} onClick={() => void loadSubjects()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">{loading ? "Loading…" : "Apply filters"}</button></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Subjects", subjects.length], ["Tests", subjects.reduce((n, s) => n + Number(s.test_count ?? 0), 0)], ["Students", summary.unique_student_count ?? 0], ["Passing", `${subjects.length ? (subjects.reduce((n, s) => n + Number(s.passing_percentage ?? 0), 0) / subjects.length).toFixed(1) : "0.0"}%`]].map(([l, v]) => <div key={String(l)} className="rounded-xl border bg-white p-4"><div className="text-xs text-slate-500">{l}</div><div className="text-2xl font-bold">{v}</div></div>)}</div>{loading ? <p role="status" className="text-sm text-slate-500">Loading subject analytics…</p> : subjects.length ? <><SubjectChart subjects={subjects} /><SubjectCards subjects={subjects} onZone={loadSubjectZone} /></> : <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">No results match the selected filters.</p>}</>}
    {tab === "result" && <><ResultScreen from={from} to={to} setFrom={setFrom} setTo={setTo} studentQ={studentQ} setStudentQ={setStudentQ} students={students} setStudentId={setStudentId} setStudents={setStudents} loadReport={loadReport} report={report} /><BulkResultScreen /></>}
    {tab === "zones" && <ZonesScreen from={zoneFrom} to={zoneTo} setFrom={setZoneFrom} setTo={setZoneTo} filters={zoneFilters} setFilters={setZoneFilters} optionsData={zoneOptionsData} selected={selectedZone} load={(zone?: Zone) => zone && zone !== selectedZone ? setSelectedZone(zone) : void loadZones()} data={zoneData} loading={zoneLoading} error={zoneError} detail={detail} setDetail={setDetail} />}
    {tab === "percentage" && <PercentageRangeScreen />}
    {detail && tab === "subjects" && <SubjectDetail detail={detail} close={() => setDetail(null)} />}
  </div>;
}

function DateFilters({ from, to, setFrom, setTo }: any) { return <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-4"><label className="text-xs font-semibold">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded border px-2 py-1.5" /></label><label className="text-xs font-semibold">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded border px-2 py-1.5" /></label></div>; }
function SubjectChart({ subjects }: { subjects: AnyRecord[] }) { const data = subjects.map((s) => ({ name: s.course_code || s.course_title, passing: Number(s.passing_percentage ?? 0), ...Object.fromEntries(zones.map((z) => [z, Number(s.zones?.[z] ?? 0)])) })); return <div className="h-72 rounded-xl border bg-white p-3"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="passing" name="Passing %" fill="#6366f1" />{zones.map((z) => <Bar key={z} dataKey={z} stackId="zones" name={zoneLabels[z]} fill={zoneColors[z]} />)}</BarChart></ResponsiveContainer></div>; }
function SubjectCards({ subjects, onZone }: { subjects: AnyRecord[]; onZone: (zone: Zone, courseId: string) => void }) { return <div className="grid gap-4 md:grid-cols-2">{subjects.map((s) => <div key={s.course_id ?? s.course_code} className="rounded-xl border bg-white p-4"><h3 className="font-bold">{s.course_code} — {s.course_title}</h3><p className="text-xs text-slate-500">{s.test_count ?? 0} tests · {s.student_count ?? 0} students</p><div className="mt-3 flex flex-wrap gap-2">{zones.map((z) => <button key={z} onClick={() => onZone(z, String(s.course_id ?? s.course_code))} className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: zoneColors[z] }}>{zoneLabels[z]}: {s.zones?.[z] ?? 0}</button>)}</div></div>)}</div>; }
function SubjectDetail({ detail, close }: { detail: AnyRecord; close: () => void }) { const rows = detail.rows ?? detail.selected_zone_rows ?? [], columns = detail.columns ?? []; const printColumns = ["Student", "Father Name", "Roll No", "Class + Session", "Semester", ...columns.map((c: AnyRecord) => `${c.date ?? c.label} / ${c.total_marks}`), "Percentage"]; const printRows = rows.map((r: AnyRecord) => [r.name, r.father_name ?? "—", r.roll_no ?? "—", `${r.class_name} (${r.session})`, r.semester_number, ...columns.map((c: AnyRecord) => r.cells?.[c.key] ?? "—"), `${Number(r.percentage ?? 0).toFixed(1)}%`]); const print = () => printTable("Subject zone details", printColumns, printRows); return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true"><div className="max-h-[90vh] w-full max-w-6xl overflow-auto rounded-xl bg-white p-5"><div className="mb-3 flex justify-between"><h2 className="font-bold">Subject zone details</h2><div><button onClick={print} className="mr-2 rounded border px-3 py-1"><Printer className="mr-1 inline h-4 w-4" />Print</button><button onClick={close} aria-label="Close"><X /></button></div></div><table className="w-full min-w-[900px] text-left text-xs"><thead><tr className="bg-indigo-50"><th className="p-2">Student</th><th className="p-2">Father Name</th><th className="p-2">Roll No</th><th className="p-2">Class + Session</th><th className="p-2">Semester</th>{columns.map((c: AnyRecord) => <th key={c.key} className="p-2">{c.date ?? c.label}<br />/{c.total_marks}</th>)}<th className="p-2">Percentage</th></tr></thead><tbody>{rows.map((r: AnyRecord) => <tr key={r.student_id} className="border-t"><td className="p-2">{r.name}</td><td className="p-2">{r.father_name ?? "—"}</td><td className="p-2">{r.roll_no ?? "—"}</td><td className="p-2">{r.class_name} ({r.session})</td><td className="p-2">{r.semester_number}</td>{columns.map((c: AnyRecord) => <td key={c.key} className="p-2">{r.cells?.[c.key] ?? "—"}</td>)}<td className="p-2">{Number(r.percentage ?? 0).toFixed(1)}%</td></tr>)}</tbody></table></div></div>; }

function ResultScreen({ from, to, setFrom, setTo, studentQ, setStudentQ, students, setStudentId, setStudents, loadReport, report }: any) {
  return <div className="space-y-4"><h2 className="text-lg font-bold">Individual report</h2><DateFilters from={from} to={to} setFrom={setFrom} setTo={setTo} /><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={studentQ} onChange={(e) => setStudentQ(e.target.value)} placeholder="Search student name or roll number…" className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm" />{students.length > 0 && <div className="absolute z-10 mt-1 w-full rounded border bg-white shadow">{students.map((s: AnyRecord) => <button key={s.id ?? s.student_id} onClick={() => { setStudentId(s.id ?? s.student_id); setStudentQ(`${s.name} · ${s.roll_no ?? ""}`); setStudents([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50">{s.name} · {s.roll_no ?? "—"}</button>)}</div>}</div><button onClick={() => void loadReport()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Load report</button>{report && <ReportTable report={report} />}</div>;
}

function BulkResultScreen() {
  const [from, setFrom] = useState(""), [to, setTo] = useState("");
  const [classId, setClassId] = useState(""), [session, setSession] = useState(""), [semesterId, setSemesterId] = useState("");
  const [choices, setChoices] = useState<{ classes: { id: string; name: string; session: string }[]; sessions: string[]; semesters: { id: string; name: string; class_id: string }[] }>({ classes: [], sessions: [], semesters: [] });
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/dit/analytics/bulk-report?options=1").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load DIT classes.");
      if (!cancelled) setChoices(data);
    }).catch((error) => { if (!cancelled) toast.error(error instanceof Error ? error.message : "Unable to load classes."); });
    return () => { cancelled = true; };
  }, []);
  async function printClass() {
    if (!from || !to || !classId || !session || !semesterId) return toast.error("Select both dates, class, session, and semester.");
    if (from > to) return toast.error("From date must not be after to date.");
    setLoading(true);
    try {
      const search = new URLSearchParams({ from_date: from, to_date: to, class_id: classId, session, semester_id: semesterId });
      const response = await fetch(`/api/admin/dit/analytics/bulk-report?${search}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to generate class reports.");
      if (!Array.isArray(data.reports) || !data.reports.length) throw new Error("No students found for this class.");
      await printResultReports(data.reports);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to print class reports.");
    } finally {
      setLoading(false);
    }
  }
  return <section className="space-y-3 rounded-xl border bg-white p-4">
    <div><h2 className="text-lg font-bold">Bulk class reports</h2><p className="text-sm text-slate-500">Print one individual-format report per student, each starting on a new page. Students without results in the selected period are included.</p></div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-xs font-semibold">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded border px-2 py-1.5" /></label>
      <label className="text-xs font-semibold">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded border px-2 py-1.5" /></label>
      <label className="text-xs font-semibold">Class<select value={classId} onChange={(e) => { const id = e.target.value; setClassId(id); setSession(choices.classes.find((c) => c.id === id)?.session ?? ""); setSemesterId(""); }} className="mt-1 block max-w-64 rounded border px-2 py-2 text-sm"><option value="">Select class</option>{choices.classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.session})</option>)}</select></label>
      <label className="text-xs font-semibold">Session<select value={session} onChange={(e) => { setSession(e.target.value); setClassId(""); setSemesterId(""); }} className="mt-1 block rounded border px-2 py-2 text-sm"><option value="">Select session</option>{choices.sessions.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
      <label className="text-xs font-semibold">Semester<select value={semesterId} onChange={(e) => setSemesterId(e.target.value)} disabled={!classId} className="mt-1 block rounded border px-2 py-2 text-sm disabled:opacity-50"><option value="">Select semester</option>{choices.semesters.filter((s) => s.class_id === classId).map((s) => <option key={s.id} value={s.id}>Semester {s.name}</option>)}</select></label>
      <button disabled={loading} onClick={() => void printClass()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Printer className="mr-1 inline h-4 w-4" />{loading ? "Preparing reports…" : "Print all class reports / PDF"}</button>
    </div>
  </section>;
}

function ReportTable({ report }: { report: AnyRecord }) {
  const rows: AnyRecord[] = report.test_rows ?? (report.courses ?? []).flatMap((c: AnyRecord) => (c.tests ?? []).map((t: AnyRecord) => ({ ...t, course_title: t.course_title ?? c.course_title, course_code: t.course_code ?? c.course_code })));
  const student = report.student ?? {}, cls = report.class ?? {}, totals = report.grand_totals ?? {};
  const obtained = (t: AnyRecord) => t.obtained_marks ?? t.obtained ?? 0, total = (t: AnyRecord) => t.total_marks ?? t.total ?? 0;
  const chartData = report as DitReportChartData;
  const charts = reportChartsHtml(chartData);
  const print = () => { void printResultReports([report]).catch((error) => toast.error(error instanceof Error ? error.message : "Unable to print report.")); };
  return <div className="overflow-auto rounded-xl border bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <img src="/images/logo.png" alt="College logo" className="h-16 w-auto object-contain" />
        <img src={student.profile_image_url ?? "/images/logo.png"} alt={`${student.name ?? "Student"} profile`} className="h-16 w-16 rounded-full object-cover" />
        <div><h2 className="text-lg font-bold">Result Report</h2><p>{student.name} · Roll No: {student.roll_no ?? "—"}</p>
          <p className="text-sm text-slate-500">{cls.name ?? "—"} · Session {cls.session ?? "—"} · Section {cls.section ?? "—"} · Semester {report.semester?.number ?? report.semester ?? "—"}</p>
          <p className="text-xs text-slate-500">Date: {formatReportDate(report.from_date ?? report.effective_filters?.from_date)} to {formatReportDate(report.to_date ?? report.effective_filters?.to_date)} · Report date: {localReportDate(new Date())}</p>
        </div>
      </div>
      <button onClick={print} className="rounded border px-3 py-2 text-sm"><FileDown className="mr-1 inline h-4 w-4" />Print / PDF</button>
    </div>
    <table className="mt-4 w-full min-w-[700px] text-left text-xs"><thead><tr className="bg-indigo-50">{["Test #", "Date", "Subject", "Obtained Marks", "Total Marks", "Percentage", "Grade"].map((x, i) => <th key={x} className={`p-2 ${i >= 3 ? "text-center" : ""}`}>{x}</th>)}</tr></thead><tbody>{rows.map((t, i) => <tr key={`${testKey(t)}-${i}`} className="border-t"><td className="p-2">{t.test_number ?? "—"}</td><td className="p-2">{formatReportDate(t.date ?? t.test_date)}</td><td className="p-2">{t.course_code ? `${t.course_code} — ` : ""}{t.course_title}</td><td className="p-2 text-center">{t.is_absent ? <b className="text-red-600">Absent (0)</b> : obtained(t)}</td><td className="p-2 text-center">{total(t)}</td><td className="p-2 text-center">{Number(t.percentage ?? 0).toFixed(1)}%</td><td className="p-2 text-center font-semibold">{t.grade ?? (t.is_absent ? "Absent" : "F")}</td></tr>)}<tr className="border-t-2 bg-indigo-50 font-bold"><td colSpan={3} className="p-2">Overall</td><td className="p-2 text-center">{totals.obtained ?? totals.obtained_marks ?? 0}</td><td className="p-2 text-center">{totals.total ?? totals.total_marks ?? 0}</td><td className="p-2 text-center">{Number(totals.percentage ?? 0).toFixed(1)}%</td><td className="p-2 text-center">{totals.grade ?? "F"}</td></tr></tbody></table>
    <div dangerouslySetInnerHTML={{ __html: charts + reportSignaturesHtml }} />
  </div>;
}

function ZonesScreen({ from, to, setFrom, setTo, filters, setFilters, optionsData, selected, load, data, loading, error, detail, setDetail }: any) {
  const applied = data?.effective_filters ?? {};
  const matchesFilters = data && applied.from_date === (from || "1900-01-01")
    && applied.to_date === (to || "9999-12-31") && applied.zone === selected
    && ["class_id", "session", "semester_id", "course_id", "test_series_id"].every((key) => (applied[key] || "") === (filters[key] || ""));
  const ready = matchesFilters && !loading;
  const rows = ready ? (data?.rows ?? []) : [];
  const label = (key: string) => (optionsData[key] ?? []).find((item: AnyRecord) => item.id === applied[key]);
  const classOption = label("class_id"), semesterOption = label("semester_id");
  const headerText = `CITY COLLEGE (University Campus) · Class ${classOption?.name ?? "All classes"} · Session ${applied.session || classOption?.session || "All"} · Semester ${semesterOption?.name ?? "All"} · Course ${label("course_id")?.title ?? "All"} · Test series ${label("test_series_id")?.name ?? "All"} · Dates ${applied.from_date === "1900-01-01" ? "All" : applied.from_date ?? "All"} to ${applied.to_date === "9999-12-31" ? "All" : applied.to_date ?? "All"} · Print Date ${localDate(new Date())}`;
  const print = () => printTable(`${zoneName(selected)} — Overall Zones`, ["Student Roll No", "Name", "Percentage", "Grade", "Zone"], rows.map((r: AnyRecord) => [r.roll_no, r.name, `${Number(r.percentage ?? 0).toFixed(1)}%`, r.grade ?? "F", zoneName(r.zone)]), `<h2>${escapePrintHtml(headerText)}</h2>`);
  return <div className="space-y-4">
    <DateFilters from={from} to={to} setFrom={setFrom} setTo={setTo} />
    <div className="flex flex-wrap gap-2 rounded-xl border bg-white p-4">
      <AnalyticsFilterFields filters={filters} options={optionsData} onChange={setFilters} />
      <button disabled={loading} onClick={() => void load()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">{loading ? "Loading…" : "Apply filters"}</button>
    </div>
    <div className="rounded-xl border bg-white p-4"><h2 className="font-bold">College Result Zones</h2><p className="text-sm text-slate-500">{headerText}</p></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{zones.map((z) => <button key={z} aria-pressed={selected === z} onClick={() => void load(z)} className={`rounded-xl p-3 text-center font-bold text-white ${selected === z ? "ring-2 ring-indigo-600 ring-offset-2" : ""}`} style={{ backgroundColor: zoneColors[z] }}>{zoneLabels[z]}<div className="text-2xl">{ready ? data?.zone_counts?.[z] ?? 0 : "—"}</div></button>)}</div>
    <div className="flex items-center justify-between"><h2 className="font-bold">{zoneName(selected)} students</h2><button disabled={!ready || !rows.length} onClick={print} className="rounded border px-3 py-2 text-sm disabled:opacity-50"><Printer className="mr-1 inline h-4 w-4" />Print list</button></div>
    <div className="overflow-auto rounded border bg-white"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="bg-indigo-50">{["Student Roll No", "Name", "Percentage", "Grade", "Zone", "View Details"].map((label) => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>
      {rows.map((r: AnyRecord) => <tr key={r.student_id} className="border-t"><td className="p-2">{r.roll_no}</td><td className="p-2">{r.name}</td><td className="p-2">{Number(r.percentage ?? 0).toFixed(1)}%</td><td className="p-2 font-semibold">{r.grade ?? "F"}</td><td className="p-2">{zoneName(r.zone)}</td><td className="p-2"><button onClick={() => setDetail(r)} className="rounded border px-2 py-1 text-xs">View Details</button></td></tr>)}
      {!rows.length && <tr><td colSpan={6} role={error ? "alert" : "status"} className={`p-6 text-center ${error ? "text-red-600" : "text-slate-500"}`}>{error || (loading || !matchesFilters ? "Waiting for matching results…" : "No students match this zone and the selected filters.")}</td></tr>}
    </tbody></table></div>{detail && <ZoneDetail row={detail} close={() => setDetail(null)} />}
  </div>;
}

function ZoneDetail({ row, close }: { row: AnyRecord; close: () => void }) {
  const tests = [...(row.tests ?? [])].sort((a: AnyRecord, b: AnyRecord) => String(a.course_title ?? "").localeCompare(String(b.course_title ?? "")));
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true"><div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-5"><div className="flex justify-between"><h2 className="font-bold">{row.name} · Test details</h2><button onClick={close} aria-label="Close"><X /></button></div><table className="mt-4 w-full text-left text-xs"><thead><tr className="bg-indigo-50">{["Date", "Subject", "Series", "Marks", "Total", "Percentage"].map((x) => <th key={x} className="p-2">{x}</th>)}</tr></thead><tbody>{tests.map((t: AnyRecord, i) => <tr key={i} className="border-t"><td className="p-2">{t.date}</td><td className="p-2">{t.course_code} {t.course_title}</td><td className="p-2">{t.series_name ?? "—"}</td><td className="p-2">{t.is_absent ? "Absent (0)" : t.obtained_marks ?? 0}</td><td className="p-2">{t.total_marks ?? 0}</td><td className="p-2">{Number(t.percentage ?? 0).toFixed(1)}%</td></tr>)}</tbody></table></div></div>;
}