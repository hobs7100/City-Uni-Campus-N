"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award, BookOpen, Building2, CalendarCheck, ClipboardCheck,
  FileDown, GraduationCap, LayoutDashboard, School, Search,
  UsersRound, TrendingUp, User,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { formatDateOnly } from "@/lib/format";
import { PageLoader, DataFetchLoader } from "@/components/ui/Loaders";
import StatusBadge from "@/components/ui/StatusBadge";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";
import type { SingleValue } from "react-select";

interface Department  { id: string; name: string }
interface Counters {
  total_classes: string; teachers_count: string; active_semesters: string;
  total_students: string; active: string; left: string;
  dropped: string; freezed: string; struck_off: string;
}
interface ClassRow {
  id: string; class_name: string; session: string; university_name: string | null;
  total_students: string; active_students: string; struck_off: string;
}
interface StudentOption { id: string; name: string; roll_no: string | null; class_name: string; session: string }

interface CourseAtt {
  course_title: string; teacher_name: string;
  presents: number; absents: number; leaves: number; percentage: number | null;
}
interface SemAtt {
  semester_id: string; semester_number: number; term_type: string; sem_status: string;
  courses: CourseAtt[];
  overall: { presents: number; absents: number; leaves: number; percentage: number | null };
}

interface ResultCourse {
  course_code: string; course_title: string;
  mid: number; sessional: number; final: number; practical: number; total: number; status: string;
}
interface ResultSemester { semester_number: number; term_type: string; courses: ResultCourse[] }
interface ResultStudent {
  id: string; name: string; roll_no: string | null;
  class_name: string; session: string; department_name: string;
}

const tabs = [
  { id: "overview",    label: "Dashboard",          icon: LayoutDashboard },
  { id: "classes",     label: "All Classes",         icon: School },
  { id: "attendance",  label: "Student Attendance",  icon: ClipboardCheck },
  { id: "results",     label: "Exam & Results",      icon: Award },
] as const;
type TabId = (typeof tabs)[number]["id"];

const PIE_COLORS = ["#6366f1","#64748b","#f59e0b","#06b6d4","#ef4444"];

function pctColor(pct: number | null) {
  if (pct === null) return "text-slate-400";
  if (pct >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}
function pctBadge(pct: number | null) {
  if (pct === null) return <span className="text-xs text-slate-400">—</span>;
  const cls = pct >= 75 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
    : pct >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
    : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{pct}%</span>;
}

export default function HodDashboardManager({ initialTab }: { initialTab?: string }) {
  const validTabs = tabs.map((t) => t.id) as string[];
  const [tab, setTab] = useState<TabId>(
    validTabs.includes(initialTab ?? "") ? (initialTab as TabId) : "overview"
  );

  // ── overview ──────────────────────────────────────────────────────────────
  const [departments, setDepartments]   = useState<Department[]>([]);
  const [counters, setCounters]         = useState<Counters | null>(null);
  const [classes, setClasses]           = useState<ClassRow[]>([]);
  const [loading, setLoading]           = useState(true);

  // ── attendance ────────────────────────────────────────────────────────────
  const [allStudents, setAllStudents]         = useState<StudentOption[]>([]);
  const [attStudentId, setAttStudentId]       = useState<string>("");
  const [attSemesters, setAttSemesters]       = useState<SemAtt[]>([]);
  const [attLoading, setAttLoading]           = useState(false);
  const [attStudentInfo, setAttStudentInfo]   = useState<StudentOption | null>(null);

  // ── results ───────────────────────────────────────────────────────────────
  const [resultQuery, setResultQuery]           = useState("");
  const [resultStudents, setResultStudents]     = useState<ResultStudent[]>([]);
  const [resultSearching, setResultSearching]   = useState(false);
  const [selectedStudent, setSelectedStudent]   = useState<ResultStudent | null>(null);
  const [resultSemesters, setResultSemesters]   = useState<ResultSemester[]>([]);
  const [resultLoading, setResultLoading]       = useState(false);

  // ── load overview data ────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch("/api/hod/overview").then((r) => r.json()),
      fetch("/api/hod/students").then((r) => r.json()),
    ]).then(([overview, stuData]) => {
      setDepartments(overview.departments ?? []);
      setCounters(overview.counters);
      setClasses(overview.classes ?? []);
      setAllStudents(stuData.students ?? []);
    }).finally(() => setLoading(false));
  }, []);

  // ── student options for SearchableSelect ─────────────────────────────────
  const studentOptions = useMemo(
    () => allStudents.map((s) => ({
      value: s.id,
      label: `${s.name}${s.roll_no ? ` (${s.roll_no})` : ""} — ${s.class_name} ${s.session}`,
    })),
    [allStudents]
  );

  // ── load per-student attendance ───────────────────────────────────────────
  const loadAttendance = useCallback(async (sid: string) => {
    if (!sid) { setAttSemesters([]); return; }
    setAttLoading(true);
    try {
      const res  = await fetch(`/api/hod/student-attendance?student_id=${sid}`);
      const data = await res.json();
      if (res.ok) setAttSemesters(data.semesters ?? []);
    } finally {
      setAttLoading(false);
    }
  }, []);

  function handleAttStudentChange(opt: SingleValue<SelectOption>) {
    const val = opt?.value ?? "";
    setAttStudentId(val);
    const stu = allStudents.find((s) => s.id === val) ?? null;
    setAttStudentInfo(stu);
    setAttSemesters([]);
    if (val) loadAttendance(val);
  }

  // ── results ───────────────────────────────────────────────────────────────
  async function handleResultSearch() {
    if (resultQuery.trim().length < 2) return;
    setResultSearching(true);
    try {
      const res  = await fetch(`/api/hod/results?q=${encodeURIComponent(resultQuery)}`);
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
      const res  = await fetch("/api/hod/results", {
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

  // ── chart data ─────────────────────────────────────────────────────────────
  const statusPieData = counters
    ? [
        { name: "Active",    value: Number(counters.active) },
        { name: "Left",      value: Number(counters.left) },
        { name: "Dropped",   value: Number(counters.dropped) },
        { name: "Freezed",   value: Number(counters.freezed) },
        { name: "Struck Off",value: Number(counters.struck_off) },
      ].filter((d) => d.value > 0)
    : [];

  const classBarData = classes
    .map((c) => ({ name: c.class_name, Students: Number(c.total_students) }))
    .sort((a, b) => b.Students - a.Students)
    .slice(0, 10);

  const statCards = counters
    ? [
        { label: "Total Classes",      value: Number(counters.total_classes),    icon: Building2,     grad: "from-sky-500 to-blue-600" },
        { label: "Teachers",           value: Number(counters.teachers_count),   icon: UsersRound,    grad: "from-violet-500 to-purple-600" },
        { label: "Active Semesters",   value: Number(counters.active_semesters), icon: CalendarCheck, grad: "from-emerald-500 to-teal-600" },
        { label: "Active Students",    value: Number(counters.active),           icon: GraduationCap, grad: "from-indigo-500 to-blue-600" },
        { label: "Left",               value: Number(counters.left),             icon: UsersRound,    grad: "from-slate-500 to-slate-600" },
        { label: "Dropped",            value: Number(counters.dropped),          icon: UsersRound,    grad: "from-amber-500 to-orange-600" },
        { label: "Freezed",            value: Number(counters.freezed),          icon: UsersRound,    grad: "from-cyan-500 to-teal-600" },
      ]
    : [];

  // ── guards ─────────────────────────────────────────────────────────────────
  if (loading) return <PageLoader />;

  if (departments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
          <Building2 size={36} className="text-indigo-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">No Department Assigned</h1>
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          You are not yet assigned as Head of Department for any department.
          Please ask the administrator to assign you in the Department settings.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ── header ───────────────────────────────────────────────────────── */}
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

      {/* ── tabs ─────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900 print:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════ OVERVIEW TAB ══════════════════════════════ */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* 3D stat cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {statCards.map((c) => (
              <div key={c.label} className="card-3d card-hover p-4">
                <div className={`icon-tile bg-gradient-to-br ${c.grad} mb-3`}>
                  <c.icon size={18} className="text-white" />
                </div>
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{c.value}</p>
                <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Student status donut */}
            <div className="card-3d p-5">
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp size={16} className="text-indigo-500" />
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Student Status Distribution</h2>
              </div>
              {statusPieData.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">No student data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={90}
                      paddingAngle={3} dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {statusPieData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Classes bar chart */}
            <div className="card-3d p-5">
              <div className="mb-3 flex items-center gap-2">
                <BookOpen size={16} className="text-emerald-500" />
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Students per Class</h2>
              </div>
              {classBarData.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">No class data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={classBarData} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="Students" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ CLASSES TAB ═══════════════════════════════ */}
      {tab === "classes" && (
        <div className="overflow-hidden card-3d">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              All Classes — {departments.map((d) => d.name).join(", ")}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Session</th>
                  <th className="px-4 py-3">University</th>
                  <th className="px-4 py-3 text-center">Active</th>
                  <th className="px-4 py-3 text-center">Struck Off</th>
                  <th className="px-4 py-3 text-center">Total Students</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {classes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">No classes found.</td>
                  </tr>
                ) : (
                  classes.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{c.class_name}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.session}</td>
                      <td className="px-4 py-3 text-slate-500">{c.university_name || "—"}</td>
                      <td className="px-4 py-3 text-center font-semibold text-emerald-600 dark:text-emerald-400">{c.active_students}</td>
                      <td className="px-4 py-3 text-center font-semibold text-red-500 dark:text-red-400">{c.struck_off}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-200">{c.total_students}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════ ATTENDANCE TAB ════════════════════════════ */}
      {tab === "attendance" && (
        <div className="space-y-4">
          {/* search card */}
          <div className="card-3d p-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <User size={12} className="mr-1 inline" /> Search Student
            </label>
            <SearchableSelect
              options={studentOptions}
              value={studentOptions.find((o) => o.value === attStudentId) ?? null}
              onChange={(opt) => handleAttStudentChange(opt as SingleValue<SelectOption>)}
              placeholder="Select student by name, roll no, class or session…"
            />
            {attStudentInfo && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {attStudentInfo.class_name} &middot; {attStudentInfo.session}
                {attStudentInfo.roll_no ? ` · Roll: ${attStudentInfo.roll_no}` : ""}
              </p>
            )}
          </div>

          {!attStudentId ? (
            <div className="card-3d flex flex-col items-center justify-center gap-3 py-16 text-center">
              <ClipboardCheck size={40} className="text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-400">Select a student above to view their attendance record.</p>
            </div>
          ) : attLoading ? (
            <DataFetchLoader />
          ) : attSemesters.length === 0 ? (
            <div className="card-3d py-16 text-center text-sm text-slate-400">No attendance records found for this student.</div>
          ) : (
            attSemesters.map((sem) => {
              const ov = sem.overall;
              const ovTotal = ov.presents + ov.absents;
              const ovPct = ovTotal > 0 ? Math.round((ov.presents / ovTotal) * 100) : null;
              return (
                <div key={sem.semester_id} className="overflow-hidden card-3d">
                  {/* semester header */}
                  <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-3 dark:border-slate-800 dark:from-indigo-900/20 dark:to-blue-900/20">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      Semester {sem.semester_number}
                      {sem.term_type ? ` — ${sem.term_type}` : ""}
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                        sem.sem_status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      }`}>{sem.sem_status}</span>
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-2">Course</th>
                          <th className="px-4 py-2">Teacher</th>
                          <th className="px-4 py-2 text-center">Present</th>
                          <th className="px-4 py-2 text-center">Absent</th>
                          <th className="px-4 py-2 text-center">Leave</th>
                          <th className="px-4 py-2 text-center">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sem.courses.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-4 text-center text-xs text-slate-400">
                              No course-wise attendance marked by teachers for this semester.
                            </td>
                          </tr>
                        ) : (
                          sem.courses.map((c, ci) => (
                            <tr key={ci} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">{c.course_title}</td>
                              <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{c.teacher_name}</td>
                              <td className="px-4 py-2.5 text-center font-semibold text-emerald-600">{c.presents}</td>
                              <td className="px-4 py-2.5 text-center font-semibold text-red-500">{c.absents}</td>
                              <td className="px-4 py-2.5 text-center font-semibold text-amber-500">{c.leaves}</td>
                              <td className="px-4 py-2.5 text-center">{pctBadge(c.percentage)}</td>
                            </tr>
                          ))
                        )}

                        {/* overall row */}
                        <tr className="bg-indigo-50/60 dark:bg-indigo-900/20">
                          <td colSpan={2} className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                            Overall Attendance (Admin / Coordinator)
                          </td>
                          <td className="px-4 py-2.5 text-center font-bold text-emerald-600">{ov.presents}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-red-500">{ov.absents}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-amber-500">{ov.leaves}</td>
                          <td className="px-4 py-2.5 text-center">{pctBadge(ovPct)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ══════════════════════ RESULTS TAB ═══════════════════════════════ */}
      {tab === "results" && (
        <div className="space-y-4">
          <div className="card-3d p-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <Search size={12} className="mr-1 inline" /> Search Student
            </label>
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
              <div className="flex items-center gap-3 print:hidden">
                <button
                  onClick={() => { setSelectedStudent(null); setResultSemesters([]); }}
                  className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  ← Back to search results
                </button>
                <button
                  onClick={() => window.print()}
                  className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  <FileDown size={13} /> Print / PDF
                </button>
              </div>

              {/* print header */}
              <div className="hidden print:block">
                <div className="mb-3 rounded-lg border-2 border-indigo-600 bg-gradient-to-r from-indigo-600 to-sky-500 p-3 text-center text-white">
                  <h2 className="text-lg font-extrabold tracking-wide">City College (University Campus)</h2>
                  <p className="text-xs font-semibold opacity-90">Student Result Sheet</p>
                  <p className="text-[10px] opacity-80">Generated: {formatDateOnly(new Date().toISOString())}</p>
                </div>
              </div>

              <div className="card-3d p-4">
                <h2 className="mb-1 font-semibold text-slate-800 dark:text-slate-100">{selectedStudent.name}</h2>
                <p className="text-sm text-slate-500">
                  Roll No: {selectedStudent.roll_no || "—"} &middot; {selectedStudent.class_name} ({selectedStudent.session}) &middot; {selectedStudent.department_name}
                </p>
              </div>

              {resultLoading ? (
                <DataFetchLoader />
              ) : resultSemesters.length === 0 ? (
                <p className="text-sm text-slate-400">No results found for this student.</p>
              ) : (
                resultSemesters.map((sem) => (
                  <div key={sem.semester_number} className="overflow-hidden card-3d">
                    <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-3 dark:border-slate-800 dark:from-indigo-900/20 dark:to-blue-900/20">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        Semester {sem.semester_number} — {sem.term_type}
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[550px] border-collapse text-left text-sm">
                        <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                          <tr>
                            <th className="px-4 py-2">Course</th>
                            <th className="px-4 py-2 text-center">Mid</th>
                            <th className="px-4 py-2 text-center">Sessional</th>
                            <th className="px-4 py-2 text-center">Final</th>
                            <th className="px-4 py-2 text-center">Practical</th>
                            <th className="px-4 py-2 text-center">Total</th>
                            <th className="px-4 py-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {sem.courses.map((c) => (
                            <tr key={c.course_code}>
                              <td className="px-4 py-2">
                                <div className="font-medium text-slate-800 dark:text-slate-100">{c.course_title}</div>
                                <div className="text-xs text-slate-400">{c.course_code}</div>
                              </td>
                              <td className="px-4 py-2 text-center">{c.mid}</td>
                              <td className="px-4 py-2 text-center">{c.sessional}</td>
                              <td className="px-4 py-2 text-center">{c.final}</td>
                              <td className="px-4 py-2 text-center">{c.practical}</td>
                              <td className="px-4 py-2 text-center font-semibold">{c.total}</td>
                              <td className="px-4 py-2 text-center">
                                <StatusBadge status={c.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── print layout (overview → class table) ─────────────────────── */}
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
