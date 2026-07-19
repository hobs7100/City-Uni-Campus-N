"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Activity,
  AlertCircle,
  Bell,
  BookOpen,
  Camera,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  FileDown,
  FileText,
  GraduationCap,
  Printer,
  Save,
  School,
  RefreshCcw,
  ShieldCheck,
  Ticket,
  User,
  X,
} from "lucide-react";
import { formatDateOnly } from "@/lib/format";
import { ButtonLoader, DataFetchLoader } from "@/components/ui/Loaders";
import RichTextViewer from "@/components/ui/RichTextViewer";

/* ─── interfaces ─────────────────────────────────────────── */
interface Profile {
  id: string; name: string; father_name: string | null;
  cnic: string | null; contact: string | null; address: string | null;
  email: string | null; profile_image_url: string | null;
  status: string; session: string; department_name: string; class_name: string;
  class_id: string;
  scheme_of_studies_url: string | null;
}

interface ResultCourse {
  course_code: string; course_title: string; credit_hours: string;
  mid: string; mid_absent: boolean; re_mid: string | null; re_mid_absent: boolean;
  sessional: string; final: string; practical: string;
  total: string; status: string;
}
interface SemesterResult {
  semester_number: number; term_type: string; courses: ResultCourse[];
}

interface CourseAttRow {
  course_id: string; course_title: string; course_code: string;
  teacher_name: string; presents: number; absents: number;
  leaves: number; percentage: number; flag: string;
}
interface SemesterAtt {
  semester_id: string; semester_number: number; term_type: string;
  semester_status: string; courses: CourseAttRow[];
  overall: { presents: number; absents: number; leaves: number; percentage: number; flag: string };
}

interface AttDetail {
  attendance_date: string; status: string;
  reason: string | null; call_remarks: string | null;
}

interface Notification {
  id: string; title: string; message: string; is_read: boolean; created_at: string;
}

interface StudentDsRow {
  course_id: string;
  course_title: string;
  course_code: string;
  credit_hours: string;
  paper_date: string | null;
}

interface StudentRdRow {
  course_id: string;
  course_title: string;
  course_code: string;
  credit_hours: string;
  paper_date: string | null;
}

interface SlipCourseRow {
  course_id: string; course_title: string; course_code: string;
  credit_hours: string; paper_date: string | null; att_percentage: number;
}
interface SlipData {
  student: { id: string; name: string; father_name: string | null; class_name: string; session: string; department: string; profile_image_url: string | null };
  semester: { id: string; semester_number: number; term_type: string };
  overall_attendance: number;
  rows: SlipCourseRow[];
}

/* ─── helpers ─────────────────────────────────────────────── */
const flagLabel: Record<string, string> = { ok: "OK", warning: "Warning", struck_off: "Struck Off" };
const flagCls: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  struck_off: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};
const statusCls: Record<string, string> = {
  present: "text-emerald-600 dark:text-emerald-400",
  absent: "text-red-600 dark:text-red-400",
  leave: "text-amber-600 dark:text-amber-400",
};

/* ─── tabs ────────────────────────────────────────────────── */
const TABS = [
  { id: "overview",       label: "Overview",            icon: ClipboardList },
  { id: "results",        label: "Results",             icon: GraduationCap },
  { id: "datesheet",      label: "Mid Exam Date Sheet", icon: FileText },
  { id: "remid-datesheet", label: "Re-Mid Date Sheet",  icon: RefreshCcw },
  { id: "rollno-slip",    label: "Roll No. Slip",       icon: Ticket },
  { id: "attendance",     label: "Attendance",          icon: Activity },
  { id: "notifications",  label: "Notifications",       icon: Bell },
  { id: "profile",        label: "Profile",             icon: User },
] as const;
type TabId = (typeof TABS)[number]["id"];

/* ─── component ───────────────────────────────────────────── */
export default function StudentDashboardManager() {
  const [tab, setTab] = useState<TabId>("overview");
  const [profile, setProfile] = useState<Profile | null>(null);

  /* course-wise attendance (overview) */
  const [semAtts, setSemAtts] = useState<SemesterAtt[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [expandedSems, setExpandedSems] = useState<Set<string>>(new Set());

  /* details modal */
  const [modal, setModal] = useState<{
    semesterId: string; courseId: string; courseTitle: string; teacherName: string;
  } | null>(null);
  const [details, setDetails] = useState<AttDetail[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  /* results */
  const [results, setResults] = useState<SemesterResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  /* simple attendance tab */
  const [attFrom, setAttFrom] = useState("");
  const [attTo, setAttTo] = useState("");
  const [attSummary, setAttSummary] = useState<{
    presents: number; absents: number; leaves: number; percentage: number; flag: string;
  } | null>(null);
  const [attRecords, setAttRecords] = useState<{ attendance_date: string; status: string; reason: string | null }[]>([]);
  const [simpleAttLoading, setSimpleAttLoading] = useState(false);

  /* mid exam date sheet */
  const [dsRows, setDsRows] = useState<StudentDsRow[]>([]);
  const [dsLoading, setDsLoading] = useState(false);
  const [rdRows, setRdRows] = useState<StudentRdRow[]>([]);
  const [rdLoading, setRdLoading] = useState(false);

  /* notifications */
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  /* profile form */
  const [profileForm, setProfileForm] = useState({ contact: "", address: "" });
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "" });
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  /* roll no. slip */
  const [slipLoading, setSlipLoading] = useState(false);
  const [slipBlock, setSlipBlock] = useState<{ title: string; message: string } | null>(null);

  /* ── loaders ── */
  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/student/profile");
    const data = await res.json();
    if (res.ok) {
      setProfile(data.student);
      setProfileForm({ contact: data.student.contact || "", address: data.student.address || "" });
    }
  }, []);

  const loadCourseAtt = useCallback(async () => {
    setAttLoading(true);
    try {
      const res = await fetch("/api/student/course-attendance");
      const data = await res.json();
      if (res.ok) {
        setSemAtts(data.semesters ?? []);
        // auto-expand all semesters
        setExpandedSems(new Set((data.semesters ?? []).map((s: SemesterAtt) => s.semester_id)));
      }
    } finally {
      setAttLoading(false);
    }
  }, []);

  const loadResults = useCallback(async () => {
    setResultsLoading(true);
    try {
      const res = await fetch("/api/student/results");
      const data = await res.json();
      if (res.ok) setResults(data.semesters ?? []);
    } finally {
      setResultsLoading(false);
    }
  }, []);

  const loadSimpleAtt = useCallback(async () => {
    setSimpleAttLoading(true);
    try {
      const params = new URLSearchParams();
      if (attFrom) params.set("from", attFrom);
      if (attTo) params.set("to", attTo);
      const res = await fetch(`/api/student/attendance?${params}`);
      const data = await res.json();
      if (res.ok) { setAttSummary(data.summary); setAttRecords(data.records || []); }
    } finally {
      setSimpleAttLoading(false);
    }
  }, [attFrom, attTo]);

  const loadRdDatesheet = useCallback(async () => {
    setRdLoading(true);
    try {
      const res = await fetch("/api/student/re-mid-exam-datesheet");
      const data = await res.json();
      if (res.ok) setRdRows(data.rows ?? []);
    } finally {
      setRdLoading(false);
    }
    }, []);

    const loadDatesheet = useCallback(async () => {
    setDsLoading(true);
    try {
      const res = await fetch("/api/student/mid-exam-datesheet");
      const data = await res.json();
      if (res.ok) setDsRows(data.rows ?? []);
    } finally {
      setDsLoading(false);
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

  useEffect(() => { loadProfile(); loadCourseAtt(); }, [loadProfile, loadCourseAtt]);

  useEffect(() => {
    if (tab === "results")       loadResults();
    if (tab === "datesheet")     loadDatesheet();
    if (tab === "remid-datesheet") loadRdDatesheet();
    if (tab === "attendance")    loadSimpleAtt();
    if (tab === "notifications") loadNotifications();
  }, [tab, loadResults, loadDatesheet, loadRdDatesheet, loadSimpleAtt, loadNotifications]);

  /* details modal open */
  async function openDetails(semesterId: string, courseId: string, courseTitle: string, teacherName: string) {
    setModal({ semesterId, courseId, courseTitle, teacherName });
    setDetails([]);
    setDetailsLoading(true);
    try {
      const res = await fetch(
        `/api/student/course-attendance/details?semester_id=${semesterId}&course_id=${courseId}`
      );
      const data = await res.json();
      if (res.ok) setDetails(data.records ?? []);
    } finally {
      setDetailsLoading(false);
    }
  }

  /* notifications */
  async function markRead(id: string) {
    await fetch("/api/student/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((p) => p.map((n) => n.id === id ? { ...n, is_read: true } : n));
  }
  async function markAllRead() {
    await fetch("/api/student/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark_all: true }),
    });
    setNotifications((p) => p.map((n) => ({ ...n, is_read: true })));
  }

  /* profile save */
  async function handleSaveProfile() {
    setSaving(true);
    try {
      const res = await fetch("/api/student/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Something went wrong."); return; }
      toast.success("Profile updated.");
      loadProfile();
    } finally { setSaving(false); }
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
      if (!res.ok) { toast.error(data.error || "Something went wrong."); return; }
      toast.success("Password changed.");
      setPasswordForm({ current_password: "", new_password: "" });
    } finally { setSaving(false); }
  }

  /* profile picture upload */
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const upRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: base64, folder: "students" }),
      });
      const upData = await upRes.json();
      if (!upRes.ok) { toast.error(upData.error || "Upload failed."); return; }
      const pRes = await fetch("/api/student/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_image_url: upData.url }),
      });
      if (!pRes.ok) { toast.error("Failed to save photo."); return; }
      toast.success("Profile picture updated.");
      loadProfile();
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  }

  /* roll no. slip */
  function printSlip(data: SlipData) {
    const today = new Date().toLocaleDateString("en-PK", {
      year: "numeric", month: "long", day: "numeric",
    });

    const theoryRows = data.rows.filter((r) => Number(r.credit_hours) !== 1);
    const practicalRows = data.rows.filter((r) => Number(r.credit_hours) === 1);

    const fmtDate = (d: string) =>
      new Date(d + "T00:00:00").toLocaleDateString("en-PK", {
        day: "2-digit", month: "short", year: "numeric",
      });

    const renderGroup = (label: string, rows: SlipCourseRow[], headerBg: string) => {
      if (rows.length === 0) return "";
      return `<div style="margin-bottom:18px">
        <div style="background:${headerBg};color:white;padding:5px 12px;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-radius:4px 4px 0 0">${label}</div>
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead>
            <tr style="background:#f1f5f9">
              <th style="border:1px solid #e2e8f0;padding:6px 10px;text-align:left;color:#475569;font-weight:600;width:110px">Course Code</th>
              <th style="border:1px solid #e2e8f0;padding:6px 10px;text-align:left;color:#475569;font-weight:600">Course Title</th>
              <th style="border:1px solid #e2e8f0;padding:6px 10px;text-align:center;color:#475569;font-weight:600;width:90px">Attendance</th>
              <th style="border:1px solid #e2e8f0;padding:6px 10px;text-align:left;color:#475569;font-weight:600;width:105px">Paper Date</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r) => {
              const pct = r.att_percentage;
              const attColor = pct >= 75 ? "#15803d" : "#b91c1c";
              const attBg    = pct >= 75 ? "#dcfce7"  : "#fee2e2";
              return `<tr>
              <td style="border:1px solid #e2e8f0;padding:6px 10px">${r.course_code}</td>
              <td style="border:1px solid #e2e8f0;padding:6px 10px">${r.course_title}${pct < 75 ? `&nbsp;<span style="display:inline-block;background:#fee2e2;color:#b91c1c;font-size:8.5px;font-weight:700;padding:1px 5px;border-radius:3px;white-space:nowrap">NOT ALLOWED FOR MID EXAM</span>` : ""}</td>
              <td style="border:1px solid #e2e8f0;padding:6px 10px;text-align:center"><span style="display:inline-block;background:${attBg};color:${attColor};font-weight:700;font-size:11px;padding:2px 7px;border-radius:4px">${pct.toFixed(1)}%</span></td>
              <td style="border:1px solid #e2e8f0;padding:6px 10px;font-weight:500">${r.paper_date ? fmtDate(r.paper_date) : "—"}</td>
            </tr>`;}).join("")}
          </tbody>
        </table>
      </div>`;
    };

    const photoHtml = data.student.profile_image_url
      ? `<img src="${data.student.profile_image_url}" alt="Photo"
             style="width:90px;height:110px;object-fit:cover;border-radius:4px;border:2px solid #e2e8f0;display:block"/>`
      : `<div style="width:90px;height:110px;border-radius:4px;border:2px dashed #cbd5e1;background:#f1f5f9;display:flex;align-items:center;justify-content:center">
           <span style="font-size:9px;color:#94a3b8;text-align:center;line-height:1.4">No<br/>Photo</span>
         </div>`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Roll Number Slip</title>
<style>
  @page{size:A4 portrait;margin:14mm}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  *{box-sizing:border-box}
</style></head><body>
<div style="border:2px solid #3730a3;border-radius:8px;overflow:hidden">
  <div style="background:#ffffff;padding:18px 24px;border-bottom:2px solid #3730a3;display:flex;align-items:center;justify-content:space-between;gap:16px">
    <img src="${window.location.origin}/images/logo.png" alt="City College" style="height:54px;width:auto;display:block;flex-shrink:0"/>
    <div style="text-align:center;flex:1">
      <div style="color:#3730a3;font-size:20px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;margin-bottom:3px">Roll Number Slip</div>
      <div style="color:#64748b;font-size:11px">Mid Term Examination &mdash; ${data.semester.term_type} ${data.student.session}</div>
    </div>
    <div style="width:54px;flex-shrink:0"></div>
  </div>
  <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:14px 24px">
    <div style="display:flex;align-items:flex-start;gap:18px">
      <table style="flex:1;border-collapse:collapse;font-size:11.5px">
        <tr>
          <td style="padding:4px 0;color:#64748b;font-weight:700;text-transform:uppercase;font-size:9.5px;letter-spacing:.06em;width:115px">Student Name</td>
          <td style="padding:4px 8px;font-weight:600;color:#1e293b">${data.student.name}</td>
          <td style="padding:4px 0;color:#64748b;font-weight:700;text-transform:uppercase;font-size:9.5px;letter-spacing:.06em;width:80px">Class</td>
          <td style="padding:4px 8px;color:#1e293b">${data.student.class_name}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#64748b;font-weight:700;text-transform:uppercase;font-size:9.5px;letter-spacing:.06em">Father&rsquo;s Name</td>
          <td style="padding:4px 8px;color:#1e293b">${data.student.father_name || "&mdash;"}</td>
          <td style="padding:4px 0;color:#64748b;font-weight:700;text-transform:uppercase;font-size:9.5px;letter-spacing:.06em">Session</td>
          <td style="padding:4px 8px;color:#1e293b">${data.student.session}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#64748b;font-weight:700;text-transform:uppercase;font-size:9.5px;letter-spacing:.06em">Department</td>
          <td style="padding:4px 8px;color:#1e293b">${data.student.department}</td>
          <td style="padding:4px 0;color:#64748b;font-weight:700;text-transform:uppercase;font-size:9.5px;letter-spacing:.06em">Semester</td>
          <td style="padding:4px 8px;color:#1e293b">Semester ${data.semester.semester_number}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#64748b;font-weight:700;text-transform:uppercase;font-size:9.5px;letter-spacing:.06em">Issue Date</td>
          <td style="padding:4px 8px;color:#1e293b">${today}</td>
          <td style="padding:4px 0;color:#64748b;font-weight:700;text-transform:uppercase;font-size:9.5px;letter-spacing:.06em">Attendance</td>
          <td style="padding:4px 8px;font-weight:600;color:${data.overall_attendance >= 75 ? "#15803d" : "#b91c1c"}">${data.overall_attendance.toFixed(1)}%</td>
        </tr>
      </table>
      <div style="flex-shrink:0">${photoHtml}</div>
    </div>
  </div>
  <div style="padding:16px 24px">
    ${renderGroup("Date Sheet \u2013 Theory", theoryRows, "#3730a3")}
    ${renderGroup("Date Sheet \u2013 Practical", practicalRows, "#047857")}
  </div>
  <div style="margin:0 24px 16px;border:1px solid #e2e8f0;border-radius:4px;padding:12px">
    <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px;border-bottom:1px solid #f1f5f9;padding-bottom:4px">Instructions</div>
    <ol style="margin:0;padding-left:16px;font-size:10px;color:#475569;line-height:1.85">
      <li>Students will not be allowed to enter the examination hall without a valid Roll Number Slip and Original Student ID Card.</li>
      <li>Report to the examination hall at least 30 minutes before the scheduled examination time.</li>
      <li>Students arriving more than 15 minutes late after the commencement of the examination will not be permitted to enter.</li>
      <li>Mobile phones, smart watches, earphones, programmable calculators, and all unauthorized electronic devices are strictly prohibited inside the examination hall.</li>
      <li>Any form of cheating, possession of unauthorized material, or misconduct will result in disciplinary action according to university rules.</li>
      <li>Maintain complete silence and follow all instructions given by the invigilators throughout the examination.</li>
    </ol>
  </div>
  <div style="background:#3730a3;padding:8px 24px;display:flex;justify-content:space-between;align-items:center">
    <span style="color:#c7d2fe;font-size:9px">This is a computer-generated slip and does not require a signature.</span>
    <span style="color:#c7d2fe;font-size:9px">City College &mdash; University Campus</span>
  </div>
</div>
</body></html>`;

    const win = window.open("", "_blank", "width=920,height=720");
    if (!win) { toast.error("Pop-up blocked. Please allow pop-ups for this site and try again."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 600);
  }

  async function generateSlip() {
    setSlipLoading(true);
    try {
      const res = await fetch("/api/student/rollno-slip");
      const data = await res.json();
      if (!res.ok) { toast.error("Failed to validate slip. Please try again."); return; }
      if (!data.allowed) {
        const titles: Record<string, string> = {
          inactive_student: "Enrollment Inactive",
          no_active_semester: "No Active Semester",
          no_datesheet: "Date Sheet Not Available",
          low_attendance: "Insufficient Attendance",
        };
        setSlipBlock({
          title: titles[data.reason as string] ?? "Cannot Generate Slip",
          message: data.message,
        });
        return;
      }
      printSlip(data as SlipData);
    } finally {
      setSlipLoading(false);
    }
  }

  const unread = notifications.filter((n) => !n.is_read).length;

  function toggleSem(id: string) {
    setExpandedSems((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /* ── render ── */
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      {/* page header + tab strip */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Student Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {profile ? `${profile.class_name} · ${profile.session} · ${profile.department_name}` : "Loading…"}
        </p>
      </div>

      {/* tab navigation */}
      <div className="mb-6 flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/50">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-white hover:shadow-sm dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            <t.icon size={15} />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.label.split(" ")[0]}</span>
            {t.id === "notifications" && unread > 0 && (
              <span className="ml-0.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {unread}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* stat cards */}
          {profile && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="card-3d card-hover p-6">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-500/10">
                  <School size={32} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{profile.class_name}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Session: {profile.session}</p>
                {profile.scheme_of_studies_url && (
                  <a
                    href={`/api/admin/classes/${profile.class_id}/scheme`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                  >
                    <FileText size={12} /> View Scheme of Studies
                  </a>
                )}
              </div>

              <div className="card-3d card-hover p-6">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-500/10">
                  <ShieldCheck size={32} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-2xl font-bold capitalize text-slate-900 dark:text-white">{profile.status}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Enrollment Status</p>
              </div>

              {semAtts.length > 0 && (() => {
                const activeSem = semAtts.find((s) => s.semester_status === "active") ?? semAtts[semAtts.length - 1];
                return (
                  <div className="card-3d card-hover p-6">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-500/10">
                      <Activity size={32} className="text-violet-600 dark:text-violet-400" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {activeSem.overall.percentage}%
                    </p>
                    <span className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${flagCls[activeSem.overall.flag]}`}>
                      {flagLabel[activeSem.overall.flag]}
                    </span>
                    <p className="mt-1 text-xs text-slate-400">
                      Sem {activeSem.semester_number} Attendance
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* course-wise attendance by semester */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-white">
              Attendance by Course &amp; Semester
            </h2>
            {attLoading ? (
              <DataFetchLoader label="Loading attendance…" />
            ) : semAtts.length === 0 ? (
              <div className="card-3d p-8 text-center text-sm text-slate-400">
                No attendance records found.
              </div>
            ) : (
              <div className="space-y-4">
                {semAtts.map((sem) => {
                  const open = expandedSems.has(sem.semester_id);
                  return (
                    <div key={sem.semester_id} className="card-3d overflow-hidden">
                      {/* semester header — clickable to collapse */}
                      <button
                        onClick={() => toggleSem(sem.semester_id)}
                        className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left dark:bg-slate-800/60"
                      >
                        <div className="flex items-center gap-3">
                          <BookOpen size={18} className="text-indigo-500" />
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            Semester {sem.semester_number} — {sem.term_type}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            sem.semester_status === "active"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                          }`}>
                            {sem.semester_status === "active" ? "Active" : "Closed"}
                          </span>
                        </div>
                        {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                      </button>

                      {open && (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-left text-sm">
                            <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                              <tr>
                                <th className="px-4 py-3">Course</th>
                                <th className="px-4 py-3">Teacher</th>
                                <th className="px-4 py-3 text-center">Presents</th>
                                <th className="px-4 py-3 text-center">Absents</th>
                                <th className="px-4 py-3 text-center">Leaves</th>
                                <th className="px-4 py-3 text-center">%</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {sem.courses.length === 0 ? (
                                <tr>
                                  <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                                    No timetable set up for this semester yet.
                                  </td>
                                </tr>
                              ) : (
                                sem.courses.map((c) => (
                                  <tr key={c.course_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                    <td className="px-4 py-3">
                                      <p className="font-medium text-slate-800 dark:text-slate-100">{c.course_title}</p>
                                      <p className="text-xs text-slate-400">{c.course_code}</p>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.teacher_name}</td>
                                    <td className="px-4 py-3 text-center font-medium text-emerald-600 dark:text-emerald-400">{c.presents}</td>
                                    <td className="px-4 py-3 text-center font-medium text-red-600 dark:text-red-400">{c.absents}</td>
                                    <td className="px-4 py-3 text-center font-medium text-amber-600 dark:text-amber-400">{c.leaves}</td>
                                    <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-200">
                                      {c.percentage}%
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${flagCls[c.flag]}`}>
                                        {flagLabel[c.flag]}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <button
                                        onClick={() => openDetails(sem.semester_id, c.course_id, c.course_title, c.teacher_name)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                                      >
                                        <Eye size={13} /> Details
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}

                              {/* overall row */}
                              <tr className="bg-indigo-50/60 font-semibold dark:bg-indigo-500/5">
                                <td colSpan={2} className="px-4 py-3 text-slate-700 dark:text-slate-200">
                                  Overall Semester Attendance
                                </td>
                                <td className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400">{sem.overall.presents}</td>
                                <td className="px-4 py-3 text-center text-red-600 dark:text-red-400">{sem.overall.absents}</td>
                                <td className="px-4 py-3 text-center text-amber-600 dark:text-amber-400">{sem.overall.leaves}</td>
                                <td className="px-4 py-3 text-center text-slate-800 dark:text-white">{sem.overall.percentage}%</td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${flagCls[sem.overall.flag]}`}>
                                    {flagLabel[sem.overall.flag]}
                                  </span>
                                </td>
                                <td />
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── RESULTS ── */}
      {tab === "results" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Academic Results</h2>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 print:hidden"
            >
              <FileDown size={16} /> Export PDF
            </button>
          </div>
          {resultsLoading ? (
            <DataFetchLoader label="Loading results…" />
          ) : results.length === 0 ? (
            <div className="card-3d p-8 text-center text-sm text-slate-400">No results uploaded yet.</div>
          ) : (
            <div className="space-y-6">
              {results.map((sem) => (
                <div key={sem.semester_number} className="card-3d overflow-hidden">
                  <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3 dark:from-indigo-500/10 dark:to-violet-500/10">
                    <GraduationCap size={18} className="text-indigo-600 dark:text-indigo-400" />
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      Semester {sem.semester_number} — {sem.term_type}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Course</th>
                          <th className="px-4 py-3 text-center">Mid / Re-Mid</th>
                          <th className="px-4 py-3 text-center">Sessional</th>
                          <th className="px-4 py-3 text-center">Final</th>
                          <th className="px-4 py-3 text-center">Practical</th>
                          <th className="px-4 py-3 text-center">Total</th>
                          <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sem.courses.map((c) => {
                          const statusColor =
                            c.status === "pass" ? "text-emerald-600 dark:text-emerald-400"
                            : c.status === "fail" ? "text-red-600 dark:text-red-400"
                            : "text-amber-600 dark:text-amber-400";
                          return (
                            <tr key={c.course_code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-800 dark:text-slate-100">{c.course_title}</p>
                                <p className="text-xs text-slate-400">{c.course_code} · {c.credit_hours} cr</p>
                              </td>
                              <td className="px-4 py-3 text-center">
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
                              <td className="px-4 py-3 text-center">{c.sessional}</td>
                              <td className="px-4 py-3 text-center">{c.final}</td>
                              <td className="px-4 py-3 text-center">{c.practical}</td>
                              <td className="px-4 py-3 text-center font-bold text-slate-800 dark:text-white">{c.total}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`font-semibold uppercase ${statusColor}`}>{c.status}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ROLL NO. SLIP ── */}
      {tab === "rollno-slip" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Roll Number Slip</h2>
          </div>

          {/* requirements card */}
          <div className="card-3d p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Eligibility Requirements</h3>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              {[
                "Your enrollment status must be Active.",
                "The Mid Exam Date Sheet for the current semester must have been published by Admin.",
                "Your overall attendance must be ≥ 75%.",
                "If attendance for any individual course is below 75%, that course will be marked \u201cNot Allowed for Mid Exam\u201d on the slip \u2014 but the slip will still be generated.",
              ].map((txt, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
                    {i + 1}
                  </span>
                  <span>{txt}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-center">
            <button
              onClick={generateSlip}
              disabled={slipLoading}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-indigo-700 disabled:opacity-60 active:scale-95 transition-transform"
            >
              {slipLoading ? <ButtonLoader /> : <Printer size={18} />}
              {slipLoading ? "Validating…" : "Generate Slip"}
            </button>
          </div>
        </div>
      )}

      {/* ── MID EXAM DATE SHEET ── */}
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
            <DataFetchLoader label="Loading date sheet…" />
          ) : rdRows.length === 0 ? (
            <div className="card-3d p-8 text-center text-sm text-slate-400">
              You have no Re-Mid exam scheduled. Either you did not miss the Mid exam, or the date sheet has not been published yet.
            </div>
          ) : (
            <div className="space-y-4">
              {[
                { label: "Date Sheet – Theory",    isPractical: false, hdrCls: "bg-amber-50 dark:bg-amber-500/5" },
                { label: "Date Sheet – Practical", isPractical: true,  hdrCls: "bg-green-50 dark:bg-green-500/5" },
              ].map(({ label, isPractical, hdrCls }) => {
                const rows = rdRows.filter((r) => (Number(r.credit_hours) === 1) === isPractical);
                if (rows.length === 0) return null;
                return (
                  <div key={label}>
                    <h3 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-400">{label}</h3>
                    <div className="overflow-x-auto card-3d shadow-sm">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className={`border-b border-slate-200 ${hdrCls} text-left dark:border-slate-800`}>
                            <th className="px-4 py-2">Course</th>
                            <th className="px-4 py-2 text-center">Cr. Hrs</th>
                            <th className="px-4 py-2">Re-Mid Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr key={r.course_id} className="border-b border-slate-100 dark:border-slate-800">
                              <td className="px-4 py-2.5">
                                <div className="font-medium text-slate-800 dark:text-slate-100">{r.course_title}</div>
                                <div className="text-xs text-slate-400">{r.course_code}</div>
                              </td>
                              <td className="px-4 py-2.5 text-center">{r.credit_hours}</td>
                              <td className="px-4 py-2.5">
                                {r.paper_date ? (
                                  <span className="font-medium text-amber-700 dark:text-amber-400">
                                    {formatDateOnly(r.paper_date)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Not scheduled yet</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

          {tab === "datesheet" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Mid Exam Date Sheet</h2>
            <button
              onClick={loadDatesheet}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>
          {dsLoading ? (
            <DataFetchLoader label="Loading date sheet…" />
          ) : dsRows.length === 0 ? (
            <div className="card-3d p-8 text-center text-sm text-slate-400">
              No date sheet entries available yet. Check back later.
            </div>
          ) : (
            <div className="space-y-4">
              {[
                { label: "Date Sheet – Theory",    isPractical: false, hdrCls: "bg-slate-50 dark:bg-slate-800" },
                { label: "Date Sheet – Practical", isPractical: true,  hdrCls: "bg-green-50 dark:bg-green-500/5" },
              ].map(({ label, isPractical, hdrCls }) => {
                const rows = dsRows.filter((r) => (Number(r.credit_hours) === 1) === isPractical);
                if (rows.length === 0) return null;
                return (
                  <div key={label}>
                    <h3 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-400">{label}</h3>
                    <div className="overflow-x-auto card-3d shadow-sm">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className={`border-b border-slate-200 ${hdrCls} text-left dark:border-slate-800`}>
                            <th className="px-4 py-2">Course</th>
                            <th className="px-4 py-2 text-center">Cr. Hrs</th>
                            <th className="px-4 py-2">Paper Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr key={r.course_id} className="border-b border-slate-100 dark:border-slate-800">
                              <td className="px-4 py-2.5">
                                <div className="font-medium text-slate-800 dark:text-slate-100">{r.course_title}</div>
                                <div className="text-xs text-slate-400">{r.course_code}</div>
                              </td>
                              <td className="px-4 py-2.5 text-center">{r.credit_hours}</td>
                              <td className="px-4 py-2.5">
                                {r.paper_date ? (
                                  <span className="font-medium text-indigo-700 dark:text-indigo-400">
                                    {formatDateOnly(r.paper_date)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Not scheduled</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ATTENDANCE (simple daily view) ── */}
      {tab === "attendance" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Daily Attendance</h2>
          <div className="card-3d flex flex-wrap items-end gap-4 p-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">From</label>
              <input type="date" value={attFrom} onChange={(e) => setAttFrom(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">To</label>
              <input type="date" value={attTo} onChange={(e) => setAttTo(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <button onClick={loadSimpleAtt}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Filter
            </button>
          </div>

          {simpleAttLoading ? <DataFetchLoader label="Loading…" /> : !attSummary ? (
            <div className="card-3d p-8 text-center text-sm text-slate-400">No active semester found.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Presents", value: attSummary.presents, cls: "text-emerald-600 dark:text-emerald-400" },
                  { label: "Absents",  value: attSummary.absents,  cls: "text-red-600 dark:text-red-400" },
                  { label: "Leaves",   value: attSummary.leaves,   cls: "text-amber-600 dark:text-amber-400" },
                  { label: "Percentage", value: `${attSummary.percentage}%`, cls: "text-indigo-600 dark:text-indigo-400" },
                ].map((s) => (
                  <div key={s.label} className="card-3d card-hover p-5">
                    <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
                  </div>
                ))}
              </div>

              {attRecords.length > 0 && (
                <div className="card-3d overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead className="bg-slate-50/80 text-xs uppercase text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {attRecords.map((r, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2.5">{formatDateOnly(r.attendance_date)}</td>
                            <td className={`px-4 py-2.5 font-medium capitalize ${statusCls[r.status] ?? ""}`}>{r.status}</td>
                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{r.reason || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── NOTIFICATIONS ── */}
      {tab === "notifications" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Notifications</h2>
            <button onClick={markAllRead} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
              Mark all as read
            </button>
          </div>
          {notifLoading ? <DataFetchLoader label="Loading…" /> : notifications.length === 0 ? (
            <div className="card-3d p-8 text-center text-sm text-slate-400">No notifications yet.</div>
          ) : (
            notifications.map((n) => (
              <div key={n.id}
                className={`rounded-xl border p-4 transition-colors ${
                  n.is_read
                    ? "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/40"
                    : "border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-500/10"
                }`}>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-800 dark:text-slate-100">{n.title}</p>
                  {!n.is_read && (
                    <button
                      onClick={() => markRead(n.id)}
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

      {/* ── PROFILE ── */}
      {tab === "profile" && profile && (
        <div className="space-y-6">
          {/* ── Profile Picture ── */}
          <div className="card-3d p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">Profile Picture</h2>
            <div className="flex items-center gap-5">
              <div className="relative h-24 w-24 shrink-0">
                {profile.profile_image_url ? (
                  <img src={profile.profile_image_url} alt={profile.name}
                    className="h-24 w-24 rounded-full object-cover ring-2 ring-indigo-200 dark:ring-indigo-500/30" />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/10">
                    <User size={40} className="text-indigo-400" />
                  </div>
                )}
              </div>
              <div>
                <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
                  Upload a clear photo. JPEG or PNG, max 5 MB.
                </p>
                <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 ${uploadingPhoto ? "pointer-events-none opacity-50" : ""}`}>
                  {uploadingPhoto ? <ButtonLoader /> : <Camera size={15} />}
                  {uploadingPhoto ? "Uploading…" : "Change Photo"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    onChange={handlePhotoUpload} disabled={uploadingPhoto} />
                </label>
              </div>
            </div>
          </div>

          <div className="card-3d p-6">
            <h2 className="mb-5 text-base font-semibold text-slate-800 dark:text-slate-100">Personal Information</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {[
                { label: "Full Name",   value: profile.name },
                { label: "Father Name", value: profile.father_name || "—" },
                { label: "CNIC",        value: profile.cnic || "—" },
                { label: "Email",       value: profile.email || "—" },
                { label: "Department",  value: profile.department_name },
              ].map((f) => (
                <div key={f.label}>
                  <label className="mb-1 block text-xs font-medium uppercase text-slate-500">{f.label}</label>
                  <p className="text-sm text-slate-800 dark:text-slate-100">{f.value}</p>
                </div>
              ))}
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Contact</label>
                <input type="text" value={profileForm.contact}
                  onChange={(e) => setProfileForm((p) => ({ ...p, contact: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Address</label>
                <input type="text" value={profileForm.address}
                  onChange={(e) => setProfileForm((p) => ({ ...p, address: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={handleSaveProfile} disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {saving ? <ButtonLoader /> : <Save size={16} />} Save Profile
              </button>
            </div>
          </div>

          <div className="card-3d p-6">
            <h2 className="mb-5 text-base font-semibold text-slate-800 dark:text-slate-100">Change Password</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">Current Password</label>
                <input type="password" value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, current_password: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500">New Password</label>
                <input type="password" value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, new_password: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={handleChangePassword} disabled={saving}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SLIP BLOCK MODAL ── */}
      {slipBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="card-3d w-full max-w-md overflow-hidden">
            <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/10">
                  <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{slipBlock.title}</h3>
              </div>
              <button onClick={() => setSlipBlock(null)}
                className="ml-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-slate-600 dark:text-slate-400">{slipBlock.message}</p>
            </div>
            <div className="flex justify-end border-t border-slate-200 px-5 py-4 dark:border-slate-700">
              <button onClick={() => setSlipBlock(null)}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DETAILS MODAL ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="card-3d w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* modal header */}
            <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-700">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{modal.courseTitle}</h3>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{modal.teacherName} — Date-wise Attendance</p>
              </div>
              <button onClick={() => setModal(null)}
                className="ml-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                <X size={18} />
              </button>
            </div>

            {/* modal body */}
            <div className="flex-1 overflow-y-auto">
              {detailsLoading ? (
                <div className="p-8"><DataFetchLoader label="Loading records…" /></div>
              ) : details.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-400">
                  No attendance records found for this course.<br />
                  <span className="text-xs">Records appear only on days this course is scheduled in the timetable.</span>
                </p>
              ) : (
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {details.map((d, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-2.5">{formatDateOnly(d.attendance_date)}</td>
                        <td className={`px-4 py-2.5 font-medium capitalize ${statusCls[d.status] ?? ""}`}>{d.status}</td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{d.reason || "—"}</td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{d.call_remarks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
