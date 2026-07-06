"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Bell, BookOpen, CalendarClock, CheckCircle2, ClipboardList, FileDown, Loader2, Save, User } from "lucide-react";
import { formatDateOnly } from "@/lib/format";

interface CourseRow {
  allocation_id: string;
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
  { id: "report", label: "My Attendance", icon: FileDown },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "profile", label: "Profile", icon: User },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function TeacherDashboardManager() {
  const [tab, setTab] = useState<TabId>("overview");

  const [active, setActive] = useState<CourseRow[]>([]);
  const [inactive, setInactive] = useState<CourseRow[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  const [timetables, setTimetables] = useState<TimetableSummary[]>([]);
  const [selectedTimetableId, setSelectedTimetableId] = useState("");
  const [timetableDetail, setTimetableDetail] = useState<TimetableDetail | null>(null);
  const [timetableLoading, setTimetableLoading] = useState(false);

  const [classOptions, setClassOptions] = useState<{ id: string; class_name: string; session: string }[]>([]);
  const [markClassId, setMarkClassId] = useState("");
  const [markDate, setMarkDate] = useState(todayStr());
  const [rosterRows, setRosterRows] = useState<RosterRow[]>([]);
  const [semesterInfo, setSemesterInfo] = useState<Record<string, unknown> | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterSaving, setRosterSaving] = useState(false);
  const [isCombinedRoster, setIsCombinedRoster] = useState(false);

  const [reportRows, setReportRows] = useState<AttendanceReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({ phone: "", bank_name: "", account_title: "", account_number: "" });
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

  const loadDistinctClasses = useCallback(async () => {
    const res = await fetch("/api/teacher/courses");
    const data = await res.json();
    if (res.ok) {
      const seen = new Map<string, { id: string; class_name: string; session: string }>();
      for (const c of data.active as (CourseRow & { class_id: string })[]) {
        seen.set(c.class_id, { id: c.class_id, class_name: c.class_name, session: c.session });
      }
      setClassOptions(Array.from(seen.values()));
    }
  }, []);

  const loadTimetables = useCallback(async () => {
    setTimetableLoading(true);
    try {
      const res = await fetch("/api/teacher/timetable");
      const data = await res.json();
      if (res.ok) {
        setTimetables(data.timetables);
        if (data.timetables.length > 0 && !selectedTimetableId) setSelectedTimetableId(data.timetables[0].id);
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
    if (!markClassId || !markDate) {
      setRosterRows([]);
      setSemesterInfo(null);
      return;
    }
    setRosterLoading(true);
    try {
      const params = new URLSearchParams({ class_id: markClassId, date: markDate });
      const res = await fetch(`/api/teacher/student-attendance/roster?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not load roster.");
        setRosterRows([]);
        setSemesterInfo(null);
        return;
      }
      setSemesterInfo(data.semester);
      setRosterRows(data.rows);
      setIsCombinedRoster(data.is_combined);
    } finally {
      setRosterLoading(false);
    }
  }, [markClassId, markDate]);

  const loadAttendanceReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams();
      if (reportFrom) params.set("from", reportFrom);
      if (reportTo) params.set("to", reportTo);
      const res = await fetch(`/api/teacher/attendance-report?${params.toString()}`);
      const data = await res.json();
      if (res.ok) setReportRows(data.records);
    } finally {
      setReportLoading(false);
    }
  }, [reportFrom, reportTo]);

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
    loadDistinctClasses();
  }, [loadCourses, loadDistinctClasses]);

  useEffect(() => {
    if (tab === "timetable") loadTimetables();
    if (tab === "mark") loadRoster();
    if (tab === "report") loadAttendanceReport();
    if (tab === "notifications") loadNotifications();
    if (tab === "profile") loadProfile();
  }, [tab, loadTimetables, loadRoster, loadAttendanceReport, loadNotifications, loadProfile]);

  useEffect(() => {
    if (selectedTimetableId) loadTimetableDetail(selectedTimetableId);
  }, [selectedTimetableId, loadTimetableDetail]);

  function updateRosterRow(studentId: string, patch: Partial<RosterRow>) {
    setRosterRows((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, ...patch } : r)));
  }

  async function handleSaveRoster() {
    if (!semesterInfo) return;
    setRosterSaving(true);
    try {
      const res = await fetch("/api/teacher/student-attendance/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semester_id: semesterInfo.id,
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

  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);
  const totalStudentsTaught = useMemo(() => classOptions.length, [classOptions]);

  function cellFor(dayId: string, periodId: string) {
    return timetableDetail?.cells.find((c) => c.day_id === dayId && c.period_id === periodId);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Teacher Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Your courses, timetable, and attendance</p>
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
                <span className="ml-0.5 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{active.length}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Active Courses</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalStudentsTaught}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Classes Taught</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
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
            <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Active Courses</h2>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Course</th>
                    <th className="px-4 py-3">Class / Session</th>
                    <th className="px-4 py-3">Semester</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {coursesLoading ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center"><Loader2 className="mx-auto animate-spin text-slate-400" /></td></tr>
                  ) : active.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No active courses.</td></tr>
                  ) : (
                    active.map((c) => (
                      <tr key={`${c.allocation_id}-${c.class_name}-${c.semester_number}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800 dark:text-slate-100">{c.course_title}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{c.course_code} {c.is_combined && "· Combined"}</div>
                        </td>
                        <td className="px-4 py-3">{c.class_name} ({c.session})</td>
                        <td className="px-4 py-3">Sem {c.semester_number} — {c.term_type}</td>
                        <td className="px-4 py-3 capitalize">{c.allocation_type.replace("_", " ")}</td>
                        <td className="px-4 py-3">PKR {c.rate}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Inactive Courses</h2>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
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
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No inactive courses.</td></tr>
                  ) : (
                    inactive.map((c) => (
                      <tr key={`${c.allocation_id}-${c.class_name}-${c.semester_number}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800 dark:text-slate-100">{c.course_title}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{c.course_code}</div>
                        </td>
                        <td className="px-4 py-3">{c.class_name} ({c.session})</td>
                        <td className="px-4 py-3">Sem {c.semester_number} — {c.term_type}</td>
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
              <Loader2 className="animate-spin text-slate-400" />
            ) : timetables.length === 0 ? (
              <p className="text-sm text-slate-400">No timetable entries found for your active courses.</p>
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
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr>
                    <th className="border border-slate-200 px-2 py-2 dark:border-slate-700">Day</th>
                    {timetableDetail.periods.map((p) => (
                      <th key={p.id} className="border border-slate-200 px-2 py-2 text-xs dark:border-slate-700">
                        {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timetableDetail.days.map((d) => (
                    <tr key={d.id}>
                      <td className="border border-slate-200 px-2 py-2 font-medium dark:border-slate-700">{d.day_name}</td>
                      {timetableDetail.periods.map((p) => {
                        const cell = cellFor(d.id, p.id);
                        return (
                          <td key={p.id} className="border border-slate-200 px-2 py-2 text-xs dark:border-slate-700">
                            {cell?.allocation_id ? (
                              <div>
                                <div className="font-medium text-slate-800 dark:text-slate-100">{cell.course_title}</div>
                                {cell.combined_with && cell.combined_with.length > 0 && (
                                  <div className="text-[10px] text-slate-400">
                                    Combined: {cell.combined_with.map((cw) => `${cw.class_name} (${cw.session})`).join(", ")}
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
          <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Class</label>
              <select
                value={markClassId}
                onChange={(e) => setMarkClassId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Select a class</option>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.class_name} ({c.session})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Date</label>
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

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
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
                  <tr><td colSpan={5} className="px-4 py-10 text-center"><Loader2 className="mx-auto animate-spin text-slate-400" /></td></tr>
                ) : !markClassId ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Select a class and date.</td></tr>
                ) : rosterRows.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No students found.</td></tr>
                ) : (
                  rosterRows.map((r) => (
                    <tr key={r.student_id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-slate-100">{r.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{r.roll_no || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{r.class_name} ({r.session})</td>
                      <td className="px-4 py-3">
                        <select
                          value={r.status}
                          onChange={(e) => updateRosterRow(r.student_id, { status: e.target.value as RosterRow["status"] })}
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
                          onChange={(e) => updateRosterRow(r.student_id, { reason: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-900"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={r.call_remarks}
                          onChange={(e) => updateRosterRow(r.student_id, { call_remarks: e.target.value })}
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
                {rosterSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Attendance
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "report" && (
        <div>
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 print:hidden dark:border-slate-800 dark:bg-slate-900">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">From</label>
              <input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">To</label>
              <input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              <FileDown size={16} /> Export PDF
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white print:hidden dark:border-slate-800 dark:bg-slate-900">
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
                  <tr><td colSpan={6} className="px-4 py-10 text-center"><Loader2 className="mx-auto animate-spin text-slate-400" /></td></tr>
                ) : reportRows.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No attendance records found.</td></tr>
                ) : (
                  reportRows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3">{formatDateOnly(r.attendance_date)}</td>
                      <td className="px-4 py-3">{r.course_title} ({r.course_code})</td>
                      <td className="px-4 py-3 text-xs">{r.classes.map((c) => `${c.class_name} (${c.session})`).join(", ")}</td>
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
              <h2 className="text-lg font-extrabold tracking-wide">City College (University Campus)</h2>
              <p className="text-xs font-semibold opacity-90">My Attendance Record</p>
              <p className="text-[10px] opacity-80">Generated: {formatDateOnly(new Date().toISOString())}</p>
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
                    <td className="border border-indigo-200 px-1.5 py-0.5">{formatDateOnly(r.attendance_date)}</td>
                    <td className="border border-indigo-200 px-1.5 py-0.5">{r.course_title} ({r.course_code})</td>
                    <td className="border border-indigo-200 px-1.5 py-0.5">{r.classes.map((c) => `${c.class_name} (${c.session})`).join(", ")}</td>
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
            <button onClick={markAllRead} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">Mark all as read</button>
          </div>
          <div className="space-y-2">
            {notifLoading ? (
              <Loader2 className="mx-auto animate-spin text-slate-400" />
            ) : notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.is_read && markNotificationRead(n.id)}
                  className={`block w-full rounded-xl border p-4 text-left ${
                    n.is_read ? "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" : "border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-500/10"
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
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Profile</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Name</label>
                <p className="text-sm text-slate-800 dark:text-slate-100">{profile.name}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Email</label>
                <p className="text-sm text-slate-800 dark:text-slate-100">{profile.email}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Department</label>
                <p className="text-sm text-slate-800 dark:text-slate-100">{profile.department_name}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Type</label>
                <p className="text-sm capitalize text-slate-800 dark:text-slate-100">{profile.type}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Phone</label>
                <input
                  type="text"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Bank Name</label>
                <input
                  type="text"
                  value={profileForm.bank_name}
                  onChange={(e) => setProfileForm((p) => ({ ...p, bank_name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Account Title</label>
                <input
                  type="text"
                  value={profileForm.account_title}
                  onChange={(e) => setProfileForm((p) => ({ ...p, account_title: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Account Number</label>
                <input
                  type="text"
                  value={profileForm.account_number}
                  onChange={(e) => setProfileForm((p) => ({ ...p, account_number: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={handleSaveProfile} disabled={profileSaving} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {profileSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Profile
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Change Password</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Current Password</label>
                <input
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, current_password: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">New Password</label>
                <input
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, new_password: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={handleChangePassword} disabled={profileSaving} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
