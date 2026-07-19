"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Bell,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Eye,
  FileDown,
  FileText,
  GraduationCap,
  RefreshCcw,
  Save,
  User,
  X,
} from "lucide-react";
import { formatDateOnly } from "@/lib/format";
import { TableLoader, ButtonLoader, DataFetchLoader } from "@/components/ui/Loaders";
import RichTextViewer from "@/components/ui/RichTextViewer";

interface CourseRow {
  allocation_id: string;
  course_id: string;
  class_id: string;
  course_code: string;
  course_title: string;
  credit_hours: string;
  allocation_type: string;
  rate: string;
  is_combined: boolean;
  semester_id: string;
  semester_number: number;
  term_type: string;
  class_name: string;
  session: string;
  payment_status?: "paid" | "pending" | "n/a";
  outline_url?: string | null;
  delivered_lectures?: number;
  result_uploaded: boolean;
}

interface GroupedCourseRow {
  allocation_id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  credit_hours: string;
  allocation_type: string;
  rate: string;
  is_combined: boolean;
  semester_number: number;
  term_type: string;
  classes: { class_id: string; class_name: string; session: string; semester_id: string }[];
  outline_url?: string | null;
  delivered_lectures: number;
  payment_status?: "paid" | "pending" | "n/a";
  result_uploaded_count: number;
}

interface ResRosterRow {
  student_id: string;
  name: string;
  roll_no: string | null;
  student_status: string;
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

interface TimetableSummary {
  id: string;
  shift: string;
  wef_date: string;
  class_name: string;
  session: string;
  semester_number: number;
  term_type: string;
}

interface TimetableDetail {
  timetable: Record<string, unknown>;
  days: { id: string; day_name: string; position: number }[];
  periods: { id: string; start_time: string; end_time: string; position: number }[];
  cells: {
    id: string;
    day_id: string;
    period_id: string;
    allocation_id: string | null;
    course_code: string | null;
    course_title: string | null;
    teacher_name: string | null;
    combined_with: { class_name: string; session: string }[];
  }[];
}

interface RosterRow {
  student_id: string;
  name: string;
  roll_no: string | null;
  contact: string | null;
  class_name: string;
  session: string;
  student_status: string;
  locked: boolean;
  status: "present" | "absent" | "leave";
  reason: string;
  call_remarks: string;
}

interface AttendanceReportRow {
  id: string;
  attendance_date: string;
  lecture_count: string;
  late_minutes: number;
  status: string;
  remarks: string | null;
  course_code: string;
  course_title: string;
  is_combined: boolean;
  classes: { class_name: string; session: string }[];
}

interface StudentAttendanceRow {
  student_id: string;
  name: string;
  roll_no: string | null;
  class_name: string;
  session: string;
  student_status: string;
  presents: number;
  absents: number;
  leaves: number;
  percentage: number | null;
  status: "ok" | "warning" | "low" | "no-data";
}

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  type: string;
  workload_credit_hours: string | null;
  rate_per_hour: string | null;
  bank_name: string | null;
  account_title: string | null;
  account_number: string | null;
  status: string;
  department_name: string;
}

interface TeacherDsRow {
  course_id: string;
  course_code: string;
  course_title: string;
  credit_hours: string;
  teacher_name: string;
  class_name: string;
  session: string;
  semester_id: string;
  semester_number: number;
  term_type: string;
  paper_date: string | null;
  bundle_received_date: string | null;
  return_date: string | null;
  result_uploaded: boolean;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const tabs = [
  { id: "overview", label: "Overview", icon: ClipboardList },
  { id: "courses", label: "My Courses", icon: BookOpen },
  { id: "results", label: "Upload Result", icon: ClipboardCheck },
  { id: "timetable", label: "Timetable", icon: CalendarClock },
  { id: "datesheet", label: "Mid Exam Date Sheet", icon: FileText },
  { id: "remid-datesheet", label: "Re-Mid Date Sheet", icon: RefreshCcw },
  { id: "mark", label: "Mark Attendance", icon: CheckCircle2 },
  { id: "students", label: "Student Attendance", icon: GraduationCap },
  { id: "report", label: "My Attendance", icon: FileDown },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "profile", label: "Profile", icon: User },
] as const;

type TabId = (typeof tabs)[number]["id"];

const validTabs = tabs.map((t) => t.id) as string[];

export default function TeacherDashboardManager({ initialTab }: { initialTab?: string }) {
  const [tab, setTab] = useState<TabId>(
    validTabs.includes(initialTab ?? "") ? (initialTab as TabId) : "overview"
  );

  const [active, setActive] = useState<CourseRow[]>([]);
  const [inactive, setInactive] = useState<CourseRow[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesSubTab, setCoursesSubTab] = useState<"active" | "inactive">("active");

  const [timetables, setTimetables] = useState<TimetableSummary[]>([]);
  const [selectedTimetableId, setSelectedTimetableId] = useState("");
  const [timetableDetail, setTimetableDetail] = useState<TimetableDetail | null>(null);
  const [timetableLoading, setTimetableLoading] = useState(false);

  const [markAllocationId, setMarkAllocationId] = useState("");
  const [markClassId, setMarkClassId] = useState("");
  const [markDate, setMarkDate] = useState(todayStr());
  const [rosterRows, setRosterRows] = useState<RosterRow[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterSaving, setRosterSaving] = useState(false);
  const [isCombinedRoster, setIsCombinedRoster] = useState(false);

  const [studentsAllocId, setStudentsAllocId] = useState("");
  const [studentReportRows, setStudentReportRows] = useState<StudentAttendanceRow[]>([]);
  const [studentReportLoading, setStudentReportLoading] = useState(false);
  const [studentReportCourse, setStudentReportCourse] = useState<{ course_title: string; is_combined: boolean } | null>(null);

  const [reportRows, setReportRows] = useState<AttendanceReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportCourseId, setReportCourseId] = useState("");
  const [reportClassId, setReportClassId] = useState("");
  const [reportCourseFilter, setReportCourseFilter] = useState<{
    label: string;
  } | null>(null);

  // Upload Result tab state
  const [resAllocId, setResAllocId] = useState("");
  const [resSemesterId, setResSemesterId] = useState("");
  const [resCourseId, setResCourseId] = useState("");
  const [resRoster, setResRoster] = useState<ResRosterRow[]>([]);
  const [resRosterLoading, setResRosterLoading] = useState(false);
  const [resSaving, setResSaving] = useState(false);
  const [resExportActive, setResExportActive] = useState(false);
  const [resExamType, setResExamType] = useState<"MID" | "SEMESTER">("MID");
  const [resTeacherName, setResTeacherName] = useState("");

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    phone: "",
    bank_name: "",
    account_title: "",
    account_number: "",
  });
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "" });

  // Mid Exam Date Sheet tab state
  const [dsRows, setDsRows] = useState<TeacherDsRow[]>([]);
  const [dsLoading, setDsLoading] = useState(false);
  const [rdRows, setRdRows] = useState<TeacherRdRow[]>([]);
  const [rdLoading, setRdLoading] = useState(false);

  const loadRdDatesheet = useCallback(async () => {
      setRdLoading(true);
      try {
        const res = await fetch("/api/teacher/re-mid-exam-datesheet");
        const data = await res.json();
        if (res.ok) setRdRows(data.rows ?? []);
      } finally {
        setRdLoading(false);
      }
    }, []);

    const loadDatesheet = useCallback(async () => {
    setDsLoading(true);
    try {
      const res = await fetch("/api/teacher/mid-exam-datesheet");
      const data = await res.json();
      if (res.ok) setDsRows(data.rows ?? []);
    } finally {
      setDsLoading(false);
    }
  }, []);

  const loadCourses = useCallback(async () => {
    setCoursesLoading(true);
    try {
      const res = await fetch("/api/teacher/courses");
      const data = await res.json();
      if (res.ok) {
        setActive(data.active);
        setInactive(data.inactive);
      }
    } finally {
      setCoursesLoading(false);
    }
  }, []);


  const loadTimetables = useCallback(async () => {
    setTimetableLoading(true);
    try {
      const res = await fetch("/api/teacher/timetable");
      const data = await res.json();
      if (res.ok) {
        setTimetables(data.timetables);
        if (data.timetables.length > 0 && !selectedTimetableId)
          setSelectedTimetableId(data.timetables[0].id);
      }
    } finally {
      setTimetableLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTimetableDetail = useCallback(async (id: string) => {
    if (!id) {
      setTimetableDetail(null);
      return;
    }
    const res = await fetch(`/api/admin/timetables/${id}`);
    const data = await res.json();
    if (res.ok) setTimetableDetail(data);
  }, []);

  const loadRoster = useCallback(async () => {
    if (!markAllocationId || !markDate) {
      setRosterRows([]);
      return;
    }
    setRosterLoading(true);
    try {
      const params = new URLSearchParams({ allocation_id: markAllocationId, date: markDate });
      const res = await fetch(`/api/teacher/student-attendance/roster?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not load roster.");
        setRosterRows([]);
        return;
      }
      setRosterRows(data.rows);
      setIsCombinedRoster(data.is_combined);
    } finally {
      setRosterLoading(false);
    }
  }, [markAllocationId, markDate]);

  const loadStudentReport = useCallback(async () => {
    if (!studentsAllocId) {
      setStudentReportRows([]);
      setStudentReportCourse(null);
      return;
    }
    setStudentReportLoading(true);
    try {
      const params = new URLSearchParams({ allocation_id: studentsAllocId });
      const res = await fetch(`/api/teacher/student-attendance/report?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not load student attendance.");
        setStudentReportRows([]);
        return;
      }
      setStudentReportRows(data.rows);
      setStudentReportCourse(data.allocation ?? null);
    } finally {
      setStudentReportLoading(false);
    }
  }, [studentsAllocId]);

  const loadAttendanceReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams();
      if (reportFrom) params.set("from", reportFrom);
      if (reportTo) params.set("to", reportTo);
      if (reportCourseId) params.set("course_id", reportCourseId);
      if (reportClassId) params.set("class_id", reportClassId);
      const res = await fetch(`/api/teacher/attendance-report?${params.toString()}`);
      const data = await res.json();
      if (res.ok) setReportRows(data.records);
    } finally {
      setReportLoading(false);
    }
  }, [reportFrom, reportTo, reportCourseId, reportClassId]);

  const loadResRoster = useCallback(async () => {
    if (!resSemesterId || !resCourseId) { setResRoster([]); return; }
    setResRosterLoading(true);
    try {
      const res = await fetch(`/api/teacher/results/roster?semester_id=${resSemesterId}&course_id=${resCourseId}`);
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to load roster."); setResRoster([]); return; }
      setResRoster((data.rows ?? []).map((r: ResRosterRow) => {
        const effectiveMid = r.mid_absent
          ? (r.re_mid_absent || r.re_mid === null ? 0 : r.re_mid)
          : r.mid;
        return { ...r, total: effectiveMid + r.sessional + r.final + r.practical };
      }));
      setResTeacherName(data.teacher_name || "");
    } finally {
      setResRosterLoading(false);
    }
  }, [resSemesterId, resCourseId]);

  function updateResCell(
    studentId: string,
    field: "roll_no" | "mid" | "mid_absent" | "re_mid" | "re_mid_absent" | "sessional" | "final" | "practical" | "status",
    value: string | number | boolean,
  ) {
    setResRoster((prev) =>
      prev.map((r) => {
        if (r.student_id !== studentId) return r;
        const next = { ...r };
        if (field === "roll_no") next.roll_no = value as string;
        else if (field === "status") next.status = value as ResRosterRow["status"];
        else if (field === "mid_absent") {
          next.mid_absent = value as boolean;
          if (!value) { next.re_mid = null; next.re_mid_absent = false; }
        }
        else if (field === "re_mid_absent") next.re_mid_absent = value as boolean;
        else if (field === "re_mid") next.re_mid = Number(value) || 0;
        else {
          const num = Number(value) || 0;
          (next as unknown as Record<string, number>)[field] = num;
        }
        const effectiveMid = next.mid_absent
          ? (next.re_mid_absent || next.re_mid === null ? 0 : next.re_mid)
          : next.mid;
        next.total = effectiveMid + next.sessional + next.final + next.practical;
        return next;
      })
    );
  }

  async function handleSaveResRoster() {
    if (!resSemesterId || !resCourseId || resRoster.length === 0) return;
    setResSaving(true);
    try {
      const res = await fetch("/api/teacher/results/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semester_id: resSemesterId,
          course_id: resCourseId,
          rows: resRoster.map((r) => ({
            student_id: r.student_id,
            roll_no: r.roll_no,
            mid: r.mid,
            mid_absent: r.mid_absent,
            re_mid: r.re_mid,
            re_mid_absent: r.re_mid_absent,
            sessional: r.sessional,
            final: r.final,
            practical: r.practical,
            status: r.status,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Something went wrong."); return; }
      toast.success("Results saved successfully.");
      loadResRoster();
      loadCourses();
    } finally {
      setResSaving(false);
    }
  }

  async function handleResExportSheet() {
    const styleEl = document.createElement("style");
    styleEl.id = "__export-sheet-portrait";
    styleEl.textContent = "@page { size: A4 portrait !important; }";
    document.head.appendChild(styleEl);
    setResExportActive(true);
    await new Promise((r) => setTimeout(r, 150));
    window.print();
    setResExportActive(false);
    document.head.removeChild(styleEl);
  }

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await fetch("/api/teacher/notifications");
      const data = await res.json();
      if (res.ok) setNotifications(data.notifications);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/teacher/profile");
    const data = await res.json();
    if (res.ok) {
      setProfile(data.teacher);
      setProfileForm({
        phone: data.teacher.phone || "",
        bank_name: data.teacher.bank_name || "",
        account_title: data.teacher.account_title || "",
        account_number: data.teacher.account_number || "",
      });
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (tab === "results") loadResRoster();
    if (tab === "timetable") loadTimetables();
    if (tab === "datesheet") loadDatesheet();
    if (tab === "remid-datesheet") loadRdDatesheet();
    if (tab === "mark") loadRoster();
    if (tab === "students") loadStudentReport();
    if (tab === "report") loadAttendanceReport();
    if (tab === "notifications") loadNotifications();
    if (tab === "profile") loadProfile();
  }, [tab, loadResRoster, loadTimetables, loadRoster, loadStudentReport, loadAttendanceReport, loadNotifications, loadProfile]);

  useEffect(() => {
    if (selectedTimetableId) loadTimetableDetail(selectedTimetableId);
  }, [selectedTimetableId, loadTimetableDetail]);

  function updateRosterRow(studentId: string, patch: Partial<RosterRow>) {
    setRosterRows((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, ...patch } : r)));
  }

  async function handleSaveRoster() {
    if (!markAllocationId) return;
    setRosterSaving(true);
    try {
      const res = await fetch("/api/teacher/student-attendance/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocation_id: markAllocationId,
          attendance_date: markDate,
          rows: rosterRows.map((r) => ({
            student_id: r.student_id,
            status: r.status,
            reason: r.status === "present" ? null : r.reason || null,
            call_remarks: r.call_remarks || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Attendance saved.");
    } finally {
      setRosterSaving(false);
    }
  }

  async function markNotificationRead(id: string) {
    await fetch("/api/teacher/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  async function markAllRead() {
    await fetch("/api/teacher/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark_all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function handleSaveProfile() {
    setProfileSaving(true);
    try {
      const res = await fetch("/api/teacher/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Profile updated.");
      setProfile(data.teacher);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!passwordForm.new_password) return;
    setProfileSaving(true);
    try {
      const res = await fetch("/api/teacher/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Password changed.");
      setPasswordForm({ current_password: "", new_password: "" });
    } finally {
      setProfileSaving(false);
    }
  }

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  );
  const totalStudentsTaught = useMemo(
    () => new Set(active.map((c) => c.class_id)).size,
    [active],
  );

  const reportCourseOptions = useMemo(() => {
    const seen = new Set<string>();
    return [...active, ...inactive].filter((c) => {
      if (seen.has(c.course_id)) return false;
      seen.add(c.course_id);
      return true;
    });
  }, [active, inactive]);

  const reportClassOptions = useMemo(() => {
    const seen = new Set<string>();
    return [...active, ...inactive].filter((c) => {
      if (seen.has(c.class_id)) return false;
      seen.add(c.class_id);
      return true;
    });
  }, [active, inactive]);

  function groupCourseRows(rows: CourseRow[]): GroupedCourseRow[] {
    const map = new Map<string, GroupedCourseRow>();
    for (const c of rows) {
      if (!map.has(c.allocation_id)) {
        map.set(c.allocation_id, {
          allocation_id: c.allocation_id,
          course_id: c.course_id,
          course_code: c.course_code,
          course_title: c.course_title,
          credit_hours: c.credit_hours,
          allocation_type: c.allocation_type,
          rate: c.rate,
          is_combined: c.is_combined,
          semester_number: c.semester_number,
          term_type: c.term_type,
          outline_url: c.outline_url,
          delivered_lectures: c.delivered_lectures ?? 0,
          payment_status: c.payment_status,
          result_uploaded_count: c.result_uploaded ? 1 : 0,
          classes: [{ class_id: c.class_id, class_name: c.class_name, session: c.session, semester_id: c.semester_id }],
        });
      } else {
        const existing = map.get(c.allocation_id)!;
        if (!existing.classes.some((cl) => cl.class_id === c.class_id)) {
          existing.classes.push({ class_id: c.class_id, class_name: c.class_name, session: c.session, semester_id: c.semester_id });
          if (c.result_uploaded) existing.result_uploaded_count += 1;
        }
      }
    }
    return Array.from(map.values());
  }

  const groupedActive = useMemo(() => groupCourseRows(active), [active]);
  const groupedInactive = useMemo(() => groupCourseRows(inactive), [inactive]);

  /** Non-lab courses only — for the Upload Result tab. */
  const resGroupedActive = useMemo(
    () =>
      groupedActive.filter((c) => {
        const ch = Number(c.credit_hours);
        return !(ch === 1 || c.course_code.toLowerCase().includes("lab"));
      }),
    [groupedActive],
  );

  function cellFor(dayId: string, periodId: string) {
    return timetableDetail?.cells.find((c) => c.day_id === dayId && c.period_id === periodId);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Teacher Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your courses, timetable, and attendance
          </p>
        </div>
        <div className="flex flex-wrap gap-2 rounded-lg border border-slate-300 p-1 dark:border-slate-700">
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
              {t.id === "notifications" && unreadCount > 0 && (
                <span className="ml-0.5 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card-3d card-hover p-5">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{groupedActive.length}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Active Courses</p>
          </div>
          <div className="card-3d card-hover p-5">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {totalStudentsTaught}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Classes Taught</p>
          </div>
          <div className="card-3d card-hover p-5">
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {groupedActive.reduce((s, c) => s + c.delivered_lectures, 0)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Lectures Delivered</p>
          </div>
          <div className="card-3d card-hover p-5">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {groupedInactive.filter((c) => c.payment_status === "pending").length}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Pending Bills</p>
          </div>
        </div>
      )}

      {tab === "courses" && (
        <div className="space-y-4">
          {/* Sub-tab switcher */}
          <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
            {(["active", "inactive"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setCoursesSubTab(st)}
                className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                  coursesSubTab === st
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {st === "active" ? `Active (${groupedActive.length})` : `Inactive (${groupedInactive.length})`}
              </button>
            ))}
          </div>

          {/* Shared columns renderer */}
          {(() => {
            const rows = coursesSubTab === "active" ? groupedActive : groupedInactive;
            const isInactive = coursesSubTab === "inactive";
            const colSpan = isInactive ? 9 : 8;
            return (
              <div className="overflow-hidden card-3d card-hover">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Course</th>
                      <th className="px-4 py-3">Class / Session</th>
                      <th className="px-4 py-3">Semester</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Delivered</th>
                      <th className="px-4 py-3">Outline</th>
                      <th className="px-4 py-3">Result</th>
                      {isInactive && <th className="px-4 py-3">Payment</th>}
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {coursesLoading ? (
                      <TableLoader colSpan={colSpan} />
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={colSpan} className="px-4 py-8 text-center text-slate-400">
                          No {coursesSubTab} courses.
                        </td>
                      </tr>
                    ) : (
                      rows.map((c) => (
                        <tr key={c.allocation_id}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800 dark:text-slate-100">
                              {c.course_title}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {c.course_code}{c.is_combined && " · Combined"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {c.classes.map((cl) => (
                              <div key={cl.class_id}>{cl.class_name} ({cl.session})</div>
                            ))}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            Sem {c.semester_number} — {c.term_type}
                          </td>
                          <td className="px-4 py-3 capitalize whitespace-nowrap">
                            {c.allocation_type.replace("_", " ")}
                          </td>
                          <td className="px-4 py-3 font-semibold text-indigo-600 dark:text-indigo-400">
                            {c.delivered_lectures}
                          </td>
                          <td className="px-4 py-3">
                            {c.outline_url ? (
                              <a
                                href={c.outline_url}
                                target="_blank"
                                rel="noreferrer"
                                download
                                className="flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                              >
                                <FileDown size={12} /> Download
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              const total = c.classes.length;
                              const uploaded = c.result_uploaded_count;
                              if (uploaded === total && total > 0)
                                return <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">Uploaded</span>;
                              if (uploaded > 0)
                                return <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700 dark:bg-sky-500/10 dark:text-sky-400">Partial</span>;
                              return <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Pending</span>;
                            })()}
                          </td>
                          {isInactive && (
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                  c.payment_status === "paid"
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                                    : c.payment_status === "pending"
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                                    : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                                }`}
                              >
                                {c.payment_status === "paid" ? "Paid" : c.payment_status === "pending" ? "Pending" : "N/A"}
                              </span>
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <button
                              onClick={() => {
                                setReportCourseId(c.course_id);
                                setReportClassId(c.is_combined ? "" : (c.classes[0]?.class_id ?? ""));
                                setReportCourseFilter({
                                  label: c.is_combined
                                    ? `${c.course_title} [Combined]`
                                    : `${c.course_title} — ${c.classes[0]?.class_name} (${c.classes[0]?.session})`,
                                });
                                setTab("report");
                              }}
                              className="flex items-center gap-1 rounded-md bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100 dark:bg-sky-900/20 dark:text-sky-300 dark:hover:bg-sky-900/40"
                            >
                              <Eye size={12} /> View Attendance
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {tab === "results" && (
        <div className="space-y-6">
          {/* Course selector */}
          <div className="card-3d p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Select Course</h3>
            {resGroupedActive.length === 0 ? (
              <p className="text-sm text-slate-400">No active courses found.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {resGroupedActive.map((c) => (
                  <button
                    key={c.allocation_id}
                    onClick={() => {
                      setResAllocId(c.allocation_id);
                      setResCourseId(c.course_id);
                      if (!c.is_combined) {
                        setResSemesterId(c.classes[0]?.semester_id ?? "");
                      } else {
                        setResSemesterId("");
                      }
                      setResRoster([]);
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      resAllocId === c.allocation_id
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                        : "border-slate-300 text-slate-600 hover:border-indigo-400 dark:border-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {c.course_code} — {c.course_title}
                    {c.is_combined && <span className="ml-1 text-xs text-slate-400">(Combined)</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Class picker for combined allocations */}
          {resAllocId && (() => {
            const sel = resGroupedActive.find((c) => c.allocation_id === resAllocId);
            if (!sel || !sel.is_combined) return null;
            return (
              <div className="card-3d p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Select Class</h3>
                <div className="flex flex-wrap gap-2">
                  {sel.classes.map((cl) => (
                    <button
                      key={cl.class_id}
                      onClick={() => { setResSemesterId(cl.semester_id); setResRoster([]); }}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                        resSemesterId === cl.semester_id
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                          : "border-slate-300 text-slate-600 hover:border-indigo-400 dark:border-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {cl.class_name} ({cl.session})
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Load roster button */}
          {resAllocId && resSemesterId && resRoster.length === 0 && !resRosterLoading && (
            <div className="flex gap-3">
              <button
                onClick={loadResRoster}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Load Students
              </button>
            </div>
          )}

          {/* Loading */}
          {resRosterLoading && <DataFetchLoader />}

          {/* Roster table */}
          {resRoster.length > 0 && (() => {
            const selAlloc = resGroupedActive.find((c) => c.allocation_id === resAllocId);
            const selClass = selAlloc?.classes.find((cl) => cl.semester_id === resSemesterId);
            return (
              <div>
                {/* Print-only header */}
                {resExportActive && (
                  <div className="hidden print:block mb-4">
                    <h2 className="text-base font-bold">Result Sheet — {selAlloc?.course_code} {selAlloc?.course_title}</h2>
                    {selClass && <p className="text-sm">Class: {selClass.class_name} ({selClass.session})</p>}
                    <p className="text-sm">Teacher: {resTeacherName}</p>
                    <p className="text-sm">Date: {formatDateOnly(new Date().toISOString())}</p>
                  </div>
                )}

                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {selAlloc?.course_code} — {selAlloc?.course_title}
                      {selClass && <span className="ml-2 text-slate-400">{selClass.class_name} ({selClass.session})</span>}
                    </p>
                    <p className="text-xs text-slate-400">{resRoster.length} students</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleResExportSheet}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <FileDown size={14} /> Export Sheet
                    </button>
                    <button
                      onClick={handleSaveResRoster}
                      disabled={resSaving}
                      className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {resSaving ? <ButtonLoader /> : null} Save Results
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto card-3d">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                      <tr>
                        <th className="border border-slate-200 px-3 py-2 dark:border-slate-700">#</th>
                        <th className="border border-slate-200 px-3 py-2 dark:border-slate-700">Roll No</th>
                        <th className="border border-slate-200 px-3 py-2 dark:border-slate-700">Student Name</th>
                        <th className="border border-slate-200 px-3 py-2 dark:border-slate-700">Mid / Re-Mid</th>
                        <th className="border border-slate-200 px-3 py-2 dark:border-slate-700">Sessional</th>
                        <th className="border border-slate-200 px-3 py-2 dark:border-slate-700">Final</th>
                        <th className="border border-slate-200 px-3 py-2 dark:border-slate-700">Practical</th>
                        <th className="border border-slate-200 px-3 py-2 dark:border-slate-700">Total</th>
                        <th className="border border-slate-200 px-3 py-2 dark:border-slate-700">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {resRoster.map((r, idx) => (
                        <tr key={r.student_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="border border-slate-100 px-3 py-2 text-slate-500 dark:border-slate-800">{idx + 1}</td>
                          <td className="border border-slate-100 px-3 py-2 dark:border-slate-800">
                            {resExportActive ? (
                              <span>{r.roll_no ?? "—"}</span>
                            ) : (
                              <input
                                type="text"
                                value={r.roll_no ?? ""}
                                onChange={(e) => updateResCell(r.student_id, "roll_no", e.target.value)}
                                className="w-24 rounded border border-slate-200 px-1.5 py-0.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                              />
                            )}
                          </td>
                          <td className="border border-slate-100 px-3 py-2 font-medium dark:border-slate-800">{r.name}</td>

                          {/* ── Mid / Re-Mid cell ── */}
                          <td className="border border-slate-100 px-3 py-2 dark:border-slate-800">
                            {resExportActive ? (
                              <div className="space-y-0.5 text-xs">
                                {r.mid_absent ? (
                                  <>
                                    <span className="inline-block rounded bg-red-50 px-1.5 py-0.5 text-red-600 dark:bg-red-500/10 dark:text-red-400">Absent</span>
                                    {r.re_mid !== null && !r.re_mid_absent
                                      ? <div className="text-[10px] text-slate-500">Re-Mid: {r.re_mid}</div>
                                      : r.re_mid_absent
                                        ? <div className="text-[10px] text-red-500">Re-Mid: Absent</div>
                                        : null}
                                  </>
                                ) : (
                                  <span>{r.mid}</span>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number" min={0}
                                    value={r.mid_absent ? "" : r.mid}
                                    disabled={r.mid_absent}
                                    onChange={(e) => updateResCell(r.student_id, "mid", e.target.value)}
                                    className="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-sm disabled:cursor-not-allowed disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:disabled:bg-slate-800"
                                  />
                                </div>
                                <label className="flex cursor-pointer items-center gap-1 text-[11px] text-slate-500">
                                  <input
                                    type="checkbox"
                                    checked={r.mid_absent}
                                    onChange={(e) => updateResCell(r.student_id, "mid_absent", e.target.checked)}
                                    className="h-3 w-3 accent-red-500"
                                  />
                                  Absent
                                </label>
                                {r.mid_absent && (
                                  <div className="rounded border border-dashed border-amber-200 bg-amber-50/60 p-1.5 dark:border-amber-700/40 dark:bg-amber-500/5">
                                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Re-Mid</p>
                                    <input
                                      type="number" min={0}
                                      value={r.re_mid_absent ? "" : (r.re_mid ?? "")}
                                      disabled={r.re_mid_absent}
                                      onChange={(e) => updateResCell(r.student_id, "re_mid", e.target.value)}
                                      className="mb-1 w-16 rounded border border-slate-200 px-1.5 py-0.5 text-sm disabled:cursor-not-allowed disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:disabled:bg-slate-800"
                                    />
                                    <label className="flex cursor-pointer items-center gap-1 text-[11px] text-slate-500">
                                      <input
                                        type="checkbox"
                                        checked={r.re_mid_absent}
                                        onChange={(e) => updateResCell(r.student_id, "re_mid_absent", e.target.checked)}
                                        className="h-3 w-3 accent-red-500"
                                      />
                                      Also Absent
                                    </label>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* ── Sessional / Final / Practical ── */}
                          {(["sessional", "final", "practical"] as const).map((field) => (
                            <td key={field} className="border border-slate-100 px-3 py-2 dark:border-slate-800">
                              {resExportActive ? (
                                <span>{r[field]}</span>
                              ) : (
                                <input
                                  type="number" min={0}
                                  value={r[field]}
                                  onChange={(e) => updateResCell(r.student_id, field, e.target.value)}
                                  className="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                                />
                              )}
                            </td>
                          ))}
                          <td className="border border-slate-100 px-3 py-2 font-semibold text-indigo-600 dark:border-slate-800 dark:text-indigo-400">
                            {r.total ?? (r.mid + r.sessional + r.final)}
                          </td>
                          <td className="border border-slate-100 px-3 py-2 dark:border-slate-800">
                            {resExportActive ? (
                              <span>{r.status}</span>
                            ) : (
                              <select
                                value={r.status}
                                onChange={(e) => updateResCell(r.student_id, "status", e.target.value)}
                                className="rounded border border-slate-200 px-1.5 py-0.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                              >
                                <option value="pass">Pass</option>
                                <option value="fail">Fail</option>
                                <option value="freezed">Freezed</option>
                                <option value="drop">Drop</option>
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {tab === "timetable" && (
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            {timetableLoading ? (
              <DataFetchLoader />
            ) : timetables.length === 0 ? (
              <p className="text-sm text-slate-400">
                No timetable entries found for your active courses.
              </p>
            ) : (
              timetables.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTimetableId(t.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    selectedTimetableId === t.id
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                      : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  }`}
                >
                  {t.class_name} ({t.session}) — {t.shift}
                </button>
              ))
            )}
          </div>

          {timetableDetail && (
            <div className="overflow-x-auto card-3d p-4">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr>
                    <th className="border border-slate-200 px-2 py-2 dark:border-slate-700">Day</th>
                    {timetableDetail.periods.map((p) => (
                      <th
                        key={p.id}
                        className="border border-slate-200 px-2 py-2 text-xs dark:border-slate-700"
                      >
                        {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timetableDetail.days.map((d) => (
                    <tr key={d.id}>
                      <td className="border border-slate-200 px-2 py-2 font-medium dark:border-slate-700">
                        {d.day_name}
                      </td>
                      {timetableDetail.periods.map((p) => {
                        const cell = cellFor(d.id, p.id);
                        return (
                          <td
                            key={p.id}
                            className="border border-slate-200 px-2 py-2 text-xs dark:border-slate-700"
                          >
                            {cell?.allocation_id ? (
                              <div>
                                <div className="font-medium text-slate-800 dark:text-slate-100">
                                  {cell.course_title}
                                </div>
                                {cell.combined_with && cell.combined_with.length > 0 && (
                                  <div className="text-[10px] text-slate-400">
                                    Combined:{" "}
                                    {cell.combined_with
                                      .map((cw) => `${cw.class_name} (${cw.session})`)
                                      .join(",")}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}


        {tab === "remid-datesheet" && (
          <div>
            <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-white">
              Re-Mid Exam Date Sheet
            </h2>
            {rdLoading ? (
              <DataFetchLoader />
            ) : rdRows.length === 0 ? (
              <div className="card-3d p-8 text-center text-sm text-slate-400">
                No re-mid exam schedule found. Either no students were absent in the Mid exam, or the date sheet has not been published yet.
              </div>
            ) : (
              (() => {
                const groups = Array.from(
                  rdRows.reduce((map, r) => {
                    const key = r.semester_id;
                    if (!map.has(key)) {
                      map.set(key, {
                        label: `${r.class_name} (${r.session}) — Semester ${r.semester_number} ${r.term_type}`,
                        rows: [] as TeacherRdRow[],
                      });
                    }
                    map.get(key)!.rows.push(r);
                    return map;
                  }, new Map<string, { label: string; rows: TeacherRdRow[] }>()),
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
                                <th className="px-3 py-2 text-center">Cr. Hrs</th>
                                <th className="px-3 py-2 text-center">Absent Students</th>
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

      {tab === "datesheet" && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-white">
            Mid Exam Date Sheet
          </h2>
          {dsLoading ? (
            <DataFetchLoader />
          ) : dsRows.length === 0 ? (
            <div className="card-3d p-8 text-center text-sm text-slate-400">
              No active-semester date sheet entries found for your courses.
            </div>
          ) : (
            (() => {
              // Group by semester_id (class + semester)
              const groups = Array.from(
                dsRows.reduce((map, r) => {
                  const key = r.semester_id;
                  if (!map.has(key)) {
                    map.set(key, {
                      label: `${r.class_name} (${r.session}) — Semester ${r.semester_number} ${r.term_type}`,
                      rows: [] as TeacherDsRow[],
                    });
                  }
                  map.get(key)!.rows.push(r);
                  return map;
                }, new Map<string, { label: string; rows: TeacherDsRow[] }>()),
              );
              return (
                <div className="space-y-6">
                  {groups.map(([semId, group]) => (
                    <div key={semId}>
                      <p className="mb-2 text-sm font-semibold text-indigo-700 dark:text-indigo-400">
                        {group.label}
                      </p>
                      <div className="overflow-x-auto card-3d shadow-sm">
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-800 dark:bg-slate-800">
                              <th className="px-3 py-2">Course</th>
                              <th className="px-3 py-2 text-center">Cr. Hrs</th>
                              <th className="px-3 py-2">Paper Date</th>
                              <th className="px-3 py-2">Bundle Received</th>
                              <th className="px-3 py-2">Return Date</th>
                              <th className="px-3 py-2 text-center">Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((r) => (
                              <tr
                                key={r.course_id}
                                className="border-b border-slate-100 dark:border-slate-800"
                              >
                                <td className="px-3 py-2">
                                  <div className="font-medium">{r.course_title}</div>
                                  <div className="text-xs text-slate-400">{r.course_code}</div>
                                </td>
                                <td className="px-3 py-2 text-center">{r.credit_hours}</td>
                                <td className="px-3 py-2">
                                  {r.paper_date ? formatDateOnly(r.paper_date) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {r.bundle_received_date ? formatDateOnly(r.bundle_received_date) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {r.return_date ? formatDateOnly(r.return_date) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                      r.result_uploaded
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                                        : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                                    }`}
                                  >
                                    {r.result_uploaded ? "Uploaded" : "Pending"}
                                  </span>
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

      {tab === "mark" && (
        <div>
          <div className="mb-4 grid grid-cols-1 gap-3 card-3d p-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Course (select to load class)
              </label>
              <select
                value={markAllocationId}
                onChange={(e) => {
                  const allocId = e.target.value;
                  setMarkAllocationId(allocId);
                  const course = active.find((c) => c.allocation_id === allocId);
                  setMarkClassId(course ? course.class_id : "");
                  setRosterRows([]);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Select a course</option>
                {active.map((c) => (
                  <option key={`${c.allocation_id}-${c.class_name}`} value={c.allocation_id}>
                    {c.course_title} — {c.class_name} ({c.session}){c.is_combined ? " [Combined]" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Date
              </label>
              <input
                type="date"
                value={markDate}
                onChange={(e) => setMarkDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {isCombinedRoster && rosterRows.length > 0 && (
            <p className="mb-2 text-xs text-indigo-600 dark:text-indigo-400">
              This is a combined lecture — students from all combined classes are shown together.
            </p>
          )}

          <div className="overflow-hidden card-3d card-hover">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rosterLoading ? (
                  <TableLoader colSpan={3} />
                ) : !markAllocationId ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-slate-400">
                      Select a course above to load students.
                    </td>
                  </tr>
                ) : rosterRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-slate-400">
                      No students found.
                    </td>
                  </tr>
                ) : (
                  rosterRows.map((r) => (
                    <tr key={r.student_id} className={r.locked ? "bg-red-50/40 dark:bg-red-900/10" : ""}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-slate-800 dark:text-slate-100">
                            {r.name}
                          </div>
                          {r.locked && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-400">
                              Struck Off
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {r.roll_no || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.locked ? (
                          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400">
                            Absent
                          </span>
                        ) : (
                          <div className="flex items-center gap-3">
                            {(["present", "absent", "leave"] as const).map((opt) => (
                              <label key={opt} className="flex cursor-pointer items-center gap-1.5">
                                <input
                                  type="radio"
                                  name={`status-${r.student_id}`}
                                  value={opt}
                                  checked={r.status === opt}
                                  onChange={() =>
                                    updateRosterRow(r.student_id, { status: opt })
                                  }
                                  className="accent-indigo-600"
                                />
                                <span className={`text-xs font-medium capitalize ${
                                  opt === "present"
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : opt === "absent"
                                    ? "text-red-500 dark:text-red-400"
                                    : "text-amber-500 dark:text-amber-400"
                                }`}>
                                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          disabled={r.locked || r.status === "present"}
                          value={r.reason}
                          onChange={(e) =>
                            updateRosterRow(r.student_id, { reason: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-900"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {rosterRows.length > 0 && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSaveRoster}
                disabled={rosterSaving}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {rosterSaving ? <ButtonLoader /> : <Save size={16} />}
                Save Attendance
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "students" && (
        <div>
          <div className="mb-4 card-3d p-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Course
              </label>
              <select
                value={studentsAllocId}
                onChange={(e) => setStudentsAllocId(e.target.value)}
                className="w-full max-w-lg rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Select a course to view student attendance</option>
                {active.map((c) => (
                  <option key={c.allocation_id} value={c.allocation_id}>
                    {c.course_title} — {c.class_name} ({c.session}){c.is_combined ? " [Combined]" : ""}
                  </option>
                ))}
              </select>
            </div>
            {studentReportCourse && studentsAllocId && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Attendance for <strong>{studentReportCourse.course_title}</strong>
                {studentReportCourse.is_combined && " — Combined lecture (all classes merged)"}
              </p>
            )}
          </div>

          <div className="overflow-hidden card-3d">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Roll No</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Present</th>
                  <th className="px-4 py-3">Absent</th>
                  <th className="px-4 py-3">Leave</th>
                  <th className="px-4 py-3">%</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {studentReportLoading ? (
                  <TableLoader colSpan={8} />
                ) : !studentsAllocId ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                      Select a course above to view student attendance.
                    </td>
                  </tr>
                ) : studentReportRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                      No students found for this course.
                    </td>
                  </tr>
                ) : (
                  studentReportRows.map((r) => (
                    <tr key={r.student_id} className={r.student_status !== "active" ? "bg-slate-50/60 dark:bg-slate-800/30" : ""}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-slate-100">{r.name}</div>
                        {r.student_status !== "active" && (
                          <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                            r.student_status === "struck_off"
                              ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
                              : r.student_status === "freezed"
                              ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400"
                              : r.student_status === "left"
                              ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                          }`}>
                            {r.student_status.replace("_", " ")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{r.roll_no || "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{r.class_name} ({r.session})</td>
                      <td className="px-4 py-3 text-emerald-600 font-semibold">{r.presents}</td>
                      <td className="px-4 py-3 text-red-500 font-semibold">{r.absents}</td>
                      <td className="px-4 py-3 text-amber-500 font-semibold">{r.leaves}</td>
                      <td className="px-4 py-3 font-bold">
                        {r.percentage !== null ? `${r.percentage}%` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.status === "ok" && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">OK</span>
                        )}
                        {r.status === "warning" && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Warning</span>
                        )}
                        {r.status === "low" && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">Low</span>
                        )}
                        {r.status === "no-data" && (
                          <span className="text-xs text-slate-400">No data</span>
                        )}
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
          {reportCourseFilter && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-800 dark:bg-sky-900/20">
              <Eye size={16} className="shrink-0 text-sky-600 dark:text-sky-400" />
              <span className="flex-1 text-sm text-sky-800 dark:text-sky-200">
                Showing your attendance records for{" "}
                <strong>{reportCourseFilter.label}</strong>
              </span>
              <button
                onClick={() => setReportCourseFilter(null)}
                className="rounded-md p-1 text-sky-500 hover:bg-sky-100 dark:hover:bg-sky-900/40"
                title="Clear filter"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="mb-4 flex flex-wrap items-end gap-3 card-3d p-4 print:hidden">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Course
              </label>
              <select
                value={reportCourseId}
                onChange={(e) => {
                  setReportCourseId(e.target.value);
                  setReportCourseFilter(null);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">All Courses</option>
                {reportCourseOptions.map((c) => (
                  <option key={c.course_id} value={c.course_id}>
                    {c.course_title} ({c.course_code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Class
              </label>
              <select
                value={reportClassId}
                onChange={(e) => {
                  setReportClassId(e.target.value);
                  setReportCourseFilter(null);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">All Classes</option>
                {reportClassOptions.map((c) => (
                  <option key={c.class_id} value={c.class_id}>
                    {c.class_name} ({c.session})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                From
              </label>
              <input
                type="date"
                value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                To
              </label>
              <input
                type="date"
                value={reportTo}
                onChange={(e) => setReportTo(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <FileDown size={16} /> Export PDF
            </button>
          </div>

          <div className="overflow-hidden card-3d print:hidden">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Class(es)</th>
                  <th className="px-4 py-3">Lectures</th>
                  <th className="px-4 py-3">Late (min)</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reportLoading ? (
                  <TableLoader colSpan={6} />
                ) : reportRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      No attendance records found.
                    </td>
                  </tr>
                ) : (
                  reportRows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3">{formatDateOnly(r.attendance_date)}</td>
                      <td className="px-4 py-3">
                        {r.course_title} ({r.course_code})
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {r.classes.map((c) => `${c.class_name} (${c.session})`).join(",")}
                      </td>
                      <td className="px-4 py-3">{r.lecture_count}</td>
                      <td className="px-4 py-3">{r.late_minutes}</td>
                      <td className="px-4 py-3 uppercase">{r.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="hidden print:block">
            <div className="mb-3 rounded-lg border-2 border-indigo-600 bg-gradient-to-r from-indigo-600 to-sky-500 p-3 text-center text-white">
              <h2 className="text-lg font-extrabold tracking-wide">
                City College (University Campus)
              </h2>
              <p className="text-xs font-semibold opacity-90">My Attendance Record</p>
              <p className="text-[10px] opacity-80">
                Generated: {formatDateOnly(new Date().toISOString())}
              </p>
            </div>
            <table className="w-full border-collapse text-left text-[11px]">
              <thead className="bg-indigo-600 text-white">
                <tr>
                  <th className="border border-indigo-400 px-1.5 py-0.5">Date</th>
                  <th className="border border-indigo-400 px-1.5 py-0.5">Course</th>
                  <th className="border border-indigo-400 px-1.5 py-0.5">Class(es)</th>
                  <th className="border border-indigo-400 px-1.5 py-0.5">Lectures</th>
                  <th className="border border-indigo-400 px-1.5 py-0.5">Late (min)</th>
                  <th className="border border-indigo-400 px-1.5 py-0.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((r, idx) => (
                  <tr key={r.id} className={idx % 2 === 0 ? "bg-indigo-50/60" : "bg-white"}>
                    <td className="border border-indigo-200 px-1.5 py-0.5">
                      {formatDateOnly(r.attendance_date)}
                    </td>
                    <td className="border border-indigo-200 px-1.5 py-0.5">
                      {r.course_title} ({r.course_code})
                    </td>
                    <td className="border border-indigo-200 px-1.5 py-0.5">
                      {r.classes.map((c) => `${c.class_name} (${c.session})`).join(",")}
                    </td>
                    <td className="border border-indigo-200 px-1.5 py-0.5">{r.lecture_count}</td>
                    <td className="border border-indigo-200 px-1.5 py-0.5">{r.late_minutes}</td>
                    <td className="border border-indigo-200 px-1.5 py-0.5 uppercase">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "notifications" && (
        <div>
          <div className="mb-3 flex justify-end">
            <button
              onClick={markAllRead}
              className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Mark all as read
            </button>
          </div>
          <div className="space-y-2">
            {notifLoading ? (
              <DataFetchLoader />
            ) : notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-xl border p-4 ${
                    n.is_read
                      ? "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/40"
                      : "border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-500/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{n.title}</p>
                    {!n.is_read && (
                      <button
                        onClick={() => markNotificationRead(n.id)}
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
        </div>
      )}

      {tab === "profile" && profile && (
        <div className="space-y-6">
          <div className="card-3d card-hover p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Profile
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">
                  Name
                </label>
                <p className="text-sm text-slate-800 dark:text-slate-100">{profile.name}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">
                  Email
                </label>
                <p className="text-sm text-slate-800 dark:text-slate-100">{profile.email}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">
                  Department
                </label>
                <p className="text-sm text-slate-800 dark:text-slate-100">
                  {profile.department_name}
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">
                  Type
                </label>
                <p className="text-sm capitalize text-slate-800 dark:text-slate-100">
                  {profile.type}
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">
                  Phone
                </label>
                <input
                  type="text"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={profileForm.bank_name}
                  onChange={(e) => setProfileForm((p) => ({ ...p, bank_name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">
                  Account Title
                </label>
                <input
                  type="text"
                  value={profileForm.account_title}
                  onChange={(e) => setProfileForm((p) => ({ ...p, account_title: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">
                  Account Number
                </label>
                <input
                  type="text"
                  value={profileForm.account_number}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, account_number: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSaveProfile}
                disabled={profileSaving}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {profileSaving ? <ButtonLoader /> : <Save size={16} />}
                Save Profile
              </button>
            </div>
          </div>

          <div className="card-3d card-hover p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Change Password
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(e) =>
                    setPasswordForm((p) => ({ ...p, current_password: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, new_password: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleChangePassword}
                disabled={profileSaving}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
