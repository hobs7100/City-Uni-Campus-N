"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, FileDown, History, Search, Users } from "lucide-react";
import toast from "react-hot-toast";
import { escapePrintHtml, printHtmlDocument } from "@/lib/printDocument";

type Section = { id: string; name: string; date: string; student_count: number };
type Student = { id: string; name: string; father_name: string | null; roll_no: string | null; class_id: string; class_name: string; session: string; exam_section_id: string | null; exam_section_name: string | null };
type ClassOption = { id: string; name: string; session: string };
type HistoryData = { student: { name: string; roll_no: string | null; class_name: string; session: string; exam_section_name: string | null }; history: { id: string; from_section_name: string | null; to_section_name: string | null; changed_at: string; changed_by_name: string | null }[]; results: { id: string; series_name: string; course_title: string; test_date: string; obtained_marks: number; total_marks: number; is_absent: boolean; exam_section_name: string | null }[] };

const field = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white";

export default function ExamSectionsManager() {
  const [sections, setSections] = useState<Section[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [classId, setClassId] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [targetId, setTargetId] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const rosterRequest = useRef(0);
  const [loadedRoster, setLoadedRoster] = useState("");
  const rosterKey = [sectionId, classId, query.trim()].join(":");
  const rosterReady = !rosterLoading && loadedRoster === rosterKey && !rosterError;

  const loadSections = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/dit/exam-sections", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load exam sections.");
      setSections(body.sections ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load exam sections.");
    } finally { setLoading(false); }
  }, []);

  const loadRoster = useCallback(async () => {
    const requestId = ++rosterRequest.current;
    setRosterLoading(true); setRosterError(""); setSelected([]);
    try {
      const params = new URLSearchParams();
      if (sectionId) params.set("exam_section_id", sectionId);
      if (query.trim()) params.set("q", query.trim());
      if (classId) params.set("class_id", classId);
      const response = await fetch(`/api/admin/dit/exam-sections/students?${params}`);
      const body = await response.json();
      if (requestId !== rosterRequest.current) return;
      if (!response.ok) throw new Error(body.error || "Could not load student roster.");
      setLoadedRoster([sectionId, classId, query.trim()].join(":"));
      setStudents(body.students ?? []); setClasses(body.classes ?? []); setSelected([]);
    } catch (cause) {
      if (requestId !== rosterRequest.current) return;
      const message = cause instanceof Error ? cause.message : "Could not load student roster.";
      setRosterError(message);
      toast.error(message);
      setStudents([]);
    } finally { if (requestId === rosterRequest.current) setRosterLoading(false); }
  }, [sectionId, query, classId]);

  // Fetch state is intentionally synchronized on initial mount and filter changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadSections(); }, [loadSections]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadRoster(); }, [loadRoster]);

  const selectedSection = sections.find((section) => section.id === sectionId);
  const allSelected = students.length > 0 && students.every((student) => selected.includes(student.id));
  const currentCount = useMemo(() => selectedSection?.student_count ?? 0, [selectedSection]);

  async function createSection(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !date) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/dit/exam-sections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), date }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not create section.");
      toast.success("Exam section created."); setName(""); setDate("");
      await loadSections();
      if (body.section?.id) setSectionId(body.section.id);
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not create section."); }
    finally { setSaving(false); }
  }

  async function assignStudents() {
    if (!rosterReady || saving) return;
    if (!targetId || !selected.length) return toast.error("Choose students and a destination section.");
    if (selected.length > 1000) return toast.error("Select no more than 1,000 students at a time.");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/dit/exam-sections/assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ student_ids: selected, exam_section_id: targetId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not update section membership.");
      toast.success(`${body.changed ?? selected.length} student${body.changed === 1 ? "" : "s"} assigned.`);
      await Promise.all([loadSections(), loadRoster()]);
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not update section membership."); }
    finally { setSaving(false); }
  }

  async function showHistory(studentId: string) {
    setHistoryLoading(true); setHistory(null);
    try {
      const response = await fetch(`/api/admin/dit/exam-sections/history?student_id=${encodeURIComponent(studentId)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load student history.");
      setHistory(body);
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not load student history."); }
    finally { setHistoryLoading(false); }
  }

  function printRoster() {
    if (!rosterReady) return;
    const title = `Exam section roster — ${selectedSection?.name ?? (sectionId === "unassigned" ? "Unassigned students" : "All students")}`;
    const rows = students.map((student) => `<tr><td>${escapePrintHtml(student.roll_no ?? "—")}</td><td>${escapePrintHtml(student.name)}</td><td>${escapePrintHtml(student.father_name ?? "—")}</td><td>${escapePrintHtml(`${student.class_name} · ${student.session}`)}</td><td>${escapePrintHtml(student.exam_section_name ?? "Unassigned")}</td></tr>`).join("");
    const html = `<html><head><title>${escapePrintHtml(title)}</title><style>@page{size:A4 landscape;margin:14mm}body{font:12px Arial;color:#172033}h1{color:#3730a3}p{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:18px}th{background:#3730a3;color:white;text-align:left}td,th{border:1px solid #cbd5e1;padding:7px}</style></head><body><h1>${escapePrintHtml(title)}</h1><p>${escapePrintHtml(selectedSection?.date ?? "")} · ${students.length} students</p><table><thead><tr><th>Roll No</th><th>Student</th><th>Father</th><th>Class · Session</th><th>Current section</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    void printHtmlDocument(html, title).catch(() => toast.error("Could not prepare the section PDF. Please try again."));
  }

  return <section className="space-y-5">
    <form onSubmit={createSection} className="card-3d flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1"><label htmlFor="exam-section-name" className="mb-1 block text-xs font-semibold uppercase text-slate-500">Section name</label><input id="exam-section-name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Mock Exam — April" className={`${field} w-full`} /></div>
      <div><label htmlFor="exam-section-date" className="mb-1 block text-xs font-semibold uppercase text-slate-500">Exam date</label><input id="exam-section-date" required type="date" value={date} onChange={(event) => setDate(event.target.value)} className={field} /></div>
      <button disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? "Saving…" : "Create section"}</button>
    </form>

    {loading ? <div role="status" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((n) => <div key={n} className="card-3d h-24 animate-pulse bg-slate-100 dark:bg-slate-800" />)}</div>
      : error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error} <button onClick={() => void loadSections()} className="ml-2 font-semibold underline">Retry</button></div>
      : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <button onClick={() => setSectionId("")} aria-pressed={!sectionId} className={`card-3d card-hover flex items-center justify-between p-4 text-left ${!sectionId ? "ring-2 ring-indigo-500" : ""}`}><span><span className="block text-xs font-semibold uppercase text-slate-500">Roster view</span><span className="text-lg font-bold text-slate-800 dark:text-white">All students</span></span><span className="rounded-xl bg-slate-100 p-3 text-slate-600 dark:bg-slate-800 dark:text-slate-200"><Users /></span></button>
        <button onClick={() => setSectionId("unassigned")} aria-pressed={sectionId === "unassigned"} className={`card-3d card-hover flex items-center justify-between p-4 text-left ${sectionId === "unassigned" ? "ring-2 ring-indigo-500" : ""}`}><span><span className="block text-xs font-semibold uppercase text-amber-600">Needs assignment</span><span className="text-lg font-bold text-slate-800 dark:text-white">Unassigned students</span></span><span className="rounded-xl bg-amber-50 px-4 py-3 text-xl font-extrabold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">↗</span></button>
        {sections.map((section) => <button key={section.id} onClick={() => setSectionId(section.id)} aria-pressed={sectionId === section.id} className={`card-3d card-hover flex items-center justify-between p-4 text-left ${sectionId === section.id ? "ring-2 ring-indigo-500" : ""}`}><span><span className="block text-xs font-semibold uppercase text-indigo-600">{section.date}</span><span className="block text-lg font-bold text-slate-800 dark:text-white">{section.name}</span></span><span className="rounded-xl bg-indigo-50 px-4 py-3 text-xl font-extrabold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">{section.student_count}</span></button>)}
      </div>}

    <div className="card-3d overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-700 lg:flex-row lg:items-end lg:justify-between">
        <div><h2 className="font-bold text-slate-800 dark:text-white">{selectedSection?.name ?? (sectionId === "unassigned" ? "Unassigned students" : "Student roster")}</h2><p className="text-xs text-slate-500">{sectionId === "unassigned" ? "Students without a current section" : `Current membership · ${currentCount} in selected section`}</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative"><span className="sr-only">Search students</span><Search size={15} className="absolute left-3 top-2.5 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or roll number" className={`${field} pl-9`} /></label>
          <label><span className="sr-only">Filter by class</span><select value={classId} onChange={(event) => setClassId(event.target.value)} className={field}><option value="">All classes</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.session}</option>)}</select></label>
          <button disabled={!students.length || !rosterReady} onClick={printRoster} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"><FileDown size={15} className="mr-1 inline" />Print / PDF</button>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/30 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label="Select all visible students" disabled={!rosterReady} checked={allSelected} onChange={(event) => setSelected(event.target.checked ? students.map((student) => student.id) : [])} />Select visible ({selected.length})</label>
        <select value={targetId} onChange={(event) => setTargetId(event.target.value)} className={`${field} sm:max-w-xs`} aria-label="Destination section"><option value="">Move / assign to section…</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select>
        <button disabled={saving || !rosterReady || !selected.length || !targetId} onClick={() => void assignStudents()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Check size={15} />{saving ? "Updating…" : "Assign / move"}</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50"><tr><th className="p-3">Select</th><th className="p-3">Student</th><th className="p-3">Class · Session</th><th className="p-3">Exam section</th><th className="p-3">History</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rosterLoading ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading roster…</td></tr> : rosterError ? <tr><td colSpan={5} role="alert" className="p-8 text-center text-red-600">{rosterError} <button onClick={() => void loadRoster()} className="ml-2 font-semibold underline">Retry</button></td></tr> : students.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">No students match this roster view.</td></tr> : students.map((student) => <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40"><td className="p-3"><input type="checkbox" aria-label={`Select ${student.name}`} checked={selected.includes(student.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id))} /></td><td className="p-3"><div className="font-semibold text-slate-800 dark:text-slate-100">{student.name}</div><div className="text-xs text-slate-500">{student.roll_no ?? "—"}{student.father_name ? ` · ${student.father_name}` : ""}</div></td><td className="p-3">{student.class_name}<div className="text-xs text-slate-500">{student.session}</div></td><td className="p-3">{student.exam_section_name ?? <span className="text-slate-400">Unassigned</span>}</td><td className="p-3"><button onClick={() => void showHistory(student.id)} className="inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs text-indigo-700 dark:text-indigo-300"><History size={13} />History</button></td></tr>)}
        </tbody></table>
      </div>
    </div>

    {(historyLoading || history) && <div role="dialog" aria-modal="true" aria-label="Student section history" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={() => setHistory(null)}><div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900" onClick={(event) => event.stopPropagation()}>{historyLoading ? <p role="status">Loading student history…</p> : history && <><div className="mb-4 flex items-start justify-between"><div><h2 className="text-lg font-bold">{history.student.name}</h2><p className="text-sm text-slate-500">{history.student.roll_no ?? "—"} · {history.student.class_name} · {history.student.session} · Current: {history.student.exam_section_name ?? "Unassigned"}</p></div><button onClick={() => setHistory(null)} className="rounded border px-3 py-1 text-sm">Close</button></div><h3 className="font-semibold">Membership changes</h3><div className="mb-5 mt-2 space-y-2">{history.history.length ? history.history.map((item) => <div key={item.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800"><span>{item.from_section_name ?? "Unassigned"} → {item.to_section_name ?? "Unassigned"}</span><span className="float-right text-xs text-slate-500">{item.changed_at} · {item.changed_by_name ?? "Admin"}</span></div>) : <p className="text-sm text-slate-500">No recorded membership changes.</p>}</div><h3 className="font-semibold">Results</h3><div className="mt-2 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="bg-indigo-50 dark:bg-indigo-500/10"><th className="p-2">Date</th><th className="p-2">Test</th><th className="p-2">Course</th><th className="p-2">Marks</th><th className="p-2">Recorded section</th></tr></thead><tbody>{history.results.map((result) => <tr key={result.id} className="border-t"><td className="p-2">{result.test_date}</td><td className="p-2">{result.series_name}</td><td className="p-2">{result.course_title}</td><td className="p-2">{result.is_absent ? "Absent" : `${result.obtained_marks}/${result.total_marks}`}</td><td className="p-2">{result.exam_section_name ?? "Not recorded"}</td></tr>)}</tbody></table></div></>}</div></div>}
  </section>;
}
