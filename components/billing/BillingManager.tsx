"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Banknote, FileDown, Trash2, Wallet } from "lucide-react";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { formatDateOnly } from "@/lib/format";
import { TableLoader, ButtonLoader } from "@/components/ui/Loaders";

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
  const [tab, setTab] = useState<"find" | "visiting" | "permanent">("find");
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);

  const [filterDepartmentId, setFilterDepartmentId] = useState("");
  const [filterTeacherId, setFilterTeacherId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
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
    Promise.all([fetch("/api/admin/departments"), fetch("/api/admin/teachers")]).then(
      async ([dRes, tRes]) => {
        const dData = await dRes.json();
        const tData = await tRes.json();
        if (dRes.ok)
          setDepartments(
            dData.departments.map((d: { id: string; name: string }) => ({
              value: d.id,
              label: d.name,
            })),
          );
        if (tRes.ok) setTeachers(tData.teachers);
      },
    );
  }, []);

  const loadBills = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterDepartmentId) params.set("department_id", filterDepartmentId);
      if (filterTeacherId) params.set("teacher_id", filterTeacherId);
      if (filterStatus) params.set("status", filterStatus);
      if (filterType) params.set("bill_type", filterType);
      const res = await fetch(`/api/admin/bills?${params.toString()}`);
      const data = await res.json();
      if (res.ok) setBills(data.bills);
    } finally {
      setLoading(false);
    }
  }, [filterDepartmentId, filterTeacherId, filterStatus, filterType]);

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

  async function handleToggleStatus(bill: Bill) {
    const res = await fetch(`/api/admin/bills/${bill.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: bill.status === "paid" ? "unpaid" : "paid" }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Something went wrong.");
      return;
    }
    toast.success("Bill status updated.");
    loadBills();
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
        <div className="flex gap-2 rounded-lg border border-slate-300 p-1 dark:border-slate-700">
          <button
            onClick={() => setTab("find")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "find" ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-300"}`}
          >
            Find Bill
          </button>
          <button
            onClick={() => setTab("visiting")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "visiting" ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-300"}`}
          >
            Visiting Faculty Bill
          </button>
          <button
            onClick={() => setTab("permanent")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "permanent" ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-300"}`}
          >
            Permanent Faculty Bill
          </button>
        </div>
      </div>

      {tab === "find" && (
        <div className="print:hidden">
          <div className="mb-4 grid grid-cols-1 gap-3 card-3d p-4 sm:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Department
              </label>
              <SearchableSelect
                options={departments}
                value={departments.find((d) => d.value === filterDepartmentId) || null}
                onChange={(opt) => {
                  setFilterDepartmentId(opt ? (opt as SelectOption).value : "");
                  setFilterTeacherId("");
                }}
                placeholder="All departments"
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
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">All</option>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">All</option>
                <option value="visiting">Visiting</option>
                <option value="permanent">Permanent</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden card-3d card-hover">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Bill #</th>
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Amount (PKR)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <TableLoader colSpan={7} />
                ) : bills.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      No bills found.
                    </td>
                  </tr>
                ) : (
                  bills.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                        {b.bill_number}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {b.teacher_name}
                        <div className="text-xs text-slate-400">{b.department_name}</div>
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">
                        {b.bill_type}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {b.billing_month || `${b.period_from} - ${b.period_to}`}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                        {Number(b.total_amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleStatus(b)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${b.status === "paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"}`}
                        >
                          {b.status === "paid" ? "Paid" : "Unpaid"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handlePrint(b)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                          >
                            <FileDown size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(b)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
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
