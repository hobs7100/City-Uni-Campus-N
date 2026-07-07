"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Award,
  Building2,
  ClipboardCheck,
  FileDown,
  GraduationCap,
  LayoutDashboard,
  School,
  Search,
  UsersRound,
} from "lucide-react";
import { formatDateOnly } from "@/lib/format";
import { PageLoader, TableLoader, DataFetchLoader } from "@/components/ui/Loaders";
import StatusBadge from "@/components/ui/StatusBadge";

interface Department { id: string; name: string }
interface Counters {
  total_classes: string; total_students: string; active: string;
  left: string; dropped: string; freezed: string; struck_off: string;
}
interface ClassRow {
  id: string; class_name: string; session: string; university_name: string | null;
  total_students: string; active_students: string; struck_off: string;
}
interface TeacherRow {
  id: string; name: string; email: string; phone: string | null;
  type: string; status: string; department_name: string; active_allocations: string;
}
interface StudentAttRow {
  student_id: string; name: string; roll_no: string | null;
  presents: number; absents: number; leaves: number;
  percentage: number | null; status: string;
}
interface ResultStudent {
  id: string; name: string; roll_no: string | null;
  class_name: string; session: string; department_name: string;
}
interface ResultCourse { course_code: string; course_title: string; mid: number; sessional: number; final: number; practical: number; total: number; status: string }
interface ResultSemester { semester_number: number; term_type: string; courses: ResultCourse[] }

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "classes", label: "Classes", icon: School },
  { id: "attendance", label: "Student Attendance", icon: ClipboardCheck },
  { id: "results", label: "Exam & Results", icon: Award },
] as const;
type TabId = (typeof tabs)[number]["id"];

const validTabs = tabs.map((t) => t.id) as string[];

export default function HodDashboardManager({ initialTab }: { initialTab?: string }) {
  const [tab, setTab] = useState<TabId>(
    validTabs.includes(initialTab ?? "") ? (initialTab as TabId) : "overview"
  );
  const [departments, setDepartments] = useState<Department[]>([]);
  const [counters, setCounters] = useState<Counters | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [attClassId, setAttClassId] = useState("");
  const [attSemesterId, setAttSemesterId] = useState("");
  const [attSemesters, setAttSemesters] = useState<{ id: string; semester_number: number; term_type: string; status: string }[]>([]);
  const [attFrom, setAttFrom] = useState("");
  const [attTo, setAttTo] = useState("");
  const [attRows, setAttRows] = useState<StudentAttRow[]>([]);
  const [attLoading, setAttLoading] = useState(false);

  const [resultQuery, setResultQuery] = useState("");
  const [resultStudents, setResultStudents] = useState<ResultStudent[]>([]);
  const [resultSearching, setResultSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<ResultStudent | null>(null);
  const [resultSemesters, setResultSemesters] = useState<ResultSemester[]>([]);
  const [resultLoading, setResultLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/hod/overview").then((r) => r.json()),
      fetch("/api/hod/teachers").then((r) => r.json()),
    ]).then(([overview, teachersData]) => {
      setDepartments(overview.departments ?? []);
      setCounters(overview.counters);
      setClasses(overview.classes ?? []);
      setTeachers(teachersData.teachers ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const loadAttendance = useCallback(async () => {
    if (!attClassId || !attSemesterId) return;
    setAttLoading(true);
    try {
      const params = new URLSearchParams({ class_id: attClassId, semester_id: attSemesterId });
      if (attFrom) params.set("from", attFrom);
      if (attTo) params.set("to", attTo);
      const res = await fetch(`/api/hod/student-attendance?${params}`);
      const data = await res.json();
      if (res.ok) setAttRows(data.rows ?? []);
    } finally {
      setAttLoading(false);
    }
  }, [attClassId, attSemesterId, attFrom, attTo]);

  const loadAttSemesters = useCallback(async () => {
    if (!attClassId) { setAttSemesters([]); setAttSemesterId(""); return; }
    const params = new URLSearchParams({ class_id: attClassId });
    const res = await fetch(`/api/hod/student-attendance?${params}`);
    const data = await res.json();
    if (res.ok) {
      setAttSemesters(data.semesters ?? []);
      setAttSemesterId("");
      setAttRows([]);
    }
  }, [attClassId]);

  useEffect(() => { loadAttSemesters(); }, [loadAttSemesters]);
  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  async function handleResultSearch() {
    if (resultQuery.trim().length < 2) return;
    setResultSearching(true);
    try {
      const res = await fetch(`/api/hod/results?q=${encodeURIComponent(resultQuery)}`);
      const data = await res.json();
      setResultStudents(data.students ?? []);
    } finally {
      setResultSearching(false);
    }
  }

  async function loadResultSheet(student: ResultStudent) {
    setSelectedStudent(student);
    setResultSemesters([]);
    setResultLoading(true);
    try {
      const res = await fetch("/api/hod/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: student.id }),
      });
      const data = await res.json();
      if (res.ok) setResultSemesters(data.semesters ?? []);
    } finally {
      setResultLoading(false);
    }
  }

  const cards = counters
    ? [
        { label: "Total Classes", value: Number(counters.total_classes), icon: Building2, color: "bg-sky-500" },
        { label: "Total Students", value: Number(counters.total_students), icon: GraduationCap, color: "bg-emerald-500" },
        { label: "Active", value: Number(counters.active), icon: UsersRound, color: "bg-indigo-500" },
        { label: "Left", value: Number(counters.left), icon: UsersRound, color: "bg-slate-500" },
        { label: "Dropped", value: Number(counters.dropped), icon: UsersRound, color: "bg-amber-500" },
        { label: "Freezed", value: Number(counters.freezed), icon: UsersRound, color: "bg-cyan-500" },
        { label: "Struck Off", value: Number(counters.struck_off), icon: UsersRound, color: "bg-red-500" },
      ]
    : [];

  if (loading) return <PageLoader />;

  if (departments.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Welcome</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          You are not yet assigned as Head of Department for any department. Please contact the administrator.
        </p>
      </div>
    );
  }

  const pctColor = (pct: number | null) => {
    if (pct === null) return "text-slate-400";
    if (pct >= 75) return "text-emerald-600 dark:text-emerald-400";
    if (pct >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-red-500 dark:text-red-400";
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-2 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {departments.map((d) => d.name).join(", ")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Head of Department Dashboard</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 print:hidden"
        >
          <FileDown size={16} /> Export PDF
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 rounded-lg border border-slate-300 p-1 dark:border-slate-700 print:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === t.id ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-300"
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="card-3d card-hover p-5">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.color} text-white`}>
                    <c.icon size={18} />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{c.value}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{c.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {teachers.length > 0 && (
            <div className="overflow-hidden card-3d">
              <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">
                Teachers in My Department(s)
              </h2>
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Active Courses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {teachers.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-slate-100">{t.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{t.email}</div>
                      </td>
                      <td className="px-4 py-3 capitalize">{t.type}</td>
                      <td className="px-4 py-3">{t.department_name}</td>
                      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                      <td className="px-4 py-3">{t.active_allocations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "classes" && (
        <div className="overflow-hidden card-3d">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">University</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Struck Off</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {classes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No classes found.</td>
                </tr>
              ) : (
                classes.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{c.class_name}</td>
                    <td className="px-4 py-3">{c.session}</td>
                    <td className="px-4 py-3">{c.university_name || "—"}</td>
                    <td className="px-4 py-3">{c.active_students}</td>
                    <td className="px-4 py-3">{c.struck_off}</td>
                    <td className="px-4 py-3">{c.total_students}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "attendance" && (
        <div className="space-y-4">
          <div className="card-3d p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Class</label>
                <select
                  value={attClassId}
                  onChange={(e) => setAttClassId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.class_name} ({c.session})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Semester</label>
                <select
                  value={attSemesterId}
                  onChange={(e) => setAttSemesterId(e.target.value)}
                  disabled={!attClassId || attSemesters.length === 0}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-900"
                >
                  <option value="">Select semester</option>
                  {attSemesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      Sem {s.semester_number} — {s.term_type} ({s.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">From</label>
                <input type="date" value={attFrom} onChange={(e) => setAttFrom(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">To</label>
                <input type="date" value={attTo} onChange={(e) => setAttTo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
            </div>
          </div>

          <div className="overflow-hidden card-3d">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Roll No</th>
                  <th className="px-4 py-3">Present</th>
                  <th className="px-4 py-3">Absent</th>
                  <th className="px-4 py-3">Leave</th>
                  <th className="px-4 py-3">%</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {attLoading ? (
                  <TableLoader colSpan={7} />
                ) : !attClassId || !attSemesterId ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">Select a class and semester.</td>
                  </tr>
                ) : attRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">No attendance records found.</td>
                  </tr>
                ) : (
                  attRows.map((r) => (
                    <tr key={r.student_id}>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.name}</td>
                      <td className="px-4 py-3 text-slate-500">{r.roll_no || "—"}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-600">{r.presents}</td>
                      <td className="px-4 py-3 font-semibold text-red-500">{r.absents}</td>
                      <td className="px-4 py-3 font-semibold text-amber-500">{r.leaves}</td>
                      <td className={`px-4 py-3 font-bold ${pctColor(r.percentage)}`}>
                        {r.percentage !== null ? `${r.percentage}%` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.status === "ok" && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">OK</span>}
                        {r.status === "warning" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Warning</span>}
                        {r.status === "struck-off" && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Low</span>}
                        {r.status === "no-data" && <span className="text-xs text-slate-400">No data</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "results" && (
        <div className="space-y-4">
          <div className="card-3d p-4">
            <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Search Student</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={resultQuery}
                onChange={(e) => setResultQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleResultSearch()}
                placeholder="Name or roll number…"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button
                onClick={handleResultSearch}
                disabled={resultSearching || resultQuery.trim().length < 2}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Search size={16} /> Search
              </button>
            </div>
          </div>

          {resultStudents.length > 0 && !selectedStudent && (
            <div className="overflow-hidden card-3d">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Roll No</th>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {resultStudents.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{s.name}</td>
                      <td className="px-4 py-3 text-slate-500">{s.roll_no || "—"}</td>
                      <td className="px-4 py-3">{s.class_name} ({s.session})</td>
                      <td className="px-4 py-3">{s.department_name}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => loadResultSheet(s)}
                          className="rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300"
                        >
                          View Result Sheet
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedStudent && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setSelectedStudent(null); setResultSemesters([]); }}
                  className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  ← Back to search results
                </button>
              </div>
              <div className="card-3d p-4">
                <h2 className="mb-2 font-semibold text-slate-800 dark:text-slate-100">{selectedStudent.name}</h2>
                <p className="text-sm text-slate-500">
                  Roll No: {selectedStudent.roll_no || "—"} · {selectedStudent.class_name} ({selectedStudent.session}) · {selectedStudent.department_name}
                </p>
              </div>

              {resultLoading ? (
                <DataFetchLoader />
              ) : resultSemesters.length === 0 ? (
                <p className="text-sm text-slate-400">No results found for this student.</p>
              ) : (
                resultSemesters.map((sem) => (
                  <div key={sem.semester_number} className="overflow-hidden card-3d">
                    <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Semester {sem.semester_number} — {sem.term_type}
                      </h3>
                    </div>
                    <table className="w-full border-collapse text-left text-sm">
                      <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-2">Course</th>
                          <th className="px-4 py-2">Mid</th>
                          <th className="px-4 py-2">Sessional</th>
                          <th className="px-4 py-2">Final</th>
                          <th className="px-4 py-2">Practical</th>
                          <th className="px-4 py-2">Total</th>
                          <th className="px-4 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sem.courses.map((c) => (
                          <tr key={c.course_code}>
                            <td className="px-4 py-2">
                              <div className="font-medium text-slate-800 dark:text-slate-100">{c.course_title}</div>
                              <div className="text-xs text-slate-400">{c.course_code}</div>
                            </td>
                            <td className="px-4 py-2">{c.mid}</td>
                            <td className="px-4 py-2">{c.sessional}</td>
                            <td className="px-4 py-2">{c.final}</td>
                            <td className="px-4 py-2">{c.practical}</td>
                            <td className="px-4 py-2 font-semibold">{c.total}</td>
                            <td className="px-4 py-2">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                                c.status === "pass" ? "bg-emerald-100 text-emerald-700" :
                                c.status === "fail" ? "bg-red-100 text-red-700" :
                                c.status === "freezed" ? "bg-cyan-100 text-cyan-700" :
                                "bg-amber-100 text-amber-700"
                              }`}>{c.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div className="hidden print:block">
        <div className="mb-3 rounded-lg border-2 border-indigo-600 bg-gradient-to-r from-indigo-600 to-sky-500 p-3 text-center text-white">
          <h2 className="text-lg font-extrabold tracking-wide">City College (University Campus)</h2>
          <p className="text-xs font-semibold opacity-90">
            Department Overview — {departments.map((d) => d.name).join(", ")}
          </p>
          <p className="text-[10px] opacity-80">Generated: {formatDateOnly(new Date().toISOString())}</p>
        </div>
        <table className="w-full border-collapse text-left text-[11px]">
          <thead className="bg-indigo-600 text-white">
            <tr>
              <th className="border border-indigo-400 px-1.5 py-0.5">Class</th>
              <th className="border border-indigo-400 px-1.5 py-0.5">Session</th>
              <th className="border border-indigo-400 px-1.5 py-0.5">University</th>
              <th className="border border-indigo-400 px-1.5 py-0.5">Active</th>
              <th className="border border-indigo-400 px-1.5 py-0.5">Struck Off</th>
              <th className="border border-indigo-400 px-1.5 py-0.5">Total</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((c, idx) => (
              <tr key={c.id} className={idx % 2 === 0 ? "bg-indigo-50/60" : "bg-white"}>
                <td className="border border-indigo-200 px-1.5 py-0.5">{c.class_name}</td>
                <td className="border border-indigo-200 px-1.5 py-0.5">{c.session}</td>
                <td className="border border-indigo-200 px-1.5 py-0.5">{c.university_name || "—"}</td>
                <td className="border border-indigo-200 px-1.5 py-0.5">{c.active_students}</td>
                <td className="border border-indigo-200 px-1.5 py-0.5">{c.struck_off}</td>
                <td className="border border-indigo-200 px-1.5 py-0.5">{c.total_students}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
