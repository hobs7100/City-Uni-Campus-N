"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Bell,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileDown,
  GraduationCap,
  Save,
  User,
  X,
} from "lucide-react";
import { formatDateOnly } from "@/lib/format";
import { TableLoader, ButtonLoader, DataFetchLoader } from "@/components/ui/Loaders";

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
  semester_number: number;
  term_type: string;
  class_name: string;
  session: string;
  payment_status?: "paid" | "pending" | "n/a";
  outline_url?: string | null;
  delivered_lectures?: number;
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

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const tabs = [
  { id: "overview", label: "Overview", icon: ClipboardList },
  { id: "courses", label: "My Courses", icon: BookOpen },
  { id: "timetable", label: "Timetable", icon: CalendarClock },
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
    if (tab === "timetable") loadTimetables();
    if (tab === "mark") loadRoster();
    if (tab === "students") loadStudentReport();
    if (tab === "report") loadAttendanceReport();
    if (tab === "notifications") loadNotifications();
    if (tab === "profile") loadProfile();
  }, [tab, loadTimetables, loadRoster, loadStudentReport, loadAttendanceReport, loadNotifications, loadProfile]);

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
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{active.length}</p>
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
              {active.reduce((s, c) => s + (c.delivered_lectures ?? 0), 0)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Lectures Delivered</p>
          </div>
          <div className="card-3d card-hover p-5">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {inactive.filter((c) => c.payment_status === "pending").length}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Pending Bills</p>
          </div>
        </div>
      )}

      {tab === "courses" && (
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Active Courses
            </h2>
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
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {coursesLoading ? (
                    <TableLoader colSpan={7} />
                  ) : active.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No active courses.
                      </td>
                    </tr>
                  ) : (
                    active.map((c) => (
                      <tr key={`${c.allocation_id}-${c.class_name}-${c.semester_number}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800 dark:text-slate-100">
                            {c.course_title}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {c.course_code} {c.is_combined && "· Combined"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {c.class_name} ({c.session})
                        </td>
                        <td className="px-4 py-3">
                          Sem {c.semester_number} — {c.term_type}
                        </td>
                        <td className="px-4 py-3 capitalize">
                          {c.allocation_type.replace("_", "")}
                        </td>
                        <td className="px-4 py-3 font-semibold text-indigo-600 dark:text-indigo-400">
                          {c.delivered_lectures ?? 0}
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
                          <button
                            onClick={() => {
                              setReportCourseId(c.course_id);
                              setReportClassId(c.class_id);
                              setReportCourseFilter({
                                label: `${c.course_title} — ${c.class_name} (${c.session})`,
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
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Inactive Courses
            </h2>
            <div className="overflow-hidden card-3d card-hover">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Course</th>
                    <th className="px-4 py-3">Class / Session</th>
                    <th className="px-4 py-3">Semester</th>
                    <th className="px-4 py-3">Payment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {inactive.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                        No inactive courses.
                      </td>
                    </tr>
                  ) : (
                    inactive.map((c) => (
                      <tr key={`${c.allocation_id}-${c.class_name}-${c.semester_number}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800 dark:text-slate-100">
                            {c.course_title}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {c.course_code}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {c.class_name} ({c.session})
                        </td>
                        <td className="px-4 py-3">
                          Sem {c.semester_number} — {c.term_type}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                              c.payment_status === "paid"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                            }`}
                          >
                            {c.payment_status === "paid" ? "Paid" : "Pending"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Call Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rosterLoading ? (
                  <TableLoader colSpan={5} />
                ) : !markAllocationId ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                      Select a course above to load students.
                    </td>
                  </tr>
                ) : rosterRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                      No students found.
                    </td>
                  </tr>
                ) : (
                  rosterRows.map((r) => (
                    <tr key={r.student_id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-slate-100">
                          {r.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {r.roll_no || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {r.class_name} ({r.session})
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={r.status}
                          onChange={(e) =>
                            updateRosterRow(r.student_id, {
                              status: e.target.value as RosterRow["status"],
                            })
                          }
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="leave">Leave</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          disabled={r.status === "present"}
                          value={r.reason}
                          onChange={(e) =>
                            updateRosterRow(r.student_id, { reason: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-900"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={r.call_remarks}
                          onChange={(e) =>
                            updateRosterRow(r.student_id, { call_remarks: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                    <tr key={r.student_id}>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.name}</td>
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
                <button
                  key={n.id}
                  onClick={() => !n.is_read && markNotificationRead(n.id)}
                  className={`block w-full rounded-xl border p-4 text-left ${
                    n.is_read
                      ? "border-slate-200 bg-white"
                      : "border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-500/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{n.title}</p>
                    {!n.is_read && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
                  </div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{n.message}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatDateOnly(n.created_at)}</p>
                </button>
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
