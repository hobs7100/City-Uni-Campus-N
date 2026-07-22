"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award, Bell, BookOpen, Building2, CalendarCheck, ClipboardCheck, ClipboardList,
  FileDown, FileText, GraduationCap, LayoutDashboard, Pencil, RefreshCcw, Save, School, Search,
  Trash2, UsersRound, TrendingUp, User, UserCog, UserMinus,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { formatDateOnly } from "@/lib/format";
import { PageLoader, DataFetchLoader, TableLoader, ButtonLoader } from "@/components/ui/Loaders";
import RichTextViewer from "@/components/ui/RichTextViewer";
import toast from "react-hot-toast";
import StatusBadge from "@/components/ui/StatusBadge";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";
import ProfilePasswordForm from "@/components/ProfilePasswordForm";
import Logo from "@/components/Logo";
import StudentManagementPage from "@/components/students/StudentManagementPage";
import TeacherWorkloadTabs from "@/components/teachers/TeacherWorkloadTabs";
import DeptAttendanceManager from "@/components/deptAttendance/DeptAttendanceManager";
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
  mid: number; mid_absent: boolean; re_mid: number | null; re_mid_absent: boolean;
  sessional: number; final: number; practical: number; total: number; status: string;
}
interface ResultSemester { semester_number: number; term_type: string; courses: ResultCourse[] }
interface ResultStudent {
  id: string; name: string; roll_no: string | null;
  class_name: string; session: string; department_name: string;
}

interface ShortRow {
  student_id: string; name: string; roll_no: string | null;
  class_name: string; session: string; student_status: string;
  presents: number; absents: number; leaves: number; percentage: number | null;
}

interface ClassOption { id: string; class_name: string; session: string }
    interface SemOption   { id: string; semester_number: number; term_type: string }

    interface HodRdRow {
  course_id: string;
  course_code: string;
  course_title: string;
  credit_hours: string;
  class_name: string;
  sess: string;
  semester_id: string;
  semester_number: number;
  term_type: string;
  teacher_name: string;
  absent_count: number;
  paper_date: string | null;
  bundle_received_date: string | null;
  return_date: string | null;
}

interface HodAllResultRow {
  semester_id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  teacher_name: string | null;
  semester_number: number;
  term_type: string;
  class_id: string;
  class_name: string;
  session: string;
  department_id: string;
  status: string;
  submitted_at: string | null;
  student_count: number;
}

interface HodArRosterRow {
  student_id: string;
  name: string;
  roll_no: string | null;
  mid: number;
  mid_absent: boolean;
  re_mid: number | null;
  re_mid_absent: boolean;
  sessional: number;
  final: number;
  practical: number;
  total: number | null;
  status: "pass" | "fail" | "freezed" | "drop";
}

const tabs = [
  { id: "overview",       label: "Dashboard",          icon: LayoutDashboard },
  { id: "students",       label: "Students",            icon: GraduationCap },
  { id: "classes",        label: "All Classes",         icon: School },
  { id: "teachers",       label: "Teachers",            icon: UsersRound },
  { id: "attendance",      label: "Student Attendance",  icon: ClipboardCheck },
  { id: "dept-attendance", label: "Dept. Attendance",    icon: TrendingUp },
  { id: "short",           label: "Short Attendance",    icon: UserMinus },
  { id: "results",        label: "Exam & Results",      icon: Award },
  { id: "all-results",    label: "All Results",          icon: ClipboardList },
  { id: "remid-datesheet", label: "Re-Mid Date Sheet",   icon: RefreshCcw },
  { id: "notifications",  label: "Notifications",       icon: Bell },
  { id: "profile",        label: "Profile",             icon: UserCog },
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

  // ── all-results tab ──────────────────────────────────────────────────────
  const [hodArRows, setHodArRows]               = useState<HodAllResultRow[]>([]);
  const [hodArLoading, setHodArLoading]         = useState(false);
  const [hodArDeleting, setHodArDeleting]       = useState<string | null>(null);
  const [hodArSelected, setHodArSelected]       = useState<HodAllResultRow | null>(null);
  const [hodArRoster, setHodArRoster]           = useState<HodArRosterRow[]>([]);
  const [hodArRosterLoading, setHodArRosterLoading] = useState(false);
  const [hodArSaving, setHodArSaving]           = useState(false);

  const loadHodAllResults = useCallback(async () => {
    setHodArLoading(true);
    try {
      const res  = await fetch("/api/admin/results/submissions");
      const data = await res.json();
      if (res.ok) setHodArRows(data.submissions ?? []);
      else toast.error(data.error || "Failed to load results.");
    } finally { setHodArLoading(false); }
  }, []);

  async function loadHodArRoster(row: HodAllResultRow) {
    setHodArSelected(row);
    setHodArRoster([]);
    setHodArRosterLoading(true);
    try {
      const res  = await fetch(`/api/admin/results/roster?semester_id=${row.semester_id}&course_id=${row.course_id}`);
      const data = await res.json();
      if (res.ok) setHodArRoster(data.rows ?? []);
      else toast.error(data.error || "Failed to load roster.");
    } finally { setHodArRosterLoading(false); }
  }

  function updateHodArCell(studentId: string, field: keyof HodArRosterRow, value: unknown) {
    setHodArRoster((prev) =>
      prev.map((r) => r.student_id === studentId ? { ...r, [field]: value } : r)
    );
  }

  async function handleHodArSave() {
    if (!hodArSelected) return;
    setHodArSaving(true);
    try {
      const res  = await fetch("/api/admin/results/roster", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ semester_id: hodArSelected.semester_id, course_id: hodArSelected.course_id, rows: hodArRoster }),
      });
      const data = await res.json();
      if (res.ok) toast.success("Results saved.");
      else toast.error(data.error || "Failed to save.");
    } finally { setHodArSaving(false); }
  }

  async function handleHodArDelete(semId: string, courseId: string, label: string) {
    if (!confirm(`Delete all results for "${label}"?\n\nThe teacher will be required to re-submit.`)) return;
    const key = `${semId}-${courseId}`;
    setHodArDeleting(key);
    try {
      const res  = await fetch("/api/admin/results/submissions", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ semester_id: semId, course_id: courseId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Results deleted. Teacher must re-submit.");
        if (hodArSelected?.semester_id === semId && hodArSelected?.course_id === courseId) {
          setHodArSelected(null); setHodArRoster([]);
        }
        loadHodAllResults();
      } else toast.error(data.error || "Failed to delete.");
    } finally { setHodArDeleting(null); }
  }

  // ── results ───────────────────────────────────────────────────────────────
  const [resultQuery, setResultQuery]           = useState("");
  const [resultStudents, setResultStudents]     = useState<ResultStudent[]>([]);
  const [resultSearching, setResultSearching]   = useState(false);
  const [selectedStudent, setSelectedStudent]   = useState<ResultStudent | null>(null);
  const [resultSemesters, setResultSemesters]   = useState<ResultSemester[]>([]);
  const [resultLoading, setResultLoading]       = useState(false);

  // ── notifications ────────────────────────────────────────────────────────
  const [notifications, setNotifications]   = useState<{ id: string; title: string; message: string; is_read: boolean; created_at: string }[]>([]);
  const [notifLoading,  setNotifLoading]    = useState(false);

  const [rdRows, setRdRows] = useState<HodRdRow[]>([]);
  const [rdLoading, setRdLoading] = useState(false);

    const loadRdDatesheet = useCallback(async () => {
    setRdLoading(true);
    try {
      const res = await fetch("/api/hod/re-mid-exam-datesheet");
      const data = await res.json();
      if (res.ok) setRdRows(data.rows ?? []);
    } finally {
      setRdLoading(false);
    }
    }, []);

    const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res  = await fetch("/api/hod/notifications");
      const data = await res.json();
      if (res.ok) setNotifications(data.notifications ?? []);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  async function markNotifRead(id: string) {
    await fetch("/api/hod/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((p) => p.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  async function markAllNotifsRead() {
    await fetch("/api/hod/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark_all: true }),
    });
    setNotifications((p) => p.map((n) => ({ ...n, is_read: true })));
  }

  // ── short attendance ──────────────────────────────────────────────────────
  const [shortDeptId,          setShortDeptId]          = useState("");
  const [shortClassId,         setShortClassId]         = useState("");
  const [shortSemId,           setShortSemId]           = useState("");
  const [shortClasses,         setShortClasses]         = useState<ClassOption[]>([]);
  const [shortSems,            setShortSems]            = useState<SemOption[]>([]);
  const [shortRows,            setShortRows]            = useState<ShortRow[]>([]);
  const [shortLoading,         setShortLoading]         = useState(false);
  const [shortStruckOffLoading,setShortStruckOffLoading]= useState(false);

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

  // ── short attendance: load classes when dept changes ─────────────────────
  useEffect(() => {
    setShortClassId(""); setShortSemId(""); setShortClasses([]); setShortSems([]);
    if (!shortDeptId) return;
    fetch(`/api/admin/classes?department_id=${shortDeptId}`)
      .then((r) => r.json())
      .then((d) => setShortClasses(d.classes ?? []));
  }, [shortDeptId]);

  useEffect(() => {
    setShortSemId(""); setShortSems([]);
    if (!shortClassId) return;
    fetch(`/api/admin/semesters?class_id=${shortClassId}`)
      .then((r) => r.json())
      .then((d) => setShortSems((d.semesters ?? []).filter((s: SemOption & { status: string }) => s.status === "active")));
  }, [shortClassId]);

  const loadShortAttendance = useCallback(async () => {
    setShortLoading(true);
    try {
      const params = new URLSearchParams();
      if (shortDeptId)  params.set("department_id", shortDeptId);
      if (shortClassId) params.set("class_id",      shortClassId);
      if (shortSemId)   params.set("semester_id",   shortSemId);
      const res  = await fetch(`/api/admin/student-attendance/short?${params.toString()}`);
      const data = await res.json();
      if (res.ok) setShortRows(data.students ?? []);
      else toast.error(data.error || "Could not load short attendance.");
    } finally {
      setShortLoading(false);
    }
  }, [shortDeptId, shortClassId, shortSemId]);

  useEffect(() => {
    if (tab === "short")         loadShortAttendance();
    if (tab === "notifications") loadNotifications();
    if (tab === "remid-datesheet") loadRdDatesheet();
    if (tab === "all-results")   loadHodAllResults();
  }, [tab, loadShortAttendance, loadNotifications, loadRdDatesheet, loadHodAllResults]);

  const hodUnread = notifications.filter((n) => !n.is_read).length;

  async function handleShortStruckOffAll() {
    const targets = shortRows.filter((r) => r.student_status === "active");
    if (targets.length === 0) return;
    setShortStruckOffLoading(true);
    try {
      const res = await fetch("/api/admin/student-attendance/short", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_ids: targets.map((r) => r.student_id) }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed."); return; }
      toast.success(`${targets.length} student(s) marked as Struck Off.`);
      await loadShortAttendance();
    } finally {
      setShortStruckOffLoading(false);
    }
  }

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
      <div className="mb-6 flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Logo size="sm" className="shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {departments.map((d) => d.name).join(", ")}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Head of Department Dashboard</p>
          </div>
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
            {t.id === "notifications" && hodUnread > 0 && (
              <span className="ml-0.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {hodUnread}
              </span>
            )}
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

      {/* ══════════════════════ STUDENTS TAB ══════════════════════════════ */}
      {tab === "students" && <StudentManagementPage role="hod" />}

      {/* ══════════════════════ TEACHERS TAB ══════════════════════════════ */}
      {tab === "teachers" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Teachers</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Faculty workload and active course allocations for your department
            </p>
          </div>
          <TeacherWorkloadTabs apiEndpoint="/api/hod/teachers/workload" />
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

      {/* ══════════════════════ SHORT ATTENDANCE TAB ══════════════════════ */}
      {tab === "short" && (
        <div className="space-y-4">
          {/* filters + action row */}
          <div className="card-3d flex flex-wrap items-end gap-3 p-4">
            {/* Department */}
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Department
              </label>
              <select
                value={shortDeptId}
                onChange={(e) => setShortDeptId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Class */}
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Class
              </label>
              <select
                value={shortClassId}
                onChange={(e) => setShortClassId(e.target.value)}
                disabled={!shortDeptId}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              >
                <option value="">All Classes</option>
                {shortClasses.map((c) => (
                  <option key={c.id} value={c.id}>{c.class_name} ({c.session})</option>
                ))}
              </select>
            </div>

            {/* Semester */}
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Semester
              </label>
              <select
                value={shortSemId}
                onChange={(e) => setShortSemId(e.target.value)}
                disabled={!shortClassId}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              >
                <option value="">All Active Semesters</option>
                {shortSems.map((s) => (
                  <option key={s.id} value={s.id}>
                    Semester {s.semester_number}{s.term_type ? ` — ${s.term_type}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Struck Off All button */}
            {shortRows.filter((r) => r.student_status === "active").length > 0 && (
              <button
                onClick={handleShortStruckOffAll}
                disabled={shortStruckOffLoading}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {shortStruckOffLoading ? <ButtonLoader /> : <UserMinus size={15} />}
                Struck Off All ({shortRows.filter((r) => r.student_status === "active").length})
              </button>
            )}
          </div>

          {/* table */}
          <div className="overflow-hidden card-3d">
            <div className="border-b border-slate-100 bg-gradient-to-r from-red-50 to-rose-50 px-4 py-3 dark:border-slate-800 dark:from-red-900/20 dark:to-rose-900/20">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                <UserMinus size={15} className="text-red-500" />
                Students with Attendance Below 50%
                <span className="ml-auto text-xs font-normal text-slate-500 dark:text-slate-400">
                  {shortRows.length} student{shortRows.length !== 1 ? "s" : ""}
                </span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Roll No</th>
                    <th className="px-4 py-3">Class / Session</th>
                    <th className="px-4 py-3 text-center">Present</th>
                    <th className="px-4 py-3 text-center">Absent</th>
                    <th className="px-4 py-3 text-center">%</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {shortLoading ? (
                    <TableLoader colSpan={8} />
                  ) : shortRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                        No students with attendance below 50% found.
                      </td>
                    </tr>
                  ) : (
                    shortRows.map((r, idx) => {
                      const pct = r.percentage;
                      const pctCls = pct === null ? "text-slate-400"
                        : pct < 50 ? "text-red-600 dark:text-red-400 font-bold"
                        : "text-amber-600 dark:text-amber-400";
                      const isStruckOff = r.student_status === "struck_off";
                      return (
                        <tr
                          key={r.student_id}
                          className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${isStruckOff ? "opacity-60" : ""}`}
                        >
                          <td className="px-4 py-2.5 text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">{r.name}</td>
                          <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{r.roll_no || "—"}</td>
                          <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                            {r.class_name} <span className="text-xs">({r.session})</span>
                          </td>
                          <td className="px-4 py-2.5 text-center font-semibold text-emerald-600">{r.presents}</td>
                          <td className="px-4 py-2.5 text-center font-semibold text-red-500">{r.absents}</td>
                          <td className={`px-4 py-2.5 text-center ${pctCls}`}>
                            {pct !== null ? `${pct}%` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {isStruckOff ? (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                Struck Off
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                Pending
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
                            <th className="px-4 py-2 text-center">Mid / Re-Mid</th>
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
                              <td className="px-4 py-2 text-center">
                                  {c.mid_absent ? (
                                    <div className="space-y-0.5">
                                      <span className="inline-block rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400">Absent</span>
                                      {c.re_mid !== null && !c.re_mid_absent
                                        ? <div className="text-[11px] font-medium text-slate-700 dark:text-slate-200">Re-Mid: {c.re_mid}</div>
                                        : c.re_mid_absent
                                          ? <div className="text-[11px] text-red-500">Re-Mid: Absent</div>
                                          : null}
                                    </div>
                                  ) : c.mid}
                                </td>
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

      {/* ══════════════════════ ALL RESULTS TAB ═════════════════════════ */}
      {tab === "all-results" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">All Submitted Results</h2>
            <button onClick={loadHodAllResults} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">↻ Refresh</button>
          </div>

          {hodArLoading ? (
            <DataFetchLoader />
          ) : hodArRows.length === 0 ? (
            <div className="card-3d p-8 text-center text-sm text-slate-400">No results have been submitted yet.</div>
          ) : (
            <div className="overflow-hidden card-3d">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Course</th>
                      <th className="px-4 py-3">Class</th>
                      <th className="px-4 py-3">Teacher</th>
                      <th className="px-4 py-3 text-center">Students</th>
                      <th className="px-4 py-3">Submitted On</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {hodArRows.map((r) => {
                      const key   = `${r.semester_id}-${r.course_id}`;
                      const isDel = hodArDeleting === key;
                      const isSel = hodArSelected?.semester_id === r.semester_id && hodArSelected?.course_id === r.course_id;
                      return (
                        <tr key={key} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${isSel ? "bg-indigo-50/60 dark:bg-indigo-900/20" : ""}`}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800 dark:text-slate-100">{r.course_title}</div>
                            <div className="text-xs text-slate-400">{r.course_code} · Sem {r.semester_number} {r.term_type}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                            {r.class_name}
                            <div className="text-xs text-slate-400">{r.session}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.teacher_name ?? "—"}</td>
                          <td className="px-4 py-3 text-center font-semibold">{r.student_count}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{r.submitted_at ? formatDateOnly(r.submitted_at) : "—"}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.status === "submitted" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"}`}>
                              {r.status === "submitted" ? "Submitted" : "Pending"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => isSel ? (setHodArSelected(null), setHodArRoster([])) : loadHodArRoster(r)}
                                className="flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300"
                              >
                                <Pencil size={12} /> {isSel ? "Close" : "Edit"}
                              </button>
                              <button
                                onClick={() => handleHodArDelete(r.semester_id, r.course_id, `${r.course_title} (${r.class_name})`)}
                                disabled={isDel}
                                className="flex items-center gap-1 rounded-md bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:bg-rose-900/20 dark:text-rose-400"
                              >
                                <Trash2 size={12} /> {isDel ? "Deleting…" : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Inline Roster Editor ─────────────────────────────────── */}
          {hodArSelected && (
            <div className="overflow-hidden card-3d">
              <div className="flex items-center justify-between border-b border-slate-100 bg-indigo-50/60 px-4 py-3 dark:border-slate-800 dark:bg-indigo-900/20">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{hodArSelected.course_title}</p>
                  <p className="text-xs text-slate-500">{hodArSelected.class_name} ({hodArSelected.session}) · Sem {hodArSelected.semester_number} {hodArSelected.term_type}</p>
                </div>
                <button
                  onClick={handleHodArSave}
                  disabled={hodArSaving || hodArRosterLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {hodArSaving ? <ButtonLoader /> : <Save size={14} />} Save
                </button>
              </div>
              {hodArRosterLoading ? (
                <div className="p-6"><DataFetchLoader /></div>
              ) : hodArRoster.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">No students found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                      <tr>
                        <th className="border border-slate-200 px-3 py-2 dark:border-slate-700">#</th>
                        <th className="border border-slate-200 px-3 py-2 dark:border-slate-700">Student</th>
                        <th className="border border-slate-200 px-3 py-2 dark:border-slate-700 text-center">Mid</th>
                        <th className="border border-slate-200 px-3 py-2 dark:border-slate-700 text-center">Sessional</th>
                        <th className="border border-slate-200 px-3 py-2 dark:border-slate-700 text-center">Final</th>
                        <th className="border border-slate-200 px-3 py-2 dark:border-slate-700 text-center">Practical</th>
                        <th className="border border-slate-200 px-3 py-2 dark:border-slate-700 text-center">Total</th>
                        <th className="border border-slate-200 px-3 py-2 dark:border-slate-700 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hodArRoster.map((row, i) => {
                        const eff = row.mid_absent ? (row.re_mid_absent || row.re_mid === null ? 0 : row.re_mid) : row.mid;
                        const total = eff + row.sessional + row.final + row.practical;
                        return (
                          <tr key={row.student_id} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="border border-slate-200 px-3 py-1.5 text-slate-400 dark:border-slate-700">{i + 1}</td>
                            <td className="border border-slate-200 px-3 py-1.5 dark:border-slate-700">
                              <div className="font-medium text-slate-800 dark:text-slate-100">{row.name}</div>
                              <div className="text-xs text-slate-400">{row.roll_no ?? "—"}</div>
                            </td>
                            <td className="border border-slate-200 px-1 py-1 dark:border-slate-700">
                              <input
                                type="number" min={0} step="0.01"
                                value={row.mid_absent ? (row.re_mid ?? "") : row.mid}
                                disabled={row.mid_absent && row.re_mid_absent}
                                onChange={(e) => updateHodArCell(row.student_id, row.mid_absent ? "re_mid" : "mid", parseFloat(e.target.value) || 0)}
                                className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-center text-xs dark:border-slate-700 dark:bg-slate-900 disabled:opacity-40"
                              />
                              {row.mid_absent && <div className="text-center text-[10px] text-red-500">Re-Mid</div>}
                            </td>
                            <td className="border border-slate-200 px-1 py-1 dark:border-slate-700">
                              <input type="number" min={0} step="0.01" value={row.sessional}
                                onChange={(e) => updateHodArCell(row.student_id, "sessional", parseFloat(e.target.value) || 0)}
                                className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-center text-xs dark:border-slate-700 dark:bg-slate-900" />
                            </td>
                            <td className="border border-slate-200 px-1 py-1 dark:border-slate-700">
                              <input type="number" min={0} step="0.01" value={row.final}
                                onChange={(e) => updateHodArCell(row.student_id, "final", parseFloat(e.target.value) || 0)}
                                className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-center text-xs dark:border-slate-700 dark:bg-slate-900" />
                            </td>
                            <td className="border border-slate-200 px-1 py-1 dark:border-slate-700">
                              <input type="number" min={0} step="0.01" value={row.practical}
                                onChange={(e) => updateHodArCell(row.student_id, "practical", parseFloat(e.target.value) || 0)}
                                className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-center text-xs dark:border-slate-700 dark:bg-slate-900" />
                            </td>
                            <td className="border border-slate-200 px-3 py-1.5 text-center font-semibold dark:border-slate-700">{total.toFixed(2)}</td>
                            <td className="border border-slate-200 px-1 py-1 dark:border-slate-700">
                              <select value={row.status}
                                onChange={(e) => updateHodArCell(row.student_id, "status", e.target.value as HodArRosterRow["status"])}
                                className="w-20 rounded border border-slate-300 bg-white px-1 py-1 text-xs dark:border-slate-700 dark:bg-slate-900">
                                <option value="pass">Pass</option>
                                <option value="fail">Fail</option>
                                <option value="freezed">Freeze</option>
                                <option value="drop">Drop</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ NOTIFICATIONS TAB ════════════════════════ */}
      {tab === "notifications" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Notifications</h2>
            <button
              onClick={markAllNotifsRead}
              className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Mark all as read
            </button>
          </div>
          {notifLoading ? (
            <DataFetchLoader label="Loading…" />
          ) : notifications.length === 0 ? (
            <div className="card-3d p-12 text-center text-sm text-slate-400">No notifications yet.</div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`rounded-xl border p-4 transition-colors ${
                  n.is_read
                    ? "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/40"
                    : "border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-500/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-800 dark:text-slate-100">{n.title}</p>
                  {!n.is_read && (
                    <button
                      onClick={() => markNotifRead(n.id)}
                      className="flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-indigo-700"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white" /> Mark read
                    </button>
                  )}
                </div>
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  <RichTextViewer html={n.message} />
                </div>
                <p className="mt-2 text-xs text-slate-400">{formatDateOnly(n.created_at)}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* ══════════════════════ PROFILE TAB ══════════════════════════════ */}

      {tab === "remid-datesheet" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Re-Mid Exam Date Sheet</h2>
            <button
              onClick={loadRdDatesheet}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>
          {rdLoading ? (
            <DataFetchLoader />
          ) : rdRows.length === 0 ? (
            <div className="card-3d p-8 text-center text-sm text-slate-400">
              No re-mid exam schedule found. Either no students were absent in the Mid exam for your department, or the date sheet has not been published yet.
            </div>
          ) : (
            (() => {
              const groups = Array.from(
                rdRows.reduce((map, r) => {
                  const key = r.semester_id;
                  if (!map.has(key)) {
                    map.set(key, {
                      label: `${r.class_name} (${r.sess}) — Semester ${r.semester_number} ${r.term_type}`,
                      rows: [] as HodRdRow[],
                    });
                  }
                  map.get(key)!.rows.push(r);
                  return map;
                }, new Map<string, { label: string; rows: HodRdRow[] }>()),
              );
              return (
                <div className="space-y-6">
                  {groups.map(([semId, group]) => (
                    <div key={semId}>
                      <p className="mb-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                        {group.label}
                      </p>
                      <div className="overflow-x-auto card-3d shadow-sm">
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 bg-amber-50 text-left dark:border-slate-800 dark:bg-amber-500/5">
                              <th className="px-3 py-2">Course</th>
                              <th className="px-3 py-2">Teacher</th>
                              <th className="px-3 py-2 text-center">Cr. Hrs</th>
                              <th className="px-3 py-2 text-center">Absent</th>
                              <th className="px-3 py-2">Re-Mid Date</th>
                              <th className="px-3 py-2">Bundle Received</th>
                              <th className="px-3 py-2">Return Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((r) => (
                              <tr key={r.course_id} className="border-b border-slate-100 dark:border-slate-800">
                                <td className="px-3 py-2">
                                  <div className="font-medium">{r.course_title}</div>
                                  <div className="text-xs text-slate-400">{r.course_code}</div>
                                </td>
                                <td className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">{r.teacher_name}</td>
                                <td className="px-3 py-2 text-center">{r.credit_hours}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className="inline-flex items-center justify-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400">
                                    {r.absent_count}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  {r.paper_date ? (
                                    <span className="font-medium text-amber-700 dark:text-amber-400">{formatDateOnly(r.paper_date)}</span>
                                  ) : <span className="text-slate-400">—</span>}
                                </td>
                                <td className="px-3 py-2">
                                  {r.bundle_received_date ? formatDateOnly(r.bundle_received_date) : <span className="text-slate-400">—</span>}
                                </td>
                                <td className="px-3 py-2">
                                  {r.return_date ? formatDateOnly(r.return_date) : <span className="text-slate-400">—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </div>
      )}
          {tab === "dept-attendance" && (
        <DeptAttendanceManager role="hod" />
      )}

      {tab === "profile" && (
        <div className="max-w-lg">
          <ProfilePasswordForm />
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
