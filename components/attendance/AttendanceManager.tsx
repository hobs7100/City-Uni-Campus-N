"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CalendarCheck, CheckCircle2, FileDown, Loader2, Users } from "lucide-react";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";
import Modal from "@/components/ui/Modal";

interface Lecture {
  allocation_id: string;
  course_code: string;
  course_title: string;
  teacher_id: string;
  teacher_name: string;
  teacher_type: string;
  department_id: string;
  department_name: string;
  start_time: string;
  end_time: string;
  day_name: string;
  is_combined: boolean;
  classes: { class_name: string; session: string }[];
  attendance_id: string | null;
  lecture_count: string | null;
  late_minutes: number | null;
  status: string | null;
  remarks: string | null;
  is_billed: boolean;
}

interface ReportRow {
  id: string;
  attendance_date: string;
  lecture_count: string;
  late_minutes: number;
  status: string;
  remarks: string | null;
  course_code: string;
  course_title: string;
  teacher_name: string;
  class_name: string;
  session: string;
  department_name: string;
  semester_number: number;
  term_type: string;
}

interface ClassOption {
  id: string;
  class_name: string;
  session: string;
  department_id: string;
}

interface SemesterOption {
  id: string;
  semester_number: number;
  term_type: string;
  class_id: string;
  status: string;
}

interface TeacherOption {
  id: string;
  name: string;
  department_id: string;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendanceManager() {
  const [tab, setTab] = useState<"mark" | "report">("mark");
  const [departments, setDepartments] = useState<SelectOption[]>([]);

  const [date, setDate] = useState(todayStr());
  const [departmentId, setDepartmentId] = useState("");
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(false);

  const [markTarget, setMarkTarget] = useState<Lecture | null>(null);
  const [lectureCount, setLectureCount] = useState("1");
  const [lateMinutes, setLateMinutes] = useState("0");
  const [status, setStatus] = useState<"ok" | "fixture">("ok");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const [reportFrom, setReportFrom] = useState(todayStr());
  const [reportTo, setReportTo] = useState(todayStr());
  const [reportDepartmentId, setReportDepartmentId] = useState("");
  const [reportClassId, setReportClassId] = useState("");
  const [reportSemesterId, setReportSemesterId] = useState("");
  const [reportTeacherId, setReportTeacherId] = useState("");
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  const [allClasses, setAllClasses] = useState<ClassOption[]>([]);
  const [allSemesters, setAllSemesters] = useState<SemesterOption[]>([]);
  const [allTeachers, setAllTeachers] = useState<TeacherOption[]>([]);

  useEffect(() => {
    fetch("/api/admin/departments")
      .then((r) => r.json())
      .then((d) => setDepartments((d.departments ?? []).map((x: { id: string; name: string }) => ({ value: x.id, label: x.name }))));
    fetch("/api/admin/classes")
      .then((r) => r.json())
      .then((d) => setAllClasses(d.classes ?? []));
    fetch("/api/admin/semesters")
      .then((r) => r.json())
      .then((d) => setAllSemesters(d.semesters ?? []));
    fetch("/api/admin/teachers")
      .then((r) => r.json())
      .then((d) => setAllTeachers(d.teachers ?? []));
  }, []);

  const loadLectures = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (departmentId) params.set("department_id", departmentId);
      const res = await fetch(`/api/admin/attendance/lectures?${params.toString()}`);
      const data = await res.json();
      if (res.ok) setLectures(data.lectures);
    } finally {
      setLoading(false);
    }
  }, [date, departmentId]);

  useEffect(() => {
    if (tab === "mark") loadLectures();
  }, [tab, loadLectures]);

  function openMark(l: Lecture) {
    setMarkTarget(l);
    setLectureCount(l.lecture_count ?? "1");
    setLateMinutes(String(l.late_minutes ?? 0));
    setStatus((l.status as "ok" | "fixture") ?? "ok");
    setRemarks(l.remarks ?? "");
  }

  async function handleMarkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!markTarget) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocation_id: markTarget.allocation_id,
          attendance_date: date,
          start_time: markTarget.start_time,
          end_time: markTarget.end_time,
          lecture_count: Number(lectureCount),
          late_minutes: Number(lateMinutes),
          status,
          remarks: remarks || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Attendance saved.");
      setMarkTarget(null);
      loadLectures();
    } finally {
      setSaving(false);
    }
  }

  const classOptions = useMemo(
    () =>
      allClasses
        .filter((c) => !reportDepartmentId || c.department_id === reportDepartmentId)
        .map((c) => ({ value: c.id, label: `${c.class_name} (${c.session})` })),
    [allClasses, reportDepartmentId]
  );

  const semesterOptions = useMemo(
    () =>
      allSemesters
        .filter((s) => !reportClassId || s.class_id === reportClassId)
        .map((s) => ({ value: s.id, label: `Sem ${s.semester_number} — ${s.term_type} (${s.status})` })),
    [allSemesters, reportClassId]
  );

  const teacherOptions = useMemo(
    () =>
      allTeachers
        .filter((t) => !reportDepartmentId || t.department_id === reportDepartmentId)
        .map((t) => ({ value: t.id, label: t.name })),
    [allTeachers, reportDepartmentId]
  );

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams({ from: reportFrom, to: reportTo });
      if (reportDepartmentId) params.set("department_id", reportDepartmentId);
      if (reportClassId) params.set("class_id", reportClassId);
      if (reportSemesterId) params.set("semester_id", reportSemesterId);
      if (reportTeacherId) params.set("teacher_id", reportTeacherId);
      const res = await fetch(`/api/admin/attendance/report?${params.toString()}`);
      const data = await res.json();
      if (res.ok) setReportRows(data.records);
    } finally {
      setReportLoading(false);
    }
  }, [reportFrom, reportTo, reportDepartmentId, reportClassId, reportSemesterId, reportTeacherId]);

  useEffect(() => {
    if (tab === "report") loadReport();
  }, [tab, loadReport]);

  const reportSummary = useMemo(() => {
    const parts = [`${reportFrom} to ${reportTo}`];
    if (reportDepartmentId) parts.push(departments.find((d) => d.value === reportDepartmentId)?.label ?? "");
    if (reportClassId) parts.push(classOptions.find((c) => c.value === reportClassId)?.label ?? "");
    if (reportSemesterId) parts.push(semesterOptions.find((s) => s.value === reportSemesterId)?.label ?? "");
    if (reportTeacherId) parts.push(teacherOptions.find((t) => t.value === reportTeacherId)?.label ?? "");
    return parts.join(" · ");
  }, [reportFrom, reportTo, reportDepartmentId, reportClassId, reportSemesterId, reportTeacherId, departments, classOptions, semesterOptions, teacherOptions]);

  function handleExportPdf() {
    window.print();
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Teacher Attendance</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Mark daily lecture attendance and review history</p>
        </div>
        <div className="flex gap-2 rounded-lg border border-slate-300 p-1 dark:border-slate-700">
          <button
            onClick={() => setTab("mark")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "mark" ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-300"}`}
          >
            Mark Attendance
          </button>
          <button
            onClick={() => setTab("report")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "report" ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-300"}`}
          >
            Report
          </button>
        </div>
      </div>

      {tab === "mark" && (
        <div className="print:hidden">
          <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Department</label>
              <SearchableSelect
                options={departments}
                value={departments.find((d) => d.value === departmentId) || null}
                onChange={(opt) => setDepartmentId(opt ? (opt as SelectOption).value : "")}
                placeholder="All departments"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">Class(es)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400"><Loader2 className="mx-auto animate-spin" /></td></tr>
                ) : lectures.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No lectures scheduled on this day.</td></tr>
                ) : (
                  lectures.map((l) => (
                    <tr key={`${l.allocation_id}-${l.start_time}-${l.end_time}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{l.start_time?.slice(0, 5)} - {l.end_time?.slice(0, 5)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-slate-100">{l.course_code}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{l.course_title}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {l.teacher_name}
                        <span className="ml-1 text-xs text-slate-400 capitalize">({l.teacher_type})</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {l.classes.map((c, i) => (
                            <span key={i} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                              {c.class_name} ({c.session})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {l.attendance_id ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                            <CheckCircle2 size={12} /> Marked {l.is_billed && "· Billed"}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openMark(l)}
                          disabled={l.is_billed}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          {l.attendance_id ? "Edit" : "Mark"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "report" && (
        <div>
          <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 print:hidden sm:grid-cols-3 lg:grid-cols-6 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">From</label>
              <input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">To</label>
              <input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Department</label>
              <SearchableSelect
                options={departments}
                value={departments.find((d) => d.value === reportDepartmentId) || null}
                onChange={(opt) => {
                  const v = opt ? (opt as SelectOption).value : "";
                  setReportDepartmentId(v);
                  setReportClassId("");
                  setReportSemesterId("");
                  setReportTeacherId("");
                }}
                placeholder="All departments"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Class</label>
              <SearchableSelect
                options={classOptions}
                value={classOptions.find((c) => c.value === reportClassId) || null}
                onChange={(opt) => {
                  const v = opt ? (opt as SelectOption).value : "";
                  setReportClassId(v);
                  setReportSemesterId("");
                }}
                placeholder="All classes"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Semester</label>
              <SearchableSelect
                options={semesterOptions}
                value={semesterOptions.find((s) => s.value === reportSemesterId) || null}
                onChange={(opt) => setReportSemesterId(opt ? (opt as SelectOption).value : "")}
                placeholder="All semesters"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Teacher</label>
              <SearchableSelect
                options={teacherOptions}
                value={teacherOptions.find((t) => t.value === reportTeacherId) || null}
                onChange={(opt) => setReportTeacherId(opt ? (opt as SelectOption).value : "")}
                placeholder="All teachers"
              />
            </div>
            <div className="flex items-end lg:col-span-6">
              <button onClick={handleExportPdf} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                <FileDown size={18} /> Export PDF
              </button>
            </div>
          </div>

          <div className="hidden print:mb-4 print:block print:rounded-lg print:border-2 print:border-indigo-600 print:bg-gradient-to-r print:from-indigo-600 print:to-sky-500 print:p-4 print:text-center print:text-white">
            <h2 className="text-xl font-extrabold tracking-wide">City College (University Campus)</h2>
            <p className="text-sm font-semibold">Teacher Attendance Report — {reportSummary}</p>
            <p className="text-xs opacity-90">Generated on {new Date().toLocaleString()}</p>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 print:rounded-none print:border-0">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 print:bg-indigo-600 print:text-white">
                <tr>
                  <th className="px-4 py-3 print:border print:border-indigo-400">Date</th>
                  <th className="px-4 py-3 print:border print:border-indigo-400">Course</th>
                  <th className="px-4 py-3 print:border print:border-indigo-400">Teacher</th>
                  <th className="px-4 py-3 print:border print:border-indigo-400">Class</th>
                  <th className="px-4 py-3 print:border print:border-indigo-400">Lectures</th>
                  <th className="px-4 py-3 print:border print:border-indigo-400">Late (min)</th>
                  <th className="px-4 py-3 print:border print:border-indigo-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reportLoading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400"><Loader2 className="mx-auto animate-spin" /></td></tr>
                ) : reportRows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No attendance records found.</td></tr>
                ) : (
                  reportRows.map((r, idx) => (
                    <tr key={r.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${idx % 2 === 0 ? "print:bg-indigo-50/60" : "print:bg-white"}`}>
                      <td className="px-4 py-3 print:border print:border-indigo-200">{r.attendance_date}</td>
                      <td className="px-4 py-3 print:border print:border-indigo-200">
                        <div className="font-medium text-slate-800 dark:text-slate-100 print:text-indigo-900">{r.course_code}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 print:text-slate-700">{r.course_title}</div>
                      </td>
                      <td className="px-4 py-3 print:border print:border-indigo-200 print:text-slate-800">{r.teacher_name}</td>
                      <td className="px-4 py-3 print:border print:border-indigo-200 print:text-slate-800">{r.class_name} ({r.session}) Sem {r.semester_number}</td>
                      <td className="px-4 py-3 print:border print:border-indigo-200 print:text-slate-800">{r.lecture_count}</td>
                      <td className="px-4 py-3 print:border print:border-indigo-200 print:text-slate-800">{r.late_minutes}</td>
                      <td className="px-4 py-3 capitalize print:border print:border-indigo-200 print:text-slate-800">{r.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!markTarget} onClose={() => setMarkTarget(null)} title="Mark Attendance">
        {markTarget && (
          <form onSubmit={handleMarkSubmit} className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
              <div className="font-medium text-slate-800 dark:text-slate-100">{markTarget.course_code} — {markTarget.course_title}</div>
              <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400"><Users size={13} /> {markTarget.teacher_name}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Lecture Count</label>
                <select value={lectureCount} onChange={(e) => setLectureCount(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  <option value="1">Full (1)</option>
                  <option value="0.5">Half (0.5)</option>
                  <option value="0">None (0 - Absent)</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Late Minutes</label>
                <input type="number" min="0" value={lateMinutes} onChange={(e) => setLateMinutes(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as "ok" | "fixture")} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="ok">OK</option>
                <option value="fixture">Fixture (Rescheduled)</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Remarks</label>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setMarkTarget(null)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
              <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {saving && <Loader2 size={16} className="animate-spin" />}
                <CalendarCheck size={16} /> Save
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
