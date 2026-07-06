"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Bell, CalendarClock, ClipboardList, FileDown, GraduationCap, Loader2, Save, User } from "lucide-react";
import { formatDateOnly } from "@/lib/format";

interface Profile {
  id: string;
  name: string;
  father_name: string | null;
  cnic: string | null;
  contact: string | null;
  address: string | null;
  email: string | null;
  profile_image_url: string | null;
  status: string;
  session: string;
  department_name: string;
  class_name: string;
}

interface TimetableCell {
  id: string;
  day_id: string;
  period_id: string;
  allocation_id: string | null;
  course_code: string | null;
  course_title: string | null;
  teacher_name: string | null;
}

interface TimetableDetail {
  days: { id: string; day_name: string; position: number }[];
  periods: { id: string; start_time: string; end_time: string; position: number }[];
  cells: TimetableCell[];
}

interface ResultCourse {
  course_code: string;
  course_title: string;
  credit_hours: string;
  mid: string;
  sessional: string;
  final: string;
  practical: string;
  total: string;
  status: string;
}

interface SemesterResult {
  semester_number: number;
  term_type: string;
  courses: ResultCourse[];
}

interface AttendanceSummary {
  presents: number;
  absents: number;
  leaves: number;
  percentage: number;
  flag: "ok" | "warning" | "struck_off";
}

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const tabs = [
  { id: "overview", label: "Overview", icon: ClipboardList },
  { id: "timetable", label: "Timetable", icon: CalendarClock },
  { id: "attendance", label: "Attendance", icon: GraduationCap },
  { id: "results", label: "Results", icon: FileDown },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "profile", label: "Profile", icon: User },
] as const;

type TabId = (typeof tabs)[number]["id"];

const flagLabels: Record<string, string> = { ok: "OK", warning: "Warning", struck_off: "Struck Off" };
const flagStyles: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  struck_off: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

export default function StudentDashboardManager() {
  const [tab, setTab] = useState<TabId>("overview");
  const [profile, setProfile] = useState<Profile | null>(null);

  const [timetableDetail, setTimetableDetail] = useState<TimetableDetail | null>(null);
  const [timetableLoading, setTimetableLoading] = useState(false);

  const [attendanceFrom, setAttendanceFrom] = useState("");
  const [attendanceTo, setAttendanceTo] = useState("");
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const [results, setResults] = useState<SemesterResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const [profileForm, setProfileForm] = useState({ contact: "", address: "" });
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "" });
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/student/profile");
    const data = await res.json();
    if (res.ok) {
      setProfile(data.student);
      setProfileForm({ contact: data.student.contact || "", address: data.student.address || "" });
    }
  }, []);

  const loadTimetable = useCallback(async () => {
    setTimetableLoading(true);
    try {
      const res = await fetch("/api/student/timetable");
      const data = await res.json();
      if (res.ok && data.timetable) {
        const detailRes = await fetch(`/api/admin/timetables/${data.timetable.id}`);
        const detail = await detailRes.json();
        if (detailRes.ok) setTimetableDetail(detail);
      } else {
        setTimetableDetail(null);
      }
    } finally {
      setTimetableLoading(false);
    }
  }, []);

  const loadAttendance = useCallback(async () => {
    setAttendanceLoading(true);
    try {
      const params = new URLSearchParams();
      if (attendanceFrom) params.set("from", attendanceFrom);
      if (attendanceTo) params.set("to", attendanceTo);
      const res = await fetch(`/api/student/attendance?${params.toString()}`);
      const data = await res.json();
      if (res.ok) setAttendanceSummary(data.summary);
    } finally {
      setAttendanceLoading(false);
    }
  }, [attendanceFrom, attendanceTo]);

  const loadResults = useCallback(async () => {
    setResultsLoading(true);
    try {
      const res = await fetch("/api/student/results");
      const data = await res.json();
      if (res.ok) setResults(data.semesters);
    } finally {
      setResultsLoading(false);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await fetch("/api/student/notifications");
      const data = await res.json();
      if (res.ok) setNotifications(data.notifications);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    loadAttendance();
  }, [loadProfile, loadAttendance]);

  useEffect(() => {
    if (tab === "timetable") loadTimetable();
    if (tab === "attendance") loadAttendance();
    if (tab === "results") loadResults();
    if (tab === "notifications") loadNotifications();
  }, [tab, loadTimetable, loadAttendance, loadResults, loadNotifications]);

  async function markNotificationRead(id: string) {
    await fetch("/api/student/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  async function markAllRead() {
    await fetch("/api/student/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark_all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function handleSaveProfile() {
    setSaving(true);
    try {
      const res = await fetch("/api/student/profile", {
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
      loadProfile();
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!passwordForm.new_password) return;
    setSaving(true);
    try {
      const res = await fetch("/api/student/profile", {
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
      setSaving(false);
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  function cellFor(dayId: string, periodId: string) {
    return timetableDetail?.cells.find((c) => c.day_id === dayId && c.period_id === periodId);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Student Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Your timetable, attendance, and results</p>
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

      {tab === "overview" && profile && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-lg font-bold text-slate-900 dark:text-white">{profile.class_name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Class ({profile.session})</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-lg font-bold capitalize text-slate-900 dark:text-white">{profile.status}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Status</p>
          </div>
          {attendanceSummary && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-lg font-bold text-slate-900 dark:text-white">{attendanceSummary.percentage}%</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Attendance ({flagLabels[attendanceSummary.flag]})</p>
            </div>
          )}
        </div>
      )}

      {tab === "timetable" && (
        <div>
          {timetableLoading ? (
            <Loader2 className="mx-auto animate-spin text-slate-400" />
          ) : !timetableDetail ? (
            <p className="py-8 text-center text-sm text-slate-400">No timetable available for your class's active semester yet.</p>
          ) : (
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
                                <div className="text-[10px] text-slate-400">{cell.teacher_name}</div>
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

      {tab === "attendance" && (
        <div>
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">From</label>
              <input type="date" value={attendanceFrom} onChange={(e) => setAttendanceFrom(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">To</label>
              <input type="date" value={attendanceTo} onChange={(e) => setAttendanceTo(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
          </div>

          {attendanceLoading ? (
            <Loader2 className="mx-auto animate-spin text-slate-400" />
          ) : !attendanceSummary ? (
            <p className="py-8 text-center text-sm text-slate-400">No active semester found.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xl font-bold text-slate-900 dark:text-white">{attendanceSummary.presents}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Presents</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xl font-bold text-slate-900 dark:text-white">{attendanceSummary.absents}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Absents</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xl font-bold text-slate-900 dark:text-white">{attendanceSummary.leaves}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Leaves</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xl font-bold text-slate-900 dark:text-white">{attendanceSummary.percentage}%</p>
                <span className={`mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${flagStyles[attendanceSummary.flag]}`}>
                  {flagLabels[attendanceSummary.flag]}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "results" && (
        <div>
          <div className="mb-3 flex justify-end print:hidden">
            <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              <FileDown size={16} /> Export PDF
            </button>
          </div>
          {resultsLoading ? (
            <Loader2 className="mx-auto animate-spin text-slate-400" />
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No results uploaded yet.</p>
          ) : (
            <div className="space-y-6">
              {results.map((sem) => (
                <div key={sem.semester_number} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                  <div className="bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800/50 dark:text-slate-200">
                    Semester {sem.semester_number} — {sem.term_type}
                  </div>
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
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
                          <td className="px-4 py-2">{c.course_title} ({c.course_code})</td>
                          <td className="px-4 py-2">{c.mid}</td>
                          <td className="px-4 py-2">{c.sessional}</td>
                          <td className="px-4 py-2">{c.final}</td>
                          <td className="px-4 py-2">{c.practical}</td>
                          <td className="px-4 py-2 font-medium">{c.total}</td>
                          <td className="px-4 py-2 uppercase">{c.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
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
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Father Name</label>
                <p className="text-sm text-slate-800 dark:text-slate-100">{profile.father_name || "—"}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Email</label>
                <p className="text-sm text-slate-800 dark:text-slate-100">{profile.email || "—"}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Department</label>
                <p className="text-sm text-slate-800 dark:text-slate-100">{profile.department_name}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Contact</label>
                <input
                  type="text"
                  value={profileForm.contact}
                  onChange={(e) => setProfileForm((p) => ({ ...p, contact: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Address</label>
                <input
                  type="text"
                  value={profileForm.address}
                  onChange={(e) => setProfileForm((p) => ({ ...p, address: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={handleSaveProfile} disabled={saving} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
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
              <button onClick={handleChangePassword} disabled={saving} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
