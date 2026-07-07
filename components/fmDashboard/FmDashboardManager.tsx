"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Award, Building2, CalendarClock, ClipboardList, CreditCard,
  LayoutDashboard, School, UserCheck, UserCog, UsersRound, Wallet,
  ChevronDown, ChevronRight, Eye, Printer,
} from "lucide-react";
import toast from "react-hot-toast";
import { DataFetchLoader, TableLoader } from "@/components/ui/Loaders";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";
import StatusBadge from "@/components/ui/StatusBadge";
import Modal from "@/components/ui/Modal";
import ProfilePasswordForm from "@/components/ProfilePasswordForm";
import { formatDateOnly } from "@/lib/format";

// ─── interfaces ────────────────────────────────────────────────────────────────
interface Dept { id: string; name: string; hod_name: string | null; coordinator_name: string | null; status: string; }
interface Affiliation { id: string; university_name: string; mid_marks: number; sessional_marks: number; final_marks: number; practical_marks: number; status: string; }
interface ClassRow { id: string; class_name: string; session: string; type: string; total_semesters: number; department_id: string; department_name: string; university_name: string | null; status: string; }
interface TeacherRow { id: string; name: string; email: string; phone: string | null; type: string; department_id: string; department_name: string; status: string; }
interface SemesterMini { class_name: string; session: string; semester_number: number; term_type: string; department_id: string; status: string; }
interface AllocationRow { id: string; course_code: string; course_title: string; teacher_name: string; allocation_type: string; rate: string; is_combined: boolean; semesters: SemesterMini[]; }
interface TimetableRow { id: string; class_name: string; session: string; department_name: string; department_id: string; semester_number: number; term_type: string; shift: string; wef_date: string; updated_at: string; }
interface DayRow { id: string; day_name: string; }
interface PeriodRow { id: string; start_time: string; end_time: string; }
interface CellRow { id: string; day_id: string; period_id: string; allocation_id: string | null; course_code: string | null; course_title: string | null; teacher_name: string | null; is_combined: boolean | null; }
interface TimetableDetail { timetable: TimetableRow & { semester_status: string }; days: DayRow[]; periods: PeriodRow[]; cells: CellRow[]; }
interface AttRow { id: string; attendance_date: string; lecture_count: number; late_minutes: number; status: string; remarks: string | null; course_code: string; course_title: string; teacher_name: string; class_name: string; session: string; semester_number: number; department_name: string; }
interface BillItem { id: string; course_code: string; course_title: string; class_name: string; session: string; semester_number: number; allocation_type: string; total_lectures: number; rate: string; amount: string; }
interface BillRow { id: string; bill_number: string; bill_type: string; teacher_name: string; department_name: string; period_from: string | null; period_to: string | null; total_amount: string; status: "unpaid" | "paid"; paid_at: string | null; payment_mode: "bank_transfer" | "cheque" | null; cheque_number: string | null; created_at: string; items: BillItem[]; }
interface OverviewStats { departments: number; classes: number; teachers: number; students: number; active_students: number; unpaid_bills: number; paid_bills: number; }
interface RecentBill { bill_number: string; bill_type: string; total_amount: string; status: string; teacher_name: string; department_name: string; created_at: string; }

// ─── tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { id: "overview",    label: "Overview",            icon: LayoutDashboard },
  { id: "classes",     label: "Classes",             icon: School },
  { id: "faculties",   label: "Faculties",           icon: Building2 },
  { id: "teachers",    label: "Teachers",            icon: UsersRound },
  { id: "allocations", label: "Allocations",         icon: ClipboardList },
  { id: "timetables",  label: "Timetables",          icon: CalendarClock },
  { id: "attendance",  label: "Teacher Attendance",  icon: UserCheck },
  { id: "billing",     label: "Billing",             icon: Wallet },
  { id: "profile",     label: "Profile",             icon: UserCog },
] as const;
type TabId = (typeof TABS)[number]["id"];

// ─── helpers ───────────────────────────────────────────────────────────────────
function fmt(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${ap}`;
}
function fmtAmt(v: string | number) {
  return Number(v).toLocaleString("en-PK", { maximumFractionDigits: 0 });
}
function thCls() { return "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60"; }
function tdCls() { return "px-3 py-2 text-sm text-slate-800 dark:text-slate-200 border-t border-slate-200 dark:border-slate-700"; }

function StatCard({ label, value, gradient, icon: Icon }: { label: string; value: number; gradient: string; icon: React.ElementType }) {
  return (
    <div className="card-3d card-hover rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{value.toLocaleString()}</p>
        </div>
        <div className={`icon-tile ${gradient} h-11 w-11`}><Icon size={20} /></div>
      </div>
    </div>
  );
}

// ─── main component ────────────────────────────────────────────────────────────
export default function FmDashboardManager({ initialTab }: { initialTab?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>(() => {
    const valid = TABS.map((t) => t.id) as string[];
    return (valid.includes(initialTab ?? "") ? initialTab : "overview") as TabId;
  });

  // shared
  const [departments, setDepartments] = useState<Dept[]>([]);

  // overview
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [recentBills, setRecentBills] = useState<RecentBill[]>([]);

  // classes
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classDeptId, setClassDeptId] = useState("");

  // faculties
  const [affiliations, setAffiliations] = useState<Affiliation[]>([]);
  const [facSubTab, setFacSubTab] = useState<"departments" | "affiliations">("departments");

  // teachers
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [teacherDeptId, setTeacherDeptId] = useState("");

  // allocations
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [allocDeptId, setAllocDeptId] = useState("");
  const [allocLoading, setAllocLoading] = useState(false);

  // timetables
  const [timetables, setTimetables] = useState<TimetableRow[]>([]);
  const [ttDeptId, setTtDeptId] = useState("");
  const [viewingTt, setViewingTt] = useState<TimetableDetail | null>(null);
  const [ttLoading, setTtLoading] = useState(false);

  // attendance
  const [attRecords, setAttRecords] = useState<AttRow[]>([]);
  const [attDeptId, setAttDeptId] = useState("");
  const [attClassId, setAttClassId] = useState("");
  const [attTeacherId, setAttTeacherId] = useState("");
  const [attFrom, setAttFrom] = useState("");
  const [attTo, setAttTo] = useState("");
  const [attClasses, setAttClasses] = useState<ClassRow[]>([]);
  const [attTeachers, setAttTeachers] = useState<TeacherRow[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [attLoaded, setAttLoaded] = useState(false);

  // billing
  const [bills, setBills] = useState<BillRow[]>([]);
  const [billSubTab, setBillSubTab] = useState<"unpaid" | "paid">("unpaid");
  const [billDeptId, setBillDeptId] = useState("");
  const [billSession, setBillSession] = useState("");
  const [billTeacherId, setBillTeacherId] = useState("");
  const [billTeachers, setBillTeachers] = useState<TeacherRow[]>([]);
  const [billLoading, setBillLoading] = useState(false);
  const [markPayTarget, setMarkPayTarget] = useState<BillRow | null>(null);
  const [markPayMode, setMarkPayMode] = useState<"" | "bank_transfer" | "cheque">("");
  const [markPayCheque, setMarkPayCheque] = useState("");
  const [markingPaid, setMarkingPaid] = useState(false);
  const [viewBill, setViewBill] = useState<BillRow | null>(null);

  // generic loading
  const [loading, setLoading] = useState(false);

  function goTab(t: TabId) {
    setTab(t);
    router.replace(`/dashboard/finance_manager?tab=${t}`, { scroll: false });
  }

  // load shared departments
  useEffect(() => {
    fetch("/api/admin/departments")
      .then((r) => r.json())
      .then((d) => setDepartments(d.departments ?? []))
      .catch(() => {});
  }, []);

  // ── overview ──
  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/finance_manager/overview");
      const d = await r.json();
      setOverviewStats(d.stats);
      setRecentBills(d.recentBills ?? []);
    } catch { toast.error("Failed to load overview."); } finally { setLoading(false); }
  }, []);

  // ── classes ──
  const loadClasses = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (classDeptId) p.set("department_id", classDeptId);
      const r = await fetch(`/api/admin/classes?${p}`);
      const d = await r.json();
      setClasses(d.classes ?? []);
    } catch { toast.error("Failed to load classes."); } finally { setLoading(false); }
  }, [classDeptId]);

  // ── affiliations ──
  const loadAffiliations = useCallback(async () => {
    if (affiliations.length) return;
    setLoading(true);
    try {
      const r = await fetch("/api/admin/affiliations");
      const d = await r.json();
      setAffiliations(d.affiliations ?? []);
    } catch { toast.error("Failed to load affiliations."); } finally { setLoading(false); }
  }, [affiliations.length]);

  // ── teachers ──
  const loadTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (teacherDeptId) p.set("department_id", teacherDeptId);
      const r = await fetch(`/api/admin/teachers?${p}`);
      const d = await r.json();
      setTeachers(d.teachers ?? []);
    } catch { toast.error("Failed to load teachers."); } finally { setLoading(false); }
  }, [teacherDeptId]);

  // ── allocations ──
  const loadAllocations = useCallback(async () => {
    setAllocLoading(true);
    try {
      const r = await fetch("/api/admin/allocations");
      const d = await r.json();
      setAllocations(d.allocations ?? []);
    } catch { toast.error("Failed to load allocations."); } finally { setAllocLoading(false); }
  }, []);

  // ── timetables ──
  const loadTimetables = useCallback(async () => {
    if (timetables.length) return;
    setTtLoading(true);
    try {
      const r = await fetch("/api/admin/timetables");
      const d = await r.json();
      setTimetables(d.timetables ?? []);
    } catch { toast.error("Failed to load timetables."); } finally { setTtLoading(false); }
  }, [timetables.length]);

  async function viewTimetable(id: string) {
    setViewingTt(null);
    setTtLoading(true);
    try {
      const r = await fetch(`/api/admin/timetables/${id}`);
      const d = await r.json();
      setViewingTt(d);
    } catch { toast.error("Failed to load timetable."); } finally { setTtLoading(false); }
  }

  // ── attendance ──
  useEffect(() => {
    if (attDeptId) {
      fetch(`/api/admin/classes?department_id=${attDeptId}`)
        .then((r) => r.json())
        .then((d) => setAttClasses(d.classes ?? []))
        .catch(() => {});
      fetch(`/api/admin/teachers?department_id=${attDeptId}`)
        .then((r) => r.json())
        .then((d) => setAttTeachers(d.teachers ?? []))
        .catch(() => {});
      setAttClassId("");
      setAttTeacherId("");
    } else {
      setAttClasses([]);
      setAttTeachers([]);
    }
  }, [attDeptId]);

  const loadAttendance = useCallback(async () => {
    setAttLoading(true);
    setAttLoaded(true);
    try {
      const p = new URLSearchParams();
      if (attDeptId) p.set("department_id", attDeptId);
      if (attClassId) p.set("class_id", attClassId);
      if (attTeacherId) p.set("teacher_id", attTeacherId);
      if (attFrom) p.set("from", attFrom);
      if (attTo) p.set("to", attTo);
      const r = await fetch(`/api/admin/attendance/report?${p}`);
      const d = await r.json();
      setAttRecords(d.records ?? []);
    } catch { toast.error("Failed to load attendance."); } finally { setAttLoading(false); }
  }, [attDeptId, attClassId, attTeacherId, attFrom, attTo]);

  // ── billing ──
  useEffect(() => {
    if (tab === "billing") {
      fetch("/api/admin/teachers")
        .then((r) => r.json())
        .then((d) => setBillTeachers(d.teachers ?? []))
        .catch(() => {});
    }
  }, [tab]);

  const loadBills = useCallback(async () => {
    setBillLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("status", billSubTab);
      if (billDeptId) p.set("department_id", billDeptId);
      if (billSession) p.set("session", billSession);
      if (billTeacherId) p.set("teacher_id", billTeacherId);
      const r = await fetch(`/api/admin/bills?${p}`);
      const d = await r.json();
      setBills(d.bills ?? []);
    } catch { toast.error("Failed to load bills."); } finally { setBillLoading(false); }
  }, [billSubTab, billDeptId, billSession, billTeacherId]);

  // tab init loads
  useEffect(() => {
    if (tab === "overview") loadOverview();
    if (tab === "classes") loadClasses();
    if (tab === "faculties") { loadAffiliations(); }
    if (tab === "teachers") loadTeachers();
    if (tab === "allocations") loadAllocations();
    if (tab === "timetables") loadTimetables();
    if (tab === "billing") loadBills();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => { if (tab === "classes") loadClasses(); }, [classDeptId, tab, loadClasses]);
  useEffect(() => { if (tab === "teachers") loadTeachers(); }, [teacherDeptId, tab, loadTeachers]);
  useEffect(() => { if (tab === "billing") loadBills(); }, [billSubTab, tab, loadBills]);

  // ── mark paid ──
  async function submitMarkPaid() {
    if (!markPayTarget) return;
    if (!markPayMode) { toast.error("Choose a payment mode."); return; }
    if (markPayMode === "cheque" && !/^\d{6}$/.test(markPayCheque.trim())) {
      toast.error("Enter the last 6 digits of the cheque number."); return;
    }
    setMarkingPaid(true);
    try {
      const r = await fetch(`/api/admin/bills/${markPayTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "paid",
          payment_mode: markPayMode,
          cheque_number: markPayMode === "cheque" ? markPayCheque.trim() : null,
        }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || "Failed."); return; }
      toast.success("Bill marked as paid.");
      setMarkPayTarget(null);
      setMarkPayMode("");
      setMarkPayCheque("");
      loadBills();
    } catch { toast.error("Something went wrong."); } finally { setMarkingPaid(false); }
  }

  async function markUnpaid(bill: BillRow) {
    if (!confirm(`Mark bill ${bill.bill_number} as unpaid?`)) return;
    const r = await fetch(`/api/admin/bills/${bill.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "unpaid" }),
    });
    const d = await r.json();
    if (!r.ok) { toast.error(d.error || "Failed."); return; }
    toast.success("Bill marked as unpaid.");
    loadBills();
  }

  const deptOpts: SelectOption[] = departments.map((d) => ({ value: d.id, label: d.name }));

  // ── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="card-3d rounded-2xl p-1.5 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => goTab(id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                tab === id
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW ──────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-5">
          {loading && !overviewStats ? (
            <DataFetchLoader message="Loading overview…" />
          ) : overviewStats ? (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Departments" value={overviewStats.departments} gradient="grad-cyan" icon={Building2} />
                <StatCard label="Classes" value={overviewStats.classes} gradient="grad-primary" icon={School} />
                <StatCard label="Teachers" value={overviewStats.teachers} gradient="grad-primary" icon={UsersRound} />
                <StatCard label="Total Students" value={overviewStats.students} gradient="grad-emerald" icon={Award} />
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
                <StatCard label="Unpaid Bills" value={overviewStats.unpaid_bills} gradient="grad-cyan" icon={Wallet} />
                <StatCard label="Paid Bills" value={overviewStats.paid_bills} gradient="grad-emerald" icon={CreditCard} />
              </div>
              {recentBills.length > 0 && (
                <div className="card-3d rounded-2xl p-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Recent Bills</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr>
                          {["Bill #","Type","Teacher","Department","Amount","Status"].map((h) => (
                            <th key={h} className={thCls()}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recentBills.map((b, i) => (
                          <tr key={i}>
                            <td className={tdCls()}>{b.bill_number}</td>
                            <td className={tdCls()}><span className="capitalize">{b.bill_type}</span></td>
                            <td className={tdCls()}>{b.teacher_name}</td>
                            <td className={tdCls()}>{b.department_name}</td>
                            <td className={tdCls()}>Rs {fmtAmt(b.total_amount)}</td>
                            <td className={tdCls()}><StatusBadge status={b.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* ── CLASSES ───────────────────────────────────────────── */}
      {tab === "classes" && (
        <div className="card-3d rounded-2xl p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Classes</h2>
            <div className="w-full sm:w-56">
              <SearchableSelect
                options={deptOpts}
                value={deptOpts.find((d) => d.value === classDeptId) ?? null}
                onChange={(o) => setClassDeptId(o ? (o as SelectOption).value : "")}
                placeholder="All Departments"
                isClearable
              />
            </div>
          </div>
          {loading ? <TableLoader colSpan={6} /> : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead><tr>{["Class","Session","Type","Semesters","Department","University"].map((h) => <th key={h} className={thCls()}>{h}</th>)}</tr></thead>
                <tbody>
                  {classes.length === 0 ? (
                    <tr><td colSpan={6} className={`${tdCls()} text-center text-slate-400`}>No classes found.</td></tr>
                  ) : classes.map((c) => (
                    <tr key={c.id}>
                      <td className={tdCls()}><span className="font-medium">{c.class_name}</span></td>
                      <td className={tdCls()}>{c.session}</td>
                      <td className={tdCls()}>{c.type}</td>
                      <td className={tdCls()}>{c.total_semesters}</td>
                      <td className={tdCls()}>{c.department_name}</td>
                      <td className={tdCls()}>{c.university_name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── FACULTIES ─────────────────────────────────────────── */}
      {tab === "faculties" && (
        <div className="card-3d rounded-2xl p-4 space-y-4">
          <div className="flex gap-2">
            {(["departments","affiliations"] as const).map((st) => (
              <button key={st} onClick={() => setFacSubTab(st)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${facSubTab === st ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"}`}>
                {st}
              </button>
            ))}
          </div>
          {loading ? <TableLoader colSpan={4} /> : facSubTab === "departments" ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead><tr>{["Department","HoD","Coordinator","Status"].map((h) => <th key={h} className={thCls()}>{h}</th>)}</tr></thead>
                <tbody>
                  {departments.length === 0 ? (
                    <tr><td colSpan={4} className={`${tdCls()} text-center text-slate-400`}>No departments found.</td></tr>
                  ) : departments.map((d) => (
                    <tr key={d.id}>
                      <td className={tdCls()}><span className="font-medium">{d.name}</span></td>
                      <td className={tdCls()}>{d.hod_name ?? "—"}</td>
                      <td className={tdCls()}>{d.coordinator_name ?? "—"}</td>
                      <td className={tdCls()}><StatusBadge status={d.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead><tr>{["University","Mid","Sessional","Final","Practical","Status"].map((h) => <th key={h} className={thCls()}>{h}</th>)}</tr></thead>
                <tbody>
                  {affiliations.length === 0 ? (
                    <tr><td colSpan={6} className={`${tdCls()} text-center text-slate-400`}>No affiliations found.</td></tr>
                  ) : affiliations.map((a) => (
                    <tr key={a.id}>
                      <td className={tdCls()}><span className="font-medium">{a.university_name}</span></td>
                      <td className={tdCls()}>{a.mid_marks}</td>
                      <td className={tdCls()}>{a.sessional_marks}</td>
                      <td className={tdCls()}>{a.final_marks}</td>
                      <td className={tdCls()}>{a.practical_marks}</td>
                      <td className={tdCls()}><StatusBadge status={a.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TEACHERS ──────────────────────────────────────────── */}
      {tab === "teachers" && (
        <div className="card-3d rounded-2xl p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Teachers</h2>
            <div className="w-full sm:w-56">
              <SearchableSelect
                options={deptOpts}
                value={deptOpts.find((d) => d.value === teacherDeptId) ?? null}
                onChange={(o) => setTeacherDeptId(o ? (o as SelectOption).value : "")}
                placeholder="All Departments"
                isClearable
              />
            </div>
          </div>
          {loading ? <TableLoader colSpan={5} /> : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead><tr>{["Name","Employee Type","Department","Email","Status"].map((h) => <th key={h} className={thCls()}>{h}</th>)}</tr></thead>
                <tbody>
                  {teachers.length === 0 ? (
                    <tr><td colSpan={5} className={`${tdCls()} text-center text-slate-400`}>No teachers found.</td></tr>
                  ) : teachers.map((t) => (
                    <tr key={t.id}>
                      <td className={tdCls()}><span className="font-medium">{t.name}</span></td>
                      <td className={tdCls()}><span className="capitalize">{t.type}</span></td>
                      <td className={tdCls()}>{t.department_name}</td>
                      <td className={tdCls()}>{t.email}</td>
                      <td className={tdCls()}><StatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ALLOCATIONS ───────────────────────────────────────── */}
      {tab === "allocations" && (
        <div className="card-3d rounded-2xl p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Allocations <span className="text-xs text-slate-400 font-normal">(read-only)</span></h2>
            <div className="w-full sm:w-56">
              <SearchableSelect
                options={deptOpts}
                value={deptOpts.find((d) => d.value === allocDeptId) ?? null}
                onChange={(o) => setAllocDeptId(o ? (o as SelectOption).value : "")}
                placeholder="All Departments"
                isClearable
              />
            </div>
          </div>
          {allocLoading ? <TableLoader colSpan={6} /> : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead><tr>{["Course","Teacher","Classes","Type","Rate","Combined"].map((h) => <th key={h} className={thCls()}>{h}</th>)}</tr></thead>
                <tbody>
                  {(allocDeptId ? allocations.filter((a) => a.semesters.some((s) => s.department_id === allocDeptId)) : allocations).length === 0 ? (
                    <tr><td colSpan={6} className={`${tdCls()} text-center text-slate-400`}>No allocations found.</td></tr>
                  ) : (allocDeptId ? allocations.filter((a) => a.semesters.some((s) => s.department_id === allocDeptId)) : allocations).map((a) => (
                    <tr key={a.id}>
                      <td className={tdCls()}>
                        <div className="font-medium">{a.course_code}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{a.course_title}</div>
                      </td>
                      <td className={tdCls()}>{a.teacher_name}</td>
                      <td className={tdCls()}>
                        {a.semesters.map((s, i) => (
                          <div key={i} className="text-xs">{s.class_name} {s.session} (Sem {s.semester_number})</div>
                        ))}
                      </td>
                      <td className={tdCls()}><span className="capitalize text-xs">{a.allocation_type.replace(/_/g," ")}</span></td>
                      <td className={tdCls()}>Rs {fmtAmt(a.rate)}</td>
                      <td className={tdCls()}>{a.is_combined ? <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">Yes</span> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TIMETABLES ────────────────────────────────────────── */}
      {tab === "timetables" && (
        <div className="space-y-4">
          <div className="card-3d rounded-2xl p-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Timetables <span className="text-xs text-slate-400 font-normal">(read-only)</span></h2>
              <div className="w-full sm:w-56">
                <SearchableSelect
                  options={deptOpts}
                  value={deptOpts.find((d) => d.value === ttDeptId) ?? null}
                  onChange={(o) => { setTtDeptId(o ? (o as SelectOption).value : ""); setViewingTt(null); }}
                  placeholder="All Departments"
                  isClearable
                />
              </div>
            </div>
            {ttLoading && !viewingTt ? <TableLoader colSpan={5} /> : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead><tr>{["Class","Session","Semester","Department","Shift",""].map((h) => <th key={h} className={thCls()}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(ttDeptId ? timetables.filter((t) => t.department_id === ttDeptId) : timetables).length === 0 ? (
                      <tr><td colSpan={6} className={`${tdCls()} text-center text-slate-400`}>No timetables found.</td></tr>
                    ) : (ttDeptId ? timetables.filter((t) => t.department_id === ttDeptId) : timetables).map((t) => (
                      <tr key={t.id} className={viewingTt?.timetable.id === t.id ? "bg-indigo-50/50 dark:bg-indigo-500/10" : ""}>
                        <td className={tdCls()}><span className="font-medium">{t.class_name}</span></td>
                        <td className={tdCls()}>{t.session}</td>
                        <td className={tdCls()}>Sem {t.semester_number} ({t.term_type})</td>
                        <td className={tdCls()}>{t.department_name}</td>
                        <td className={tdCls()}><span className="capitalize">{t.shift}</span></td>
                        <td className={tdCls()}>
                          <button
                            onClick={() => viewingTt?.timetable.id === t.id ? setViewingTt(null) : viewTimetable(t.id)}
                            className="flex items-center gap-1 rounded-lg bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500/30"
                          >
                            {viewingTt?.timetable.id === t.id ? <><ChevronDown size={12} /> Close</> : <><Eye size={12} /> View</>}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* timetable grid */}
          {viewingTt && (
            <div className="card-3d rounded-2xl p-4 space-y-3 print:block">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {viewingTt.timetable.class_name} — {viewingTt.timetable.session} — Sem {viewingTt.timetable.semester_number} ({viewingTt.timetable.term_type})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{viewingTt.timetable.shift} shift · w.e.f. {formatDateOnly(viewingTt.timetable.wef_date)}</p>
                </div>
                <button onClick={() => window.print()} className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                  <Printer size={13} /> Print
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-300 dark:border-slate-600 text-xs">
                  <thead className="bg-indigo-600 text-white">
                    <tr>
                      <th className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-left">Day</th>
                      {viewingTt.periods.map((p) => (
                        <th key={p.id} className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center whitespace-nowrap">
                          {fmt(p.start_time)}<br /><span className="font-normal opacity-80">{fmt(p.end_time)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {viewingTt.days.map((day) => (
                      <tr key={day.id} className="even:bg-slate-50 dark:even:bg-slate-800/30">
                        <td className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{day.day_name}</td>
                        {viewingTt.periods.map((period) => {
                          const cell = viewingTt.cells.find((c) => c.day_id === day.id && c.period_id === period.id);
                          return (
                            <td key={period.id} className="border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-center align-middle min-w-[100px]">
                              {cell?.course_title ? (
                                <div>
                                  <div className="font-semibold text-indigo-700 dark:text-indigo-300 text-[10px]">{cell.course_code}</div>
                                  <div className="text-[10px] text-slate-700 dark:text-slate-300 leading-tight">{cell.course_title}</div>
                                  <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">{cell.teacher_name}</div>
                                </div>
                              ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TEACHER ATTENDANCE ────────────────────────────────── */}
      {tab === "attendance" && (
        <div className="card-3d rounded-2xl p-4 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Teacher Attendance Report <span className="text-xs text-slate-400 font-normal">(read-only)</span></h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SearchableSelect
              options={deptOpts}
              value={deptOpts.find((d) => d.value === attDeptId) ?? null}
              onChange={(o) => setAttDeptId(o ? (o as SelectOption).value : "")}
              placeholder="Department"
              isClearable
            />
            <SearchableSelect
              options={attClasses.map((c) => ({ value: c.id, label: `${c.class_name} (${c.session})` }))}
              value={attClasses.find((c) => c.id === attClassId) ? { value: attClassId, label: `${attClasses.find((c) => c.id === attClassId)?.class_name} (${attClasses.find((c) => c.id === attClassId)?.session})` } : null}
              onChange={(o) => setAttClassId(o ? (o as SelectOption).value : "")}
              placeholder="Class"
              isClearable
              isDisabled={!attDeptId}
            />
            <SearchableSelect
              options={attTeachers.map((t) => ({ value: t.id, label: t.name }))}
              value={attTeachers.find((t) => t.id === attTeacherId) ? { value: attTeacherId, label: attTeachers.find((t) => t.id === attTeacherId)?.name ?? "" } : null}
              onChange={(o) => setAttTeacherId(o ? (o as SelectOption).value : "")}
              placeholder="Teacher"
              isClearable
              isDisabled={!attDeptId}
            />
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">From</label>
              <input type="date" value={attFrom} onChange={(e) => setAttFrom(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">To</label>
              <input type="date" value={attTo} onChange={(e) => setAttTo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            </div>
            <div className="flex items-end">
              <button onClick={loadAttendance}
                className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition">
                Search
              </button>
            </div>
          </div>
          {attLoading ? <TableLoader colSpan={7} /> : attLoaded ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead><tr>{["Date","Course","Teacher","Class","Lectures","Late (min)","Status"].map((h) => <th key={h} className={thCls()}>{h}</th>)}</tr></thead>
                <tbody>
                  {attRecords.length === 0 ? (
                    <tr><td colSpan={7} className={`${tdCls()} text-center text-slate-400`}>No attendance records found.</td></tr>
                  ) : attRecords.map((r) => (
                    <tr key={r.id}>
                      <td className={tdCls()}>{formatDateOnly(r.attendance_date)}</td>
                      <td className={tdCls()}>
                        <div className="font-medium">{r.course_code}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{r.course_title}</div>
                      </td>
                      <td className={tdCls()}>{r.teacher_name}</td>
                      <td className={tdCls()}>{r.class_name} ({r.session})</td>
                      <td className={tdCls()}>{r.lecture_count}</td>
                      <td className={tdCls()}>{r.late_minutes || "—"}</td>
                      <td className={tdCls()}><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-center text-slate-400 py-6">Select filters and click Search.</p>
          )}
        </div>
      )}

      {/* ── BILLING (Find tab only) ────────────────────────────── */}
      {tab === "billing" && (
        <div className="card-3d rounded-2xl p-4 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Billing — Find Bill</h2>

          {/* sub-tabs */}
          <div className="flex gap-2">
            {(["unpaid","paid"] as const).map((st) => (
              <button key={st} onClick={() => setBillSubTab(st)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${billSubTab === st ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"}`}>
                {st}
              </button>
            ))}
          </div>

          {/* filters */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SearchableSelect
              options={deptOpts}
              value={deptOpts.find((d) => d.value === billDeptId) ?? null}
              onChange={(o) => setBillDeptId(o ? (o as SelectOption).value : "")}
              placeholder="All Departments"
              isClearable
            />
            <input type="text" placeholder="Session (e.g. 2024-2025)" value={billSession}
              onChange={(e) => setBillSession(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            <SearchableSelect
              options={billTeachers.map((t) => ({ value: t.id, label: t.name }))}
              value={billTeachers.find((t) => t.id === billTeacherId) ? { value: billTeacherId, label: billTeachers.find((t) => t.id === billTeacherId)?.name ?? "" } : null}
              onChange={(o) => setBillTeacherId(o ? (o as SelectOption).value : "")}
              placeholder="All Teachers"
              isClearable
            />
          </div>
          <button onClick={loadBills}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition">
            Search Bills
          </button>

          {/* bills table */}
          {billLoading ? <TableLoader colSpan={7} /> : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr>
                    {["Bill #","Type","Teacher","Department","Period","Amount","Status","Actions"].map((h) => (
                      <th key={h} className={thCls()}>{h}</th>
                    ))}
                    {billSubTab === "paid" && <th className={thCls()}>Paid On</th>}
                  </tr>
                </thead>
                <tbody>
                  {bills.length === 0 ? (
                    <tr><td colSpan={billSubTab === "paid" ? 9 : 8} className={`${tdCls()} text-center text-slate-400`}>No {billSubTab} bills found.</td></tr>
                  ) : bills.map((b) => (
                    <tr key={b.id}>
                      <td className={tdCls()}><span className="font-mono font-semibold text-indigo-700 dark:text-indigo-300">{b.bill_number}</span></td>
                      <td className={tdCls()}><span className="capitalize">{b.bill_type}</span></td>
                      <td className={tdCls()}>{b.teacher_name}</td>
                      <td className={tdCls()}>{b.department_name}</td>
                      <td className={tdCls()} style={{ whiteSpace: "nowrap" }}>
                        {b.period_from ? `${formatDateOnly(b.period_from)} – ${formatDateOnly(b.period_to ?? "")}` : "—"}
                      </td>
                      <td className={tdCls()}>Rs {fmtAmt(b.total_amount)}</td>
                      <td className={tdCls()}><StatusBadge status={b.status} /></td>
                      <td className={tdCls()}>
                        <div className="flex gap-1 flex-wrap">
                          <button onClick={() => setViewBill(b)}
                            className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                            <ChevronRight size={11} /> View
                          </button>
                          {billSubTab === "unpaid" && (
                            <button onClick={() => { setMarkPayTarget(b); setMarkPayMode(""); setMarkPayCheque(""); }}
                              className="flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300">
                              Mark Paid
                            </button>
                          )}
                          {billSubTab === "paid" && (
                            <button onClick={() => markUnpaid(b)}
                              className="flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-700 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-300">
                              Mark Unpaid
                            </button>
                          )}
                        </div>
                      </td>
                      {billSubTab === "paid" && (
                        <td className={tdCls()}>
                          <div>{formatDateOnly(b.paid_at)}</div>
                          <div className="text-xs text-slate-400 capitalize">{b.payment_mode?.replace("_"," ") ?? ""}</div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── PROFILE ───────────────────────────────────────────── */}
      {tab === "profile" && (
        <div className="max-w-lg">
          <ProfilePasswordForm />
        </div>
      )}

      {/* ── MARK PAID MODAL ───────────────────────────────────── */}
      <Modal open={!!markPayTarget} onClose={() => setMarkPayTarget(null)} title={`Mark Paid — ${markPayTarget?.bill_number}`}>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Select payment mode:</p>
            <div className="flex gap-3">
              {[{ v: "bank_transfer", l: "Bank Transfer" }, { v: "cheque", l: "Cheque" }].map(({ v, l }) => (
                <button key={v} onClick={() => setMarkPayMode(v as "bank_transfer" | "cheque")}
                  className={`flex-1 rounded-xl border-2 py-2.5 text-sm font-medium transition ${markPayMode === v ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500" : "border-slate-200 text-slate-700 hover:border-slate-400 dark:border-slate-600 dark:text-slate-200"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {markPayMode === "cheque" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Last 6 digits of cheque number</label>
              <input type="text" maxLength={6} value={markPayCheque} onChange={(e) => setMarkPayCheque(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 123456"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setMarkPayTarget(null)}
              className="flex-1 rounded-xl border border-slate-200 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
              Cancel
            </button>
            <button onClick={submitMarkPaid} disabled={markingPaid}
              className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
              {markingPaid ? "Saving…" : "Confirm Paid"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── VIEW BILL DETAIL MODAL ────────────────────────────── */}
      <Modal open={!!viewBill} onClose={() => setViewBill(null)} title={`Bill Detail — ${viewBill?.bill_number}`}>
        {viewBill && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["Teacher", viewBill.teacher_name],
                ["Department", viewBill.department_name],
                ["Type", viewBill.bill_type],
                ["Status", viewBill.status],
                ["Period", viewBill.period_from ? `${formatDateOnly(viewBill.period_from)} – ${formatDateOnly(viewBill.period_to ?? "")}` : "—"],
                ["Total Amount", `Rs ${fmtAmt(viewBill.total_amount)}`],
              ].map(([k, v]) => (
                <div key={k}>
                  <span className="text-slate-500 dark:text-slate-400">{k}: </span>
                  <span className="font-medium capitalize">{v}</span>
                </div>
              ))}
            </div>
            {viewBill.items?.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>{["Course","Class","Sem","Type","Lectures","Rate","Amount"].map((h) => <th key={h} className={thCls()}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {viewBill.items.map((it) => (
                      <tr key={it.id}>
                        <td className={tdCls()}>{it.course_code} — {it.course_title}</td>
                        <td className={tdCls()}>{it.class_name} ({it.session})</td>
                        <td className={tdCls()}>{it.semester_number}</td>
                        <td className={tdCls()} style={{ whiteSpace: "nowrap" }}>{it.allocation_type.replace(/_/g," ")}</td>
                        <td className={tdCls()}>{it.total_lectures}</td>
                        <td className={tdCls()}>Rs {fmtAmt(it.rate)}</td>
                        <td className={tdCls()}>Rs {fmtAmt(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
