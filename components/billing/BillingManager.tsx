"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Banknote, CheckCircle2, FileDown, Trash2, Wallet } from "lucide-react";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { formatDateOnly } from "@/lib/format";
import { TableLoader, ButtonLoader } from "@/components/ui/Loaders";
import { useUserRole } from "@/lib/roleContext";

interface TeacherOption {
  id: string;
  name: string;
  department_id: string;
  type: "permanent" | "visiting";
}

interface AttendanceRow {
  attendance_date: string;
  lecture_count: string;
  late_minutes: number;
  status: string;
}

interface BillItem {
  id: string;
  course_code: string | null;
  course_title: string | null;
  class_name: string | null;
  session: string | null;
  semester_number: number | null;
  allocation_type: string;
  total_lectures: string;
  rate: string;
  amount: string;
  attendance?: AttendanceRow[];
}

interface VisitingBillPrintItem {
  course_code: string;
  course_title: string;
  class_name: string;
  session: string;
  semester_number: number | null;
  teacher_name: string;
  allocation_type: string;
  total_lectures: string;
  rate: string;
  amount: string;
  attendance: AttendanceRow[];
}

interface ClassOption {
  id: string;
  class_name: string;
  session: string;
  department_id: string;
}

interface Bill {
  id: string;
  bill_number: string;
  bill_type: "visiting" | "permanent";
  teacher_name: string;
  department_name: string;
  billing_month: string | null;
  period_from: string | null;
  period_to: string | null;
  total_amount: string;
  status: "unpaid" | "paid";
  paid_at: string | null;
  payment_mode: "bank_transfer" | "cheque" | null;
  cheque_number: string | null;
  created_at: string;
  items: BillItem[];
}

interface VisitingPreviewItem {
  allocation_id: string;
  allocation_type: string;
  rate: string;
  course_code: string;
  course_title: string;
  teacher_id: string;
  teacher_name: string;
  classes: string[];
  total_lectures: string;
  amount: number;
}

interface PermanentPreviewItem {
  allocation_id: string;
  underlying_type: string;
  underlying_rate: string;
  course_id: string;
  course_code: string;
  course_title: string;
  classes: string[];
  total_lectures: string;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

interface AttendanceAppendixItem {
  course_code: string;
  course_title: string;
  class_name: string;
  session: string;
  teacher_name: string;
  attendance: AttendanceRow[];
}

function BillAttendanceAppendix({ items }: { items: AttendanceAppendixItem[] }) {
  return (
    <>
      <div className="print-page-break-before" />
      {items.map((it, idx) => (
        <div key={idx} className={idx > 0 ? "print-page-break-before" : ""}>
          <div className="mb-3 rounded-lg border-2 border-indigo-600 bg-gradient-to-r from-indigo-600 to-sky-500 p-3 text-white">
            <h3 className="text-base font-bold">Attendance Record</h3>
            <p className="text-sm">
              <strong>Course:</strong> {it.course_code} — {it.course_title}
            </p>
            <p className="text-sm">
              <strong>Class:</strong> {it.class_name} &nbsp; <strong>Session:</strong> {it.session}{" "}
              &nbsp; <strong>Teacher:</strong> {it.teacher_name}
            </p>
          </div>
          <table className="w-full border-collapse text-left text-[11px]">
            <thead className="bg-indigo-600 text-white">
              <tr>
                <th className="border border-indigo-400 px-1.5 py-0.5">Date</th>
                <th className="border border-indigo-400 px-1.5 py-0.5">Lecture #</th>
                <th className="border border-indigo-400 px-1.5 py-0.5">Lectures</th>
                <th className="border border-indigo-400 px-1.5 py-0.5">Late (min)</th>
                <th className="border border-indigo-400 px-1.5 py-0.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {it.attendance.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="border border-indigo-200 px-1.5 py-2 text-center text-slate-500"
                  >
                    No attendance records.
                  </td>
                </tr>
              ) : (
                it.attendance.map((a, ai) => (
                  <tr key={ai} className={ai % 2 === 0 ? "bg-indigo-50/60" : "bg-white"}>
                    <td className="border border-indigo-200 px-1.5 py-0.5">
                      {formatDateOnly(a.attendance_date)}
                    </td>
                    <td className="border border-indigo-200 px-1.5 py-0.5">{ai + 1}</td>
                    <td className="border border-indigo-200 px-1.5 py-0.5 text-slate-800">
                      {a.lecture_count}
                    </td>
                    <td className="border border-indigo-200 px-1.5 py-0.5 text-slate-800">
                      {a.late_minutes}
                    </td>
                    <td className="border border-indigo-200 px-1.5 py-0.5 capitalize text-slate-800">
                      {a.status}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

function VisitingBillDocument({
  items,
  docTitle,
  billNumbersLabel,
  dateLabel,
}: {
  items: VisitingBillPrintItem[];
  docTitle: string;
  billNumbersLabel: string;
  dateLabel: string;
}) {
  const sessionsLabel = Array.from(
    new Set(items.map((it) => `${it.class_name} (${it.session}) Sem ${it.semester_number ?? "-"}`)),
  ).join(",");
  const total = items.reduce((sum, it) => sum + Number(it.amount), 0);
  return (
    <>
      <div className="mb-4 rounded-lg border-2 border-indigo-600 bg-gradient-to-r from-indigo-600 to-sky-500 p-4 text-center text-white">
        <h2 className="text-xl font-extrabold tracking-wide">City College (University Campus)</h2>
        <p className="text-sm font-semibold">{docTitle}</p>
      </div>
      <div className="mb-4 grid grid-cols-1 gap-1 text-sm sm:grid-cols-3">
        <div>
          <strong>Bill No(s):</strong> {billNumbersLabel}
        </div>
        <div>
          <strong>Sessions Included In Bill:</strong> {sessionsLabel}
        </div>
        <div>
          <strong>Date:</strong> {dateLabel}
        </div>
      </div>
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-indigo-600 text-white">
          <tr>
            <th className="border border-indigo-400 px-3 py-2">Teacher</th>
            <th className="border border-indigo-400 px-3 py-2">Course</th>
            <th className="border border-indigo-400 px-3 py-2">Class</th>
            <th className="border border-indigo-400 px-3 py-2">Type</th>
            <th className="border border-indigo-400 px-3 py-2">Lectures</th>
            <th className="border border-indigo-400 px-3 py-2">Rate</th>
            <th className="border border-indigo-400 px-3 py-2">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td className="border border-indigo-200 px-3 py-2">{it.teacher_name}</td>
              <td className="border border-indigo-200 px-3 py-2">
                {it.course_code} — {it.course_title}
              </td>
              <td className="border border-indigo-200 px-3 py-2">
                {it.class_name} ({it.session}) Sem {it.semester_number ?? "-"}
              </td>
              <td className="border border-indigo-200 px-3 py-2">
                {allocTypeLabel[it.allocation_type]}
              </td>
              <td className="border border-indigo-200 px-3 py-2">{it.total_lectures}</td>
              <td className="border border-indigo-200 px-3 py-2">{it.rate}</td>
              <td className="border border-indigo-200 px-3 py-2">
                {Number(it.amount).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-right text-base font-bold">
        Total Amount: PKR {total.toLocaleString()}
      </p>

      <BillAttendanceAppendix
        items={items.map((it) => ({
          course_code: it.course_code,
          course_title: it.course_title,
          class_name: it.class_name,
          session: it.session,
          teacher_name: it.teacher_name,
          attendance: it.attendance,
        }))}
      />
    </>
  );
}

const allocTypeLabel: Record<string, string> = {
  workload: "Workload",
  per_credit_hour: "Per Credit Hour",
  fixed: "Fixed",
  extra: "Extra",
};

export default function BillingManager() {
  const readOnly = useUserRole() === "finance_manager";
  const [tab, setTab] = useState<"find" | "visiting" | "permanent">("find");
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);

  const [findSubTab, setFindSubTab] = useState<"unpaid" | "paid">("unpaid");
  const [filterDepartmentId, setFilterDepartmentId] = useState("");
  const [filterSession, setFilterSession] = useState("");
  const [filterClassId, setFilterClassId] = useState("");
  const [filterTeacherId, setFilterTeacherId] = useState("");
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  const [rowPaymentMode, setRowPaymentMode] = useState<Record<string, "bank_transfer" | "cheque" | "">>({});
  const [rowChequeNumber, setRowChequeNumber] = useState<Record<string, string>>({});
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [combinedVisitingBill, setCombinedVisitingBill] = useState<{
    items: VisitingBillPrintItem[];
    billNumbersLabel: string;
    dateLabel: string;
  } | null>(null);

  const [visDepartmentId, setVisDepartmentId] = useState("");
  const [visItems, setVisItems] = useState<VisitingPreviewItem[]>([]);
  const [visLoading, setVisLoading] = useState(false);
  const [visSelected, setVisSelected] = useState<Set<string>>(new Set());
  const [visGenerating, setVisGenerating] = useState(false);

  const [permDepartmentId, setPermDepartmentId] = useState("");
  const [permTeacherId, setPermTeacherId] = useState("");
  const [permFrom, setPermFrom] = useState(todayStr());
  const [permTo, setPermTo] = useState(todayStr());
  const [permItems, setPermItems] = useState<PermanentPreviewItem[]>([]);
  const [permOverrides, setPermOverrides] = useState<
    Record<string, { allocation_type: string; rate: string }>
  >({});
  const [permLoading, setPermLoading] = useState(false);
  const [permGenerating, setPermGenerating] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/departments"),
      fetch("/api/admin/teachers"),
      fetch("/api/admin/classes"),
    ]).then(async ([dRes, tRes, cRes]) => {
      const dData = await dRes.json();
      const tData = await tRes.json();
      const cData = await cRes.json();
      if (dRes.ok)
        setDepartments(
          dData.departments.map((d: { id: string; name: string }) => ({
            value: d.id,
            label: d.name,
          })),
        );
      if (tRes.ok) setTeachers(tData.teachers);
      if (cRes.ok) setClasses(cData.classes ?? []);
    });
  }, []);

  const loadBills = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", findSubTab);
      if (filterDepartmentId) params.set("department_id", filterDepartmentId);
      if (filterSession)      params.set("session", filterSession);
      if (filterClassId)      params.set("class_id", filterClassId);
      if (filterTeacherId)    params.set("teacher_id", filterTeacherId);
      const res = await fetch(`/api/admin/bills?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setBills(data.bills);
        setRowPaymentMode({});
        setRowChequeNumber({});
      }
    } finally {
      setLoading(false);
    }
  }, [findSubTab, filterDepartmentId, filterSession, filterClassId, filterTeacherId]);

  useEffect(() => {
    if (tab === "find") loadBills();
  }, [tab, loadBills]);

  const teacherOptions = useMemo(
    () =>
      teachers
        .filter((t) => !filterDepartmentId || t.department_id === filterDepartmentId)
        .map((t) => ({ value: t.id, label: `${t.name} (${t.type})` })),
    [teachers, filterDepartmentId],
  );

  const availableSessions = useMemo(() => {
    const filtered = filterDepartmentId
      ? classes.filter((c) => c.department_id === filterDepartmentId)
      : classes;
    return [...new Set(filtered.map((c) => c.session))].sort();
  }, [classes, filterDepartmentId]);

  const availableClasses = useMemo(
    () =>
      classes.filter(
        (c) =>
          (!filterDepartmentId || c.department_id === filterDepartmentId) &&
          (!filterSession || c.session === filterSession),
      ),
    [classes, filterDepartmentId, filterSession],
  );

  function handleFindDepartmentChange(v: string) {
    setFilterDepartmentId(v);
    setFilterSession("");
    setFilterClassId("");
    setFilterTeacherId("");
  }

  function handleFindSessionChange(v: string) {
    setFilterSession(v);
    setFilterClassId("");
  }

  const permTeacherOptions = useMemo(
    () =>
      teachers
        .filter(
          (t) =>
            t.type === "permanent" && (!permDepartmentId || t.department_id === permDepartmentId),
        )
        .map((t) => ({
          value: t.id,
          label: `${t.name} (${departments.find((d) => d.value === t.department_id)?.label ?? ""})`,
        })),
    [teachers, departments, permDepartmentId],
  );

  const loadVisPreview = useCallback(async () => {
    setVisLoading(true);
    try {
      const params = new URLSearchParams();
      if (visDepartmentId) params.set("department_id", visDepartmentId);
      const res = await fetch(`/api/admin/bills/visiting/preview?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setVisItems(data.items);
        setVisSelected(new Set());
      }
    } finally {
      setVisLoading(false);
    }
  }, [visDepartmentId]);

  useEffect(() => {
    if (tab === "visiting") loadVisPreview();
  }, [tab, loadVisPreview]);

  function toggleVisSelected(id: string) {
    setVisSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGenerateVisiting() {
    if (visSelected.size === 0) {
      toast.error("Select at least one allocation to bill.");
      return;
    }
    setVisGenerating(true);
    try {
      const res = await fetch("/api/admin/bills/visiting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocation_ids: Array.from(visSelected) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      const generatedBills = data.bills as {
        bill_number: string;
        items: VisitingBillPrintItem[];
      }[];
      const items = generatedBills.flatMap((b) => b.items);
      const billNumbersLabel = generatedBills.map((b) => b.bill_number).join(",");
      toast.success(`${generatedBills.length} bill(s) generated.`);
      setSelectedBill(null);
      setCombinedVisitingBill({
        items,
        billNumbersLabel,
        dateLabel: new Date().toLocaleDateString(),
      });
      setTimeout(() => window.print(), 150);
      loadVisPreview();
      setTab("find");
    } finally {
      setVisGenerating(false);
    }
  }

  function handlePermDepartmentChange(v: string) {
    setPermDepartmentId(v);
    setPermTeacherId("");
    setPermItems([]);
  }

  const loadPermPreview = useCallback(async () => {
    if (!permTeacherId) {
      setPermItems([]);
      return;
    }
    setPermLoading(true);
    try {
      const params = new URLSearchParams({ teacher_id: permTeacherId, from: permFrom, to: permTo });
      const res = await fetch(`/api/admin/bills/permanent/preview?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setPermItems(data.items);
        const overrides: Record<string, { allocation_type: string; rate: string }> = {};
        for (const it of data.items as PermanentPreviewItem[]) {
          overrides[it.allocation_id] = {
            allocation_type: it.underlying_type === "fixed" ? "fixed" : "workload",
            rate: it.underlying_rate,
          };
        }
        setPermOverrides(overrides);
      }
    } finally {
      setPermLoading(false);
    }
  }, [permTeacherId, permFrom, permTo]);

  useEffect(() => {
    if (tab === "permanent") loadPermPreview();
  }, [tab, loadPermPreview]);

  function computePermAmount(item: PermanentPreviewItem) {
    const ov = permOverrides[item.allocation_id];
    if (!ov) return 0;
    const rate = Number(ov.rate);
    if (ov.allocation_type === "workload") return rate * Number(item.total_lectures);
    return rate;
  }

  const permTotal = useMemo(() => {
    return permItems.reduce((sum, it) => {
      const ov = permOverrides[it.allocation_id];
      if (!ov) return sum;
      const rate = Number(ov.rate);
      const amount = ov.allocation_type === "workload" ? rate * Number(it.total_lectures) : rate;
      return sum + amount;
    }, 0);
  }, [permItems, permOverrides]);

  async function handleGeneratePermanent() {
    if (!permTeacherId || permItems.length === 0) {
      toast.error("Select a teacher with billable lectures.");
      return;
    }
    setPermGenerating(true);
    try {
      const res = await fetch("/api/admin/bills/permanent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher_id: permTeacherId,
          period_from: permFrom,
          period_to: permTo,
          billing_month: `${permFrom} to ${permTo}`,
          items: permItems.map((it) => ({
            allocation_id: it.allocation_id,
            allocation_type: permOverrides[it.allocation_id]?.allocation_type ?? "workload",
            rate: Number(permOverrides[it.allocation_id]?.rate ?? 0),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Bill generated.");
      setPermTeacherId("");
      setPermItems([]);
      setTab("find");
    } finally {
      setPermGenerating(false);
    }
  }

  async function handleMarkPaid(bill: Bill) {
    const mode = rowPaymentMode[bill.id] ?? "";
    if (!mode) {
      toast.error("Select a payment mode before marking as paid.");
      return;
    }
    if (mode === "cheque") {
      const cheque = (rowChequeNumber[bill.id] ?? "").trim();
      if (!/^\d{6}$/.test(cheque)) {
        toast.error("Enter the last 6 digits of the cheque number.");
        return;
      }
    }
    setMarkingPaid(bill.id);
    try {
      const res = await fetch(`/api/admin/bills/${bill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "paid",
          payment_mode: mode,
          cheque_number: mode === "cheque" ? (rowChequeNumber[bill.id] ?? "").trim() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Bill marked as paid.");
      setFindSubTab("paid");
    } finally {
      setMarkingPaid(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/bills/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Bill deleted and attendance unlinked.");
      setDeleteTarget(null);
      loadBills();
    } finally {
      setDeleting(false);
    }
  }

  function handlePrint(bill: Bill) {
    setCombinedVisitingBill(null);
    setSelectedBill(bill);
    setTimeout(() => window.print(), 100);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Billing</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Generate and track visiting & permanent faculty bills
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-300 p-1 dark:border-slate-700">
          {(
            [
              { key: "find", label: "Find Bill" },
              ...(!readOnly ? [
                { key: "visiting", label: "Visiting Faculty Bill" },
                { key: "permanent", label: "Permanent Faculty Bill" },
              ] : []),
            ] as { key: "find" | "visiting" | "permanent"; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium sm:text-sm ${tab === key ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-300"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "find" && (
        <div className="print:hidden">
          {/* Sub-tabs */}
          <div className="mb-4 flex gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-700 w-fit">
            {(["unpaid", "paid"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFindSubTab(st)}
                className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors sm:px-4 sm:py-1.5 sm:text-sm ${
                  findSubTab === st
                    ? st === "unpaid"
                      ? "bg-amber-500 text-white"
                      : "bg-emerald-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {st === "unpaid" ? "Unpaid" : "Paid"}
              </button>
            ))}
          </div>

          {/* Cascading filters */}
          <div className="mb-4 grid grid-cols-1 gap-3 card-3d p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Department
              </label>
              <SearchableSelect
                options={departments}
                value={departments.find((d) => d.value === filterDepartmentId) || null}
                onChange={(opt) => handleFindDepartmentChange(opt ? (opt as SelectOption).value : "")}
                placeholder="All departments"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Session
              </label>
              <select
                value={filterSession}
                onChange={(e) => handleFindSessionChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">All sessions</option>
                {availableSessions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Class
              </label>
              <SearchableSelect
                options={availableClasses.map((c) => ({ value: c.id, label: `${c.class_name} (${c.session})` }))}
                value={
                  availableClasses
                    .map((c) => ({ value: c.id, label: `${c.class_name} (${c.session})` }))
                    .find((o) => o.value === filterClassId) || null
                }
                onChange={(opt) => setFilterClassId(opt ? (opt as SelectOption).value : "")}
                placeholder="All classes"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Teacher
              </label>
              <SearchableSelect
                options={teacherOptions}
                value={teacherOptions.find((t) => t.value === filterTeacherId) || null}
                onChange={(opt) => setFilterTeacherId(opt ? (opt as SelectOption).value : "")}
                placeholder="All teachers"
              />
            </div>
          </div>

          {/* Bills table */}
          <div className="overflow-x-auto card-3d card-hover">
            <table className="w-full min-w-[900px] border-collapse text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 sm:text-xs">
                <tr>
                  <th className="px-2 py-2 whitespace-nowrap sm:px-3 sm:py-3">Bill #</th>
                  <th className="px-2 py-2 whitespace-nowrap sm:px-3 sm:py-3">Bill Date</th>
                  <th className="px-2 py-2 whitespace-nowrap sm:px-3 sm:py-3">Teacher</th>
                  <th className="px-2 py-2 whitespace-nowrap sm:px-3 sm:py-3">Course</th>
                  <th className="px-2 py-2 whitespace-nowrap sm:px-3 sm:py-3">Class / Session / Sem</th>
                  <th className="px-2 py-2 whitespace-nowrap sm:px-3 sm:py-3">Type</th>
                  <th className="px-2 py-2 whitespace-nowrap sm:px-3 sm:py-3">Period</th>
                  <th className="px-2 py-2 whitespace-nowrap text-right sm:px-3 sm:py-3">Amount (PKR)</th>
                  <th className="px-2 py-2 whitespace-nowrap sm:px-3 sm:py-3">Status</th>
                  <th className="px-2 py-2 whitespace-nowrap sm:px-3 sm:py-3">Payment Mode</th>
                  <th className="px-2 py-2 whitespace-nowrap sm:px-3 sm:py-3">Cheque #</th>
                  {findSubTab === "paid" && (
                    <th className="px-2 py-2 whitespace-nowrap sm:px-3 sm:py-3">Paid Date</th>
                  )}
                  <th className="px-2 py-2 whitespace-nowrap text-right sm:px-3 sm:py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <TableLoader colSpan={findSubTab === "unpaid" ? 12 : 13} />
                ) : bills.length === 0 ? (
                  <tr>
                    <td
                      colSpan={findSubTab === "unpaid" ? 12 : 13}
                      className="px-4 py-10 text-center text-slate-400"
                    >
                      No {findSubTab} bills found.
                    </td>
                  </tr>
                ) : (
                  bills.map((b) => {
                    const courses = b.items
                      .map((it) => it.course_title)
                      .filter(Boolean)
                      .join(", ");
                    const classInfo = b.items
                      .map((it) =>
                        it.class_name
                          ? `${it.class_name} ${it.session} Sem ${it.semester_number}`
                          : null,
                      )
                      .filter(Boolean)
                      .join(" / ");
                    const mode = rowPaymentMode[b.id] ?? "";
                    const cheque = rowChequeNumber[b.id] ?? "";
                    const canMarkPaid = !!mode && (mode !== "cheque" || /^\d{6}$/.test(cheque.trim()));

                    return (
                      <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-2 py-2 font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap sm:px-3 sm:py-3">
                          {b.bill_number}
                        </td>
                        <td className="px-2 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap sm:px-3 sm:py-3">
                          {formatDateOnly(b.created_at)}
                        </td>
                        <td className="px-2 py-2 sm:px-3 sm:py-3">
                          <div className="font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {b.teacher_name}
                          </div>
                          <div className="text-[10px] text-slate-400 sm:text-xs">{b.department_name}</div>
                        </td>
                        <td className="px-2 py-2 text-slate-600 dark:text-slate-300 sm:px-3 sm:py-3 max-w-[130px]">
                          <div className="truncate" title={courses}>{courses || "—"}</div>
                        </td>
                        <td className="px-2 py-2 text-slate-600 dark:text-slate-300 sm:px-3 sm:py-3 max-w-[160px]">
                          <div className="truncate text-[10px] sm:text-xs" title={classInfo}>{classInfo || "—"}</div>
                        </td>
                        <td className="px-2 py-2 capitalize text-slate-600 dark:text-slate-300 whitespace-nowrap sm:px-3 sm:py-3">
                          {b.bill_type}
                        </td>
                        <td className="px-2 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap text-[10px] sm:px-3 sm:py-3 sm:text-xs">
                          {b.billing_month || `${b.period_from ?? ""} – ${b.period_to ?? ""}`}
                        </td>
                        <td className="px-2 py-2 font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap text-right sm:px-3 sm:py-3">
                          {Number(b.total_amount).toLocaleString()}
                        </td>
                        <td className="px-2 py-2 sm:px-3 sm:py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap sm:px-2.5 sm:py-1 sm:text-xs ${
                              b.status === "paid"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                            }`}
                          >
                            {b.status === "paid" ? "Paid" : "Unpaid"}
                          </span>
                        </td>

                        {findSubTab === "unpaid" ? (
                          <>
                            <td className="px-2 py-2 sm:px-3 sm:py-3">
                              <select
                                value={mode}
                                onChange={(e) =>
                                  setRowPaymentMode((prev) => ({
                                    ...prev,
                                    [b.id]: e.target.value as "bank_transfer" | "cheque" | "",
                                  }))
                                }
                                className="w-32 rounded-lg border border-slate-300 px-1.5 py-1 text-[10px] dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:w-36 sm:px-2 sm:py-1.5 sm:text-xs"
                              >
                                <option value="">— Select —</option>
                                <option value="bank_transfer">Bank Transfer</option>
                                <option value="cheque">Cheque</option>
                              </select>
                            </td>
                            <td className="px-2 py-2 sm:px-3 sm:py-3">
                              {mode === "cheque" ? (
                                <input
                                  type="text"
                                  maxLength={6}
                                  value={cheque}
                                  onChange={(e) =>
                                    setRowChequeNumber((prev) => ({
                                      ...prev,
                                      [b.id]: e.target.value.replace(/\D/g, "").slice(0, 6),
                                    }))
                                  }
                                  placeholder="6 digits"
                                  className="w-24 rounded-lg border border-slate-300 px-1.5 py-1 text-[10px] dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:w-28 sm:px-2 sm:py-1.5 sm:text-xs"
                                />
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-2 py-2 text-[10px] text-slate-600 dark:text-slate-300 whitespace-nowrap sm:px-3 sm:py-3 sm:text-xs">
                              {b.payment_mode === "bank_transfer"
                                ? "Bank Transfer"
                                : b.payment_mode === "cheque"
                                  ? "Cheque"
                                  : "—"}
                            </td>
                            <td className="px-2 py-2 text-[10px] text-slate-600 dark:text-slate-300 sm:px-3 sm:py-3 sm:text-xs">
                              {b.cheque_number || "—"}
                            </td>
                            <td className="px-2 py-2 text-[10px] text-slate-600 dark:text-slate-300 whitespace-nowrap sm:px-3 sm:py-3 sm:text-xs">
                              {b.paid_at ? formatDateOnly(b.paid_at) : "—"}
                            </td>
                          </>
                        )}

                        {/* Actions */}
                        <td className="px-2 py-2 sm:px-3 sm:py-3">
                          <div className="flex justify-end gap-0.5 sm:gap-1">
                            <div className="relative group">
                              <button
                                onClick={() => handlePrint(b)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 sm:h-8 sm:w-8"
                              >
                                <FileDown size={13} className="sm:hidden" />
                                <FileDown size={15} className="hidden sm:block" />
                              </button>
                              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                View Bill PDF
                              </span>
                            </div>

                            {findSubTab === "unpaid" && (
                              <div className="relative group">
                                <button
                                  onClick={() => handleMarkPaid(b)}
                                  disabled={!canMarkPaid || markingPaid === b.id}
                                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors sm:h-8 sm:w-8 ${
                                    canMarkPaid
                                      ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                                      : "cursor-not-allowed text-slate-300 dark:text-slate-600"
                                  }`}
                                >
                                  {markingPaid === b.id ? (
                                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent sm:h-3.5 sm:w-3.5" />
                                  ) : (
                                    <>
                                      <CheckCircle2 size={13} className="sm:hidden" />
                                      <CheckCircle2 size={15} className="hidden sm:block" />
                                    </>
                                  )}
                                </button>
                                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                  {canMarkPaid ? "Mark as Paid" : "Select payment mode first"}
                                </span>
                              </div>
                            )}

                            <div className="relative group">
                              <button
                                onClick={() => setDeleteTarget(b)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 sm:h-8 sm:w-8"
                              >
                                <Trash2 size={13} className="sm:hidden" />
                                <Trash2 size={15} className="hidden sm:block" />
                              </button>
                              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                Delete Bill
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "visiting" && (
        <div className="print:hidden">
          <div className="mb-4 flex flex-col gap-3 card-3d p-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full sm:max-w-xs">
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Department
              </label>
              <SearchableSelect
                options={departments}
                value={departments.find((d) => d.value === visDepartmentId) || null}
                onChange={(opt) => setVisDepartmentId(opt ? (opt as SelectOption).value : "")}
                placeholder="All departments"
              />
            </div>
            <button
              onClick={handleGenerateVisiting}
              disabled={visGenerating || visSelected.size === 0}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {visGenerating && <ButtonLoader />}
              <Banknote size={16} /> Generate {visSelected.size > 0 ? `(${visSelected.size})` : ""}{" "}
              Bill(s)
            </button>
          </div>

          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Only unbilled attendance from closed semesters for visiting faculty is shown here. Fixed
            allocations bill the flat rate; others bill rate × total lectures.
          </p>

          <div className="overflow-hidden card-3d card-hover">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3"></th>
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Class(es)</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Lectures</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visLoading ? (
                  <TableLoader colSpan={8} />
                ) : visItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                      No unbilled lectures found.
                    </td>
                  </tr>
                ) : (
                  visItems.map((it) => (
                    <tr
                      key={it.allocation_id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={visSelected.has(it.allocation_id)}
                          onChange={() => toggleVisSelected(it.allocation_id)}
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {it.teacher_name}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-slate-100">
                          {it.course_code}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {it.course_title}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {it.classes.join(",")}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {allocTypeLabel[it.allocation_type]}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {it.total_lectures}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{it.rate}</td>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                        {it.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "permanent" && (
        <div className="print:hidden">
          <div className="mb-4 grid grid-cols-1 gap-3 card-3d p-4 sm:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Department
              </label>
              <SearchableSelect
                options={departments}
                value={departments.find((d) => d.value === permDepartmentId) || null}
                onChange={(opt) =>
                  handlePermDepartmentChange(opt ? (opt as SelectOption).value : "")
                }
                placeholder="All departments"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Teacher
              </label>
              <SearchableSelect
                options={permTeacherOptions}
                value={permTeacherOptions.find((t) => t.value === permTeacherId) || null}
                onChange={(opt) => setPermTeacherId(opt ? (opt as SelectOption).value : "")}
                placeholder="Select permanent teacher"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                From
              </label>
              <input
                type="date"
                value={permFrom}
                onChange={(e) => setPermFrom(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                To
              </label>
              <input
                type="date"
                value={permTo}
                onChange={(e) => setPermTo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="overflow-hidden card-3d card-hover">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Class(es)</th>
                  <th className="px-4 py-3">Lectures</th>
                  <th className="px-4 py-3">Bill As</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {permLoading ? (
                  <TableLoader colSpan={6} />
                ) : !permTeacherId ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      {permDepartmentId
                        ? "Select a teacher to preview billable lectures."
                        : "Select a department, then a teacher, to preview billable lectures."}
                    </td>
                  </tr>
                ) : permItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      No unbilled lectures found for this period.
                    </td>
                  </tr>
                ) : (
                  permItems.map((it) => {
                    const ov = permOverrides[it.allocation_id] ?? {
                      allocation_type: "workload",
                      rate: it.underlying_rate,
                    };
                    return (
                      <tr
                        key={it.allocation_id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800 dark:text-slate-100">
                            {it.course_code}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {it.course_title}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {it.classes.join(",")}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {it.total_lectures}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={ov.allocation_type}
                            onChange={(e) =>
                              setPermOverrides((prev) => ({
                                ...prev,
                                [it.allocation_id]: { ...ov, allocation_type: e.target.value },
                              }))
                            }
                            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          >
                            <option value="workload">Workload</option>
                            <option value="extra">Extra</option>
                            <option value="fixed">Fixed</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={ov.rate}
                            onChange={(e) =>
                              setPermOverrides((prev) => ({
                                ...prev,
                                [it.allocation_id]: { ...ov, rate: e.target.value },
                              }))
                            }
                            className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                          {computePermAmount(it).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {permItems.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Total: PKR {permTotal.toLocaleString()}
                </span>
                <button
                  onClick={handleGeneratePermanent}
                  disabled={permGenerating}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {permGenerating && <ButtonLoader />}
                  <Wallet size={16} /> Generate Bill
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedBill && selectedBill.bill_type === "visiting" && (
        <div className="hidden print:block">
          <VisitingBillDocument
            docTitle={`Visiting Faculty Bill — ${selectedBill.bill_number}`}
            billNumbersLabel={selectedBill.bill_number}
            dateLabel={formatDateOnly(selectedBill.created_at)}
            items={selectedBill.items.map((it) => ({
              course_code: it.course_code ?? "",
              course_title: it.course_title ?? "",
              class_name: it.class_name ?? "",
              session: it.session ?? "",
              semester_number: it.semester_number,
              teacher_name: selectedBill.teacher_name,
              allocation_type: it.allocation_type,
              total_lectures: it.total_lectures,
              rate: it.rate,
              amount: it.amount,
              attendance: it.attendance ?? [],
            }))}
          />
        </div>
      )}

      {selectedBill && selectedBill.bill_type === "permanent" && (
        <div className="hidden print:block">
          <div className="mb-4 rounded-lg border-2 border-indigo-600 bg-gradient-to-r from-indigo-600 to-sky-500 p-4 text-center text-white">
            <h2 className="text-xl font-extrabold tracking-wide">
              City College (University Campus)
            </h2>
            <p className="text-sm font-semibold">Faculty Bill — {selectedBill.bill_number}</p>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
            <div>
              <strong>Teacher:</strong> {selectedBill.teacher_name}
            </div>
            <div>
              <strong>Department:</strong> {selectedBill.department_name}
            </div>
            <div>
              <strong>Type:</strong> {selectedBill.bill_type}
            </div>
            <div>
              <strong>Period:</strong>{" "}
              {selectedBill.billing_month ||
                `${selectedBill.period_from} - ${selectedBill.period_to}`}
            </div>
            <div>
              <strong>Status:</strong> {selectedBill.status}
            </div>
          </div>
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-indigo-600 text-white">
              <tr>
                <th className="border border-indigo-400 px-3 py-2">Course</th>
                <th className="border border-indigo-400 px-3 py-2">Class</th>
                <th className="border border-indigo-400 px-3 py-2">Type</th>
                <th className="border border-indigo-400 px-3 py-2">Lectures</th>
                <th className="border border-indigo-400 px-3 py-2">Rate</th>
                <th className="border border-indigo-400 px-3 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {selectedBill.items.map((it) => (
                <tr key={it.id}>
                  <td className="border border-indigo-200 px-3 py-2">
                    {it.course_code} — {it.course_title}
                  </td>
                  <td className="border border-indigo-200 px-3 py-2">
                    {it.class_name
                      ? `${it.class_name} (${it.session}) Sem ${it.semester_number}`
                      : "-"}
                  </td>
                  <td className="border border-indigo-200 px-3 py-2">
                    {allocTypeLabel[it.allocation_type]}
                  </td>
                  <td className="border border-indigo-200 px-3 py-2">{it.total_lectures}</td>
                  <td className="border border-indigo-200 px-3 py-2">{it.rate}</td>
                  <td className="border border-indigo-200 px-3 py-2">
                    {Number(it.amount).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-right text-base font-bold">
            Total: PKR {Number(selectedBill.total_amount).toLocaleString()}
          </p>

          <BillAttendanceAppendix
            items={selectedBill.items.map((it) => ({
              course_code: it.course_code ?? "",
              course_title: it.course_title ?? "",
              class_name: it.class_name ?? "",
              session: it.session ?? "",
              teacher_name: selectedBill.teacher_name,
              attendance: it.attendance ?? [],
            }))}
          />
        </div>
      )}

      {combinedVisitingBill && (
        <div className="hidden print:block">
          <VisitingBillDocument
            docTitle="Visiting Faculty Bill"
            billNumbersLabel={combinedVisitingBill.billNumbersLabel}
            dateLabel={combinedVisitingBill.dateLabel}
            items={combinedVisitingBill.items}
          />
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Bill"
        message={`Delete bill ${deleteTarget?.bill_number}? Its attendance records will become billable again.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
