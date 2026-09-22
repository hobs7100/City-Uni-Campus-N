"use client";

import { useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { BookOpen, FileText, Loader2, Printer, Users } from "lucide-react";
import { SelectOption } from "@/components/ui/SearchableSelect";
import { escapePrintHtml, printHtmlDocument } from "@/lib/printDocument";

interface ClassOption {
  id: string;
  department_id: string;
  class_name: string;
  session: string;
  total_semesters: number;
}

interface Semester {
  id: string;
  semester_number: number;
  term_type: string;
  status: string;
  courses: { id: string; code: string; title: string }[];
}

interface ReportStudent {
  id: string;
  roll_no: string | null;
  name: string;
  father_name: string | null;
}

interface ReportMeta {
  department_name: string;
  class_name: string;
  session: string;
  semester_number: number;
  term_type: string;
  course_code: string;
  course_title: string;
}

interface Props {
  departments: SelectOption[];
  classes: ClassOption[];
}

const selectClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:disabled:bg-slate-800";

export default function PrintListsPanel({ departments, classes }: Props) {
  const [departmentId, setDepartmentId] = useState("");
  const [className, setClassName] = useState("");
  const [classId, setClassId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [students, setStudents] = useState<ReportStudent[]>([]);
  const [meta, setMeta] = useState<ReportMeta | null>(null);
  const [loadingSemesters, setLoadingSemesters] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [printing, setPrinting] = useState(false);
  const semesterRequestId = useRef(0);
  const reportRequestId = useRef(0);

  const classNames = useMemo<SelectOption[]>(() => {
    const names = new Set(classes.filter((c) => c.department_id === departmentId).map((c) => c.class_name));
    return Array.from(names).sort().map((name) => ({ value: name, label: name }));
  }, [classes, departmentId]);
  const sessionOptions = useMemo<SelectOption[]>(() => classes
    .filter((c) => c.department_id === departmentId && c.class_name === className)
    .map((c) => ({ value: c.id, label: c.session })), [classes, departmentId, className]);
  const selectedSemester = semesters.find((s) => s.id === semesterId);
  const courseOptions = selectedSemester?.courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` })) ?? [];
  const selectedCourse = selectedSemester?.courses.find((c) => c.id === courseId);

  function selectDepartment(value: string) {
    semesterRequestId.current += 1;
    reportRequestId.current += 1;
    setDepartmentId(value); setClassName(""); setClassId(""); setSemesterId(""); setCourseId(""); setSemesters([]); setStudents([]); setMeta(null);
    setLoadingSemesters(false); setLoadingReport(false);
  }
  function selectClassName(value: string) {
    semesterRequestId.current += 1;
    reportRequestId.current += 1;
    setClassName(value); setClassId(""); setSemesterId(""); setCourseId(""); setSemesters([]); setStudents([]); setMeta(null);
    setLoadingSemesters(false); setLoadingReport(false);
  }
  async function selectSession(value: string) {
    const requestId = ++semesterRequestId.current;
    reportRequestId.current += 1;
    setClassId(value); setSemesterId(""); setCourseId(""); setSemesters([]); setStudents([]); setMeta(null);
    setLoadingReport(false);
    if (!value) {
      setLoadingSemesters(false);
      return;
    }
    setLoadingSemesters(true);
    try {
      const res = await fetch(`/api/admin/semesters?class_id=${encodeURIComponent(value)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load semesters.");
      if (requestId === semesterRequestId.current) setSemesters(data.semesters ?? []);
    } catch (error) {
      if (requestId === semesterRequestId.current) {
        toast.error(error instanceof Error ? error.message : "Could not load semesters.");
      }
    } finally {
      if (requestId === semesterRequestId.current) setLoadingSemesters(false);
    }
  }
  function selectSemester(value: string) {
    reportRequestId.current += 1;
    setSemesterId(value); setCourseId(""); setStudents([]); setMeta(null);
    setLoadingReport(false);
  }
  async function selectCourse(value: string) {
    const requestId = ++reportRequestId.current;
    setCourseId(value);
    setStudents([]);
    setMeta(null);
    if (!departmentId || !classId || !semesterId || !value) {
      setLoadingReport(false);
      return;
    }
    setLoadingReport(true);
    try {
      const params = new URLSearchParams({
        department_id: departmentId,
        class_id: classId,
        semester_id: semesterId,
        course_id: value,
      });
      const res = await fetch(`/api/admin/students/print-list?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load the student list.");
      if (requestId === reportRequestId.current) {
        setMeta(data.meta);
        setStudents(data.students ?? []);
      }
    } catch (error) {
      if (requestId === reportRequestId.current) {
        toast.error(error instanceof Error ? error.message : "Could not load the student list.");
      }
    } finally {
      if (requestId === reportRequestId.current) setLoadingReport(false);
    }
  }

  async function printReport() {
    if (!meta || !selectedCourse) return;
    setPrinting(true);
    try {
      const logoUrl = new URL("/images/logo.png", window.location.origin).href;
      const rowHtml = students.map((s) => `
        <tr><td>${escapePrintHtml(s.roll_no || "—")}</td><td><span>${escapePrintHtml(s.name)}</span><br><span class="father">Father: ${escapePrintHtml(s.father_name || "—")}</span></td><td class="writing"></td><td class="marks"></td></tr>
      `).join("");
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Award/Attendance List</title><style>
        @page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}html,body{width:190mm;max-width:190mm}body{margin:0;color:#172033;font-family:Arial,sans-serif;font-size:10px;font-weight:400;overflow-wrap:anywhere}header{text-align:center;margin-bottom:12px}header img{width:64px;height:64px;object-fit:contain;margin-bottom:4px}h1{font-size:18px;margin:2px 0 11px;font-weight:700}.meta{display:grid;grid-template-columns:1fr 1fr;text-align:left;border:1px solid #aeb8c8;margin-bottom:12px}.meta div{padding:6px 8px;border-bottom:1px solid #d7dde6}.meta div:nth-child(odd){border-right:1px solid #d7dde6}.meta div:nth-last-child(-n+2){border-bottom:0}.label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#5c6a80;display:block;margin-bottom:2px}.value{font-size:10px;font-weight:400}.total{margin:0 0 10px;text-align:right;font-size:10px;font-weight:700}.line{display:inline-block;width:92px;border-bottom:1px solid #3c4655;height:12px;vertical-align:bottom}table{width:100%;max-width:190mm;border-collapse:collapse;table-layout:fixed;font-size:10px;font-weight:400}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}th{background:#e9edf4;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.02em;color:#29364b}th,td{border:1px solid #8793a5;padding:5px 6px;text-align:left}td{font-size:10px;font-weight:400}th:nth-child(1),td:nth-child(1){width:13%}th:nth-child(2),td:nth-child(2){width:42%}th:nth-child(3),td:nth-child(3){width:25%}th:nth-child(4),td:nth-child(4){width:20%}.father{font-size:10px;font-weight:400;color:#526078}.writing,.marks{height:30px}.signature{margin-top:28px;text-align:right;font-size:10px;font-weight:700}.signature .line{width:150px;margin-left:8px}
       </style></head><body><header><img src="${escapePrintHtml(logoUrl)}" alt="College logo"><h1>Award/Attendance List</h1></header><section class="meta"><div><span class="label">Class</span><span class="value">${escapePrintHtml(meta.class_name)}</span></div><div><span class="label">Session</span><span class="value">${escapePrintHtml(meta.session)}</span></div><div><span class="label">Semester</span><span class="value">${escapePrintHtml(`Semester ${meta.semester_number} · ${meta.term_type}`)}</span></div><div><span class="label">Department</span><span class="value">${escapePrintHtml(meta.department_name)}</span></div><div style="grid-column:1 / -1"><span class="label">Subject</span><span class="value">${escapePrintHtml(`${meta.course_code} — ${meta.course_title}`)}</span></div></section><p class="total">Total Marks <span class="line"></span></p><table><thead><tr><th>Roll No</th><th>Name + Father Name</th><th>Signatures</th><th>Obtained Marks</th></tr></thead><tbody>${rowHtml}</tbody></table><div class="signature">Instructor's Signature <span class="line"></span></div></body></html>`;
      await printHtmlDocument(html, "Award/Attendance List", { waitForFrameLoad: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open the print dialog.");
    } finally { setPrinting(false); }
  }

  const ready = Boolean(meta && students.length);
  return (
    <section className="space-y-4">
      <div className="card-3d overflow-hidden">
        <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-slate-50 px-5 py-4 dark:border-slate-700 dark:from-indigo-950/30 dark:to-slate-800/50">
          <div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"><FileText size={19} /></div><div><h2 className="font-semibold text-slate-900 dark:text-white">Print Lists</h2><p className="text-sm text-slate-500 dark:text-slate-400">Build a class subject list for attendance or marks entry.</p></div></div>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5">
          <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Department</span><select value={departmentId} onChange={(e) => selectDepartment(e.target.value)} className={selectClass}><option value="">Select department</option>{departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></label>
          <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Class name</span><select value={className} onChange={(e) => selectClassName(e.target.value)} disabled={!departmentId} className={selectClass}><option value="">Select class</option>{classNames.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
          <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Session</span><select value={classId} onChange={(e) => void selectSession(e.target.value)} disabled={!className} className={selectClass}><option value="">Select session</option>{sessionOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
          <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Semester</span><select value={semesterId} onChange={(e) => selectSemester(e.target.value)} disabled={!classId || loadingSemesters} className={selectClass}><option value="">{loadingSemesters ? "Loading semesters…" : "Select semester"}</option>{semesters.map((s) => <option key={s.id} value={s.id}>Semester {s.semester_number} · {s.term_type}</option>)}</select></label>
          <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</span><select value={courseId} onChange={(e) => void selectCourse(e.target.value)} disabled={!semesterId} className={selectClass}><option value="">Select subject</option>{courseOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
        </div>
      </div>
      {loadingReport ? <div className="card-3d flex min-h-52 items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={24} /></div> : meta ? <div className="card-3d overflow-hidden"><div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700"><div><div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"><BookOpen size={16} className="text-indigo-500" />{meta.course_code} — {meta.course_title}</div><p className="mt-1 text-xs text-slate-500">{meta.class_name} · {meta.session} · {students.length} student{students.length === 1 ? "" : "s"}</p></div><button onClick={printReport} disabled={!ready || printing} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><Printer size={16} />{printing ? "Preparing…" : "Print / Export PDF"}</button></div>{students.length ? <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400"><tr><th className="px-5 py-3">Roll No</th><th className="px-5 py-3">Student</th><th className="px-5 py-3">Father Name</th><th className="px-5 py-3">Signature</th><th className="px-5 py-3">Obtained Marks</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{students.map((s) => <tr key={s.id}><td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-200">{s.roll_no || "—"}</td><td className="px-5 py-3 text-slate-800 dark:text-slate-100">{s.name}</td><td className="px-5 py-3 text-slate-500">{s.father_name || "—"}</td><td className="h-12 px-5 py-3"></td><td className="px-5 py-3"></td></tr>)}</tbody></table></div> : <div className="flex flex-col items-center justify-center px-5 py-14 text-center"><Users size={30} className="mb-2 text-slate-300" /><p className="font-medium text-slate-600 dark:text-slate-300">No active students found</p><p className="mt-1 text-sm text-slate-400">This report has no students to print.</p></div>}</div> : <div className="card-3d flex min-h-56 flex-col items-center justify-center px-5 text-center"><FileText size={34} className="mb-3 text-slate-300" /><p className="font-medium text-slate-600 dark:text-slate-300">Choose a subject to preview the list</p><p className="mt-1 max-w-md text-sm text-slate-400">Select each field in order. The student roster and print action will appear here.</p></div>}
    </section>
  );
}