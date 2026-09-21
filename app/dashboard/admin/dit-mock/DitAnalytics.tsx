"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileDown, Printer, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { escapePrintHtml, printHtmlDocument } from "@/lib/printDocument";

type Zone = "toppers" | "good" | "average" | "warning" | "danger";
const zones: Zone[] = ["toppers", "good", "average", "warning", "danger"];
const zoneLabels: Record<Zone, string> = { toppers: "Toppers", good: "Good", average: "Average", warning: "Warning", danger: "Danger" };
const zoneColors: Record<Zone, string> = { toppers: "#10b981", good: "#3b82f6", average: "#f59e0b", warning: "#f97316", danger: "#ef4444" };
type AnyRecord = Record<string, any>;
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const monthStart = () => { const d = new Date(); return localDate(new Date(d.getFullYear(), d.getMonth(), 1)); };
const monthEnd = () => { const d = new Date(); return localDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
const testKey = (test: AnyRecord) => `${test.date ?? test.test_date}|${test.test_series_id}|${test.course_id}`;
const testLabel = (test: AnyRecord) => `${test.date ?? test.test_date} · ${test.series_name} · ${test.course_title} / ${test.total_marks}`;
const optionList = (value: any): { value: string; label: string }[] => {
  if (!Array.isArray(value)) return [];
  return value.map((x) => typeof x === "string" ? { value: x, label: x } : { value: String(x.id ?? x.value ?? x.course_id ?? ""), label: x.name ?? x.label ?? x.title ?? x.course_title ?? String(x.id ?? "") }).filter((x) => x.value);
};

function printTable(title: string, columns: string[], rows: string[][]) {
  const head = columns.map((x) => `<th>${escapePrintHtml(x)}</th>`).join("");
  const body = rows.map((r) => `<tr>${r.map((x) => `<td>${escapePrintHtml(x)}</td>`).join("")}</tr>`).join("");
  return printHtmlDocument(`<html><head><title>${escapePrintHtml(title)}</title><style>
  body{font:12px Arial;color:#172033;padding:24px}h1{color:#3730a3}table{border-collapse:collapse;width:100%;margin-top:18px}th{background:#3730a3;color:#fff}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}tr:nth-child(even){background:#f8fafc}@media print{body{padding:0}}
  </style></head><body><h1>${escapePrintHtml(title)}</h1><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`, title);
}

export default function DitAnalytics() {
  const [tab, setTab] = useState<"subjects" | "result" | "zones">("subjects");
  const [from, setFrom] = useState(monthStart), [to, setTo] = useState(monthEnd);
  const [filters, setFilters] = useState<AnyRecord>({});
  const [subjects, setSubjects] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [detail, setDetail] = useState<AnyRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [studentQ, setStudentQ] = useState(""), [students, setStudents] = useState<AnyRecord[]>([]);
  const [studentId, setStudentId] = useState(""), [report, setReport] = useState<AnyRecord | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [zoneTab, setZoneTab] = useState<Zone>("toppers");

  const query = (extra: AnyRecord = {}) => {
    const p = new URLSearchParams({ from_date: from, to_date: to, ...Object.fromEntries(Object.entries(filters).filter(([k, v]) => k !== "__options" && v)) as Record<string, string>, ...extra });
    return p.toString();
  };
  const loadSubjects = async () => {
    setLoading(true);
    try { const r = await fetch(`/api/admin/dit/analytics?${query()}`); const d = await r.json(); if (!r.ok) throw new Error(d.error); setSubjects(d.subjects ?? []); setFilters((f) => ({ ...f, __options: d.filter_options ?? {} })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Unable to load analytics."); } finally { setLoading(false); }
  };
  useEffect(() => { void loadSubjects(); }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  const filterOptions = (filters.__options ?? {}) as AnyRecord;
  const filterFields = [["test_series_id", "Test series"], ["class_id", "Class"], ["semester_id", "Semester"], ["course_id", "Course"]];
  const chartData = useMemo(() => subjects.map((s) => ({ name: s.course_code || s.course_title, passing: Number(s.passing_percentage ?? 0), ...Object.fromEntries(zones.map((z) => [z, Number(s.zones?.[z] ?? 0)])) })), [subjects]);

  async function loadZone(zone: Zone, courseId?: string, overall = false) {
    setDetailLoading(true); setSelectedZone(zone);
    try { const d = await (await fetch(`/api/admin/dit/analytics/zones?${query({ scope: overall ? "overall" : "subject", zone, ...(courseId ? { course_id: courseId } : {}) })}`)).json(); if (d.error) throw new Error(d.error); setDetail(d); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Unable to load zone details."); } finally { setDetailLoading(false); }
  }
  useEffect(() => {
    if (studentQ.trim().length < 2) { setStudents([]); return; }
    const timer = setTimeout(async () => { try { const d = await (await fetch(`/api/admin/dit/analytics/student-search?q=${encodeURIComponent(studentQ)}`)).json(); setStudents(Array.isArray(d) ? d : d.students ?? []); } catch { /* search is optional */ } }, 350);
    return () => clearTimeout(timer);
  }, [studentQ]);
  async function loadReport() {
    if (!studentId) return toast.error("Select a student first.");
    setReportLoading(true); try { const d = await (await fetch(`/api/admin/dit/analytics/student-report?${query({ student_id: studentId, test_series_id: filters.test_series_id || "" })}`)).json(); if (d.error) throw new Error(d.error); setReport(d); } catch (e) { toast.error(e instanceof Error ? e.message : "Unable to load report."); } finally { setReportLoading(false); }
  }
  const printDetail = () => { if (!detail) return; const cols = ["Name", "Father", "Roll No", "Class", "Session", "Semester", ...(detail.columns ?? []).map((c: AnyRecord) => `${c.label} (${c.total_marks})`), "Overall %"]; const rows = (detail.rows ?? []).map((r: AnyRecord) => [r.name, r.father_name ?? "—", r.roll_no ?? "—", r.class_name, r.session, `Semester ${r.semester_number}`, ...(detail.columns ?? []).map((c: AnyRecord) => r.cells?.[c.key] ?? "—"), `${Number(r.percentage ?? 0).toFixed(1)}%`]); void printTable(`${zoneLabels[selectedZone ?? zoneTab]} — DIT Results`, cols, rows); };
  const printReport = () => { if (!report) return; const tests: AnyRecord[] = Array.from(new Map<string, AnyRecord>((report.courses ?? []).flatMap((c: AnyRecord) => c.tests ?? []).map((t: AnyRecord) => [testKey(t), t] as [string, AnyRecord])).values()); const rows: string[][] = (report.courses ?? []).map((c: AnyRecord) => { const byTest = new Map<string, AnyRecord>((c.tests ?? []).map((t: AnyRecord) => [testKey(t), t] as [string, AnyRecord])); return [String(c.course_code ?? ""), String(c.course_title ?? ""), ...tests.map((header) => { const t = byTest.get(testKey(header)); return t ? (t.is_absent ? `Absent/ ${t.total_marks}` : `${t.obtained_marks}/${t.total_marks}`) : "—"; }), `${Number(c.percentage ?? 0).toFixed(1)}%`]; }); rows.push(["", "Grand total", ...tests.map(() => ""), `${report.grand_totals.obtained}/${report.grand_totals.total} (${Number(report.grand_totals.percentage).toFixed(1)}%)`]); void printTable(`DIT Result — ${report.student?.name ?? ""}`, ["Code", "Course", ...tests.map(testLabel), "Overall %"], rows); };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700">
      {([["subjects", "Subject Analytics"], ["result", "Overall Result"], ["zones", "Overall Zones"]] as const).map(([v, l]) => <button key={v} onClick={() => setTab(v)} className={`border-b-2 px-3 py-2 text-sm font-semibold ${tab === v ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500"}`}>{l}</button>)}
    </div>
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <label className="text-xs font-semibold text-slate-500">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-lg border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800" /></label>
      <label className="text-xs font-semibold text-slate-500">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-lg border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800" /></label>
      {filterFields.map(([key, label]) => <label key={key} className="text-xs font-semibold text-slate-500">{label}<select value={filters[key] ?? ""} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })} className="mt-1 block max-w-[170px] rounded-lg border px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="">All</option>{optionList(filterOptions[key] ?? filterOptions[key.replace("_id", "s")]).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}
      <button onClick={() => void loadSubjects()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{loading ? "Loading…" : "Apply filters"}</button>
    </div>
    {tab === "subjects" && <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[{ l: "Subjects", v: subjects.length }, { l: "Tests", v: subjects.reduce((n, s) => n + Number(s.test_count ?? 0), 0) }, { l: "Students", v: subjects.reduce((n, s) => n + Number(s.student_count ?? 0), 0) }, { l: "Passing", v: `${subjects.length ? (subjects.reduce((n, s) => n + Number(s.passing_percentage ?? 0), 0) / subjects.length).toFixed(1) : 0}%` }].map((x) => <div key={x.l} className="rounded-xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div className="text-xs text-slate-500">{x.l}</div><div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{x.v}</div></div>)}</div>
      <div className="h-72 rounded-xl border bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="passing" name="Passing %" fill="#6366f1" />{zones.map((z) => <Bar key={z} dataKey={z} stackId="zones" fill={zoneColors[z]} name={zoneLabels[z]} />)}</BarChart></ResponsiveContainer></div>
      <div className="grid gap-4 md:grid-cols-2">{subjects.map((s) => <div key={s.course_id} className="rounded-xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div className="flex justify-between"><div><h3 className="font-bold">{s.course_code} — {s.course_title}</h3><p className="text-xs text-slate-500">{s.test_count ?? 0} tests · {s.student_count ?? 0} students · {Number(s.passing_percentage ?? 0).toFixed(1)}% passing</p></div><span className="text-xl font-bold text-indigo-600">{Number(s.average_percentage ?? 0).toFixed(1)}%</span></div><div className="mt-4 flex flex-wrap gap-2">{zones.map((z) => <button key={z} onClick={() => void loadZone(z, s.course_id)} className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: zoneColors[z] }}>{zoneLabels[z]}: {s.zones?.[z] ?? 0}</button>)}</div></div>)}</div></>}
    {tab === "result" && <div className="space-y-4"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={studentQ} onChange={(e) => setStudentQ(e.target.value)} placeholder="Search student name or roll number…" className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800" />{students.length > 0 && <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">{students.map((s) => <button key={s.id ?? s.student_id} onClick={() => { setStudentId(s.id ?? s.student_id); setStudentQ(`${s.name}${s.roll_no ? ` — ${s.roll_no}` : ""}`); setStudents([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50">{s.name} {s.roll_no && `· ${s.roll_no}`}</button>)}</div>}</div><button onClick={() => void loadReport()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{reportLoading ? "Loading…" : "Load report"}</button>{report && <ReportTable report={report} onPrint={printReport} />}</div>}
    {tab === "zones" && <div className="space-y-4"><div className="flex flex-wrap gap-2">{zones.map((z) => <button key={z} onClick={() => { setZoneTab(z); void loadZone(z, undefined, true); }} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${zoneTab === z ? "text-white" : "bg-slate-100 text-slate-600"}`} style={zoneTab === z ? { backgroundColor: zoneColors[z] } : {}}>{zoneLabels[z]}</button>)}</div><button onClick={() => void loadZone(zoneTab, undefined, true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">{detailLoading ? "Loading…" : "Load overall zone"}</button></div>}
    {detail && <DetailDialog detail={detail} zone={selectedZone ?? zoneTab} loading={detailLoading} onClose={() => setDetail(null)} onPrint={printDetail} />}
  </div>;
}

function DetailDialog({ detail, zone, loading, onClose, onPrint }: { detail: AnyRecord; zone: Zone; loading: boolean; onClose: () => void; onPrint: () => void }) {
  const columns = detail.columns ?? [];
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true"><div className="max-h-[90vh] w-full max-w-6xl overflow-auto rounded-xl bg-white p-5 dark:bg-slate-900"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{zoneLabels[zone]} details</h2><div className="flex gap-2"><button onClick={onPrint} className="rounded-lg border px-3 py-2 text-sm"><Printer className="mr-1 inline h-4 w-4" />Print</button><button onClick={onClose} aria-label="Close"><X /></button></div></div>{loading ? <p>Loading…</p> : <table className="w-full min-w-[900px] text-left text-xs"><thead><tr className="bg-indigo-50 dark:bg-indigo-950/30"><th className="p-2">Student</th><th className="p-2">Father Name</th><th className="p-2">Roll No</th><th className="p-2">Class + Session</th><th className="p-2">Semester</th>{columns.map((c: AnyRecord) => <th key={c.key} className="p-2">{c.label}<br /><span className="font-normal">/{c.total_marks}</span></th>)}<th className="p-2">Overall %</th></tr></thead><tbody>{(detail.rows ?? []).map((r: AnyRecord) => <tr key={r.student_id} className="border-b dark:border-slate-800"><td className="p-2">{r.name}</td><td className="p-2">{r.father_name ?? "—"}</td><td className="p-2">{r.roll_no ?? "—"}</td><td className="p-2">{r.class_name} · {r.session}</td><td className="p-2">{r.semester_number}</td>{columns.map((c: AnyRecord) => <td key={c.key} className="p-2">{r.cells?.[c.key] ?? "—"}</td>)}<td className="p-2 font-semibold">{Number(r.percentage ?? 0).toFixed(1)}%</td></tr>)}</tbody></table>}</div></div>;
}

function ReportTable({ report, onPrint }: { report: AnyRecord; onPrint: () => void }) {
  const tests: AnyRecord[] = Array.from(new Map<string, AnyRecord>((report.courses ?? []).flatMap((c: AnyRecord) => c.tests ?? []).map((t: AnyRecord) => [testKey(t), t] as [string, AnyRecord])).values());
  return <div className="overflow-auto rounded-xl border"><div className="flex items-center justify-between p-4"><div><h2 className="font-bold">{report.student?.name}</h2><p className="text-xs text-slate-500">{report.student?.father_name ?? "—"} · {report.student?.roll_no ?? "No roll number"} · {report.class?.name} ({report.class?.session}) · Semester {report.semester?.number}</p></div><button onClick={onPrint} className="rounded-lg border px-3 py-2 text-sm"><FileDown className="mr-1 inline h-4 w-4" />Print / PDF</button></div><table className="w-full min-w-[700px] text-left text-xs"><thead><tr className="bg-indigo-50"><th className="p-2">Course</th>{tests.map((t) => <th key={testKey(t)} className="p-2">{testLabel(t)}</th>)}<th className="p-2">Overall %</th></tr></thead><tbody>{(report.courses ?? []).map((c: AnyRecord) => { const byTest = new Map((c.tests ?? []).map((t: AnyRecord) => [testKey(t), t])); return <tr key={String(c.course_id)} className="border-t"><td className="p-2">{c.course_code} — {c.course_title}</td>{tests.map((header) => { const t = byTest.get(testKey(header)) as AnyRecord | undefined; return <td key={testKey(header)} className="p-2">{t ? (t.is_absent ? `Absent / ${t.total_marks}` : `${t.obtained_marks}/${t.total_marks}`) : "—"}</td>; })}<td className="p-2 font-semibold">{Number(c.percentage ?? 0).toFixed(1)}%</td></tr>; })}<tr className="border-t-2 font-bold"><td className="p-2">Grand total</td><td colSpan={tests.length} className="p-2">{report.grand_totals?.obtained ?? 0} / {report.grand_totals?.total ?? 0}</td><td className="p-2">{Number(report.grand_totals?.percentage ?? 0).toFixed(1)}%</td></tr></tbody></table></div>;
}