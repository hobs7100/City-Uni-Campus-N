"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowRightLeft, ChevronDown, ChevronUp, FileDown, History,
  Layers, Pencil, Plus, Trash2, Users,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";
import { TableLoader } from "@/components/ui/Loaders";
import { useUserRole } from "@/lib/roleContext";

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface ClassOption {
  id: string;
  department_id: string;
  class_name: string;
  session: string;
  total_semesters: number;
}

interface TeacherOption {
  id: string;
  name: string;
  department_id: string;
  type: "permanent" | "visiting";
  status: "active" | "blocked";
}

interface SemesterRow {
  id: string;
  class_id: string;
  class_name: string;
  session: string;
  department_id: string;
  semester_number: number;
  term_type: "Fall" | "Spring";
  status: "active" | "closed";
  courses: { id: string; code: string; title: string; credit_hours: string }[];
}

interface AllocationSemester {
  semester_id: string;
  class_id: string;
  department_id: string;
  class_name: string;
  session: string;
  semester_number: number;
  term_type: string;
  status: string;
}

interface Allocation {
  id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  credit_hours: string;
  teacher_id: string;
  teacher_name: string;
  teacher_type: string;
  allocation_type: "workload" | "per_credit_hour" | "fixed";
  rate: string;
  is_combined: boolean;
  status: string;                  // "active" | "transferred"
  started_at: string | null;
  end_date: string | null;
  transfer_group_id: string | null;
  lecture_seq_offset: number;
  semesters: AllocationSemester[];
  result_uploaded: boolean;
}

interface HistoryRow {
  id: string;
  teacher_name: string;
  teacher_type: string;
  allocation_type: string;
  rate: string;
  status: string;
  started_at: string | null;
  end_date: string | null;
  lecture_seq_offset: number;
  total_lectures: number;
  delivered_from: number;
  delivered_to: number;
  semesters: { semester_id: string; class_name: string; session: string; semester_number: number }[];
}

/* ─── Constants ─────────────────────────────────────────────────────────── */

const allocationTypeOptions = [
  { value: "workload", label: "Workload" },
  { value: "per_credit_hour", label: "Per Credit Hour" },
  { value: "fixed", label: "Fixed" },
];

const allocationTypeLabel: Record<string, string> = {
  workload: "Workload",
  per_credit_hour: "Per Credit Hour",
  fixed: "Fixed",
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
      Transferred
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */

export default function AllocationsPage() {
  const readOnly = useUserRole() === "finance_manager";

  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [classes, setClasses]         = useState<ClassOption[]>([]);
  const [teachers, setTeachers]       = useState<TeacherOption[]>([]);
  const [semesters, setSemesters]     = useState<SemesterRow[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading]         = useState(true);

  /* ── Create modal ─────────────────────────────────────────────────────── */
  const [modalOpen, setModalOpen]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Allocation | null>(null);
  const [deleting, setDeleting]     = useState(false);

  const [departmentId, setDepartmentId]             = useState("");
  const [session, setSession]                       = useState("");
  const [classId, setClassId]                       = useState("");
  const [courseId, setCourseId]                     = useState("");
  const [showAllTeachers, setShowAllTeachers]       = useState(false);
  const [teacherId, setTeacherId]                   = useState("");
  const [allocationType, setAllocationType]         = useState<"workload" | "per_credit_hour" | "fixed">("workload");
  const [rate, setRate]                             = useState("");
  const [isCombined, setIsCombined]                 = useState(false);
  const [combinedSemesterIds, setCombinedSemesterIds] = useState<string[]>([]);

  /* ── Edit modal ───────────────────────────────────────────────────────── */
  const [editTarget, setEditTarget]       = useState<Allocation | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSaving, setEditSaving]       = useState(false);
  const [editTeacherId, setEditTeacherId]         = useState("");
  const [editAllocationType, setEditAllocationType] = useState<"workload" | "per_credit_hour" | "fixed">("workload");
  const [editRate, setEditRate]           = useState("");
  const [editSemesterIds, setEditSemesterIds]     = useState<string[]>([]);

  /* ── Transfer modal ───────────────────────────────────────────────────── */
  const [transferTarget, setTransferTarget]   = useState<Allocation | null>(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferring, setTransferring]       = useState(false);
  const [xferTeacherId, setXferTeacherId]     = useState("");
  const [xferDate, setXferDate]               = useState("");
  const [xferAllocType, setXferAllocType]     = useState<"workload" | "per_credit_hour" | "fixed">("workload");
  const [xferRate, setXferRate]               = useState("");
  const [showAllXferTeachers, setShowAllXferTeachers] = useState(false);

  /* ── History panel ────────────────────────────────────────────────────── */
  const [historyTarget, setHistoryTarget]     = useState<Allocation | null>(null);
  const [historyRows, setHistoryRows]         = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading]   = useState(false);
  const [expandedHistId, setExpandedHistId]   = useState<string | null>(null);

  /* ── List filters ─────────────────────────────────────────────────────── */
  const [filterDepartmentId, setFilterDepartmentId] = useState("");
  const [filterSession, setFilterSession]           = useState("");
  const [filterClassId, setFilterClassId]           = useState("");
  const [filterTeacherId, setFilterTeacherId]       = useState("");
  const [filterStatus, setFilterStatus]             = useState<"" | "active" | "transferred">("");

  /* ── Data load ────────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, classRes, teacherRes, semRes, allocRes] = await Promise.all([
        fetch("/api/admin/departments"),
        fetch("/api/admin/classes"),
        fetch("/api/admin/teachers"),
        fetch("/api/admin/semesters?status=active"),
        fetch("/api/admin/allocations"),
      ]);
      const deptData  = await deptRes.json();
      const classData = await classRes.json();
      const teacherData = await teacherRes.json();
      const semData   = await semRes.json();
      const allocData = await allocRes.json();
      if (deptRes.ok)   setDepartments(deptData.departments.map((d: { id: string; name: string }) => ({ value: d.id, label: d.name })));
      if (classRes.ok)  setClasses(classData.classes);
      if (teacherRes.ok) setTeachers(teacherData.teachers);
      if (semRes.ok)    setSemesters(semData.semesters);
      if (allocRes.ok)  setAllocations(allocData.allocations);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Create ─────────────────────────────────────────────────────────── */
  function resetForm() {
    setDepartmentId(""); setSession(""); setClassId(""); setCourseId("");
    setShowAllTeachers(false); setTeacherId(""); setAllocationType("workload");
    setRate(""); setIsCombined(false); setCombinedSemesterIds([]);
  }
  function openCreate() { resetForm(); setModalOpen(true); }

  const sessionOptions = useMemo(() => {
    const set = new Set(classes.filter((c) => c.department_id === departmentId).map((c) => c.session));
    return Array.from(set).map((s) => ({ value: s, label: s }));
  }, [classes, departmentId]);

  const classOptions = useMemo(() =>
    classes.filter((c) => c.department_id === departmentId && c.session === session)
      .map((c) => ({ value: c.id, label: c.class_name })),
    [classes, departmentId, session]);

  const primarySemester = useMemo(() =>
    semesters.find((s) => s.class_id === classId && s.status === "active"),
    [semesters, classId]);

  const allocatedCourseIdsBySemester = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const a of allocations) {
      if (a.status !== "active") continue; // transferred ones don't block new allocations
      for (const s of a.semesters) {
        if (!map.has(s.semester_id)) map.set(s.semester_id, new Set());
        map.get(s.semester_id)!.add(a.course_id);
      }
    }
    return map;
  }, [allocations]);

  const availableCourseOptions = useMemo(() => {
    if (!primarySemester) return [];
    const takenHere = allocatedCourseIdsBySemester.get(primarySemester.id) ?? new Set();
    return primarySemester.courses
      .filter((c) => !takenHere.has(c.id))
      .map((c) => ({ value: c.id, label: `${c.code} — ${c.title} (${c.credit_hours} Cr)` }));
  }, [primarySemester, allocatedCourseIdsBySemester]);

  const teacherOptions = useMemo(() => {
    const pool = showAllTeachers ? teachers : teachers.filter((t) => t.department_id === departmentId);
    return pool.filter((t) => t.status === "active").map((t) => ({ value: t.id, label: `${t.name} (${t.type})` }));
  }, [teachers, showAllTeachers, departmentId]);

  const combinedOptions = useMemo(() =>
    semesters.filter((s) => s.id !== primarySemester?.id && s.status === "active")
      .map((s) => ({ value: s.id, label: `${s.class_name} (${s.session}) — Sem ${s.semester_number} ${s.term_type}` })),
    [semesters, primarySemester]);

  const allActiveSemesterOptions = useMemo(() =>
    semesters.filter((s) => s.status === "active")
      .map((s) => ({ value: s.id, label: `${s.class_name} (${s.session}) — Sem ${s.semester_number} ${s.term_type}` })),
    [semesters]);

  const allTeacherOptions = useMemo(() =>
    teachers.filter((t) => t.status === "active").map((t) => ({ value: t.id, label: `${t.name} (${t.type})` })),
    [teachers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!primarySemester) { toast.error("Selected class has no active semester."); return; }
    if (!courseId || !teacherId || !rate) { toast.error("Please fill all required fields."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId, teacher_id: teacherId,
          semester_id: primarySemester.id, allocation_type: allocationType,
          rate: Number(rate), is_combined: isCombined,
          combined_semester_ids: isCombined ? combinedSemesterIds : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Something went wrong."); return; }
      toast.success("Allocation created.");
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  }

  /* ── Edit ────────────────────────────────────────────────────────────── */
  function openEdit(a: Allocation) {
    setEditTarget(a);
    setEditTeacherId(a.teacher_id);
    setEditAllocationType(a.allocation_type);
    setEditRate(a.rate);
    setEditSemesterIds(a.semesters.map((s) => s.semester_id));
    setEditModalOpen(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    if (!editTeacherId || !editRate || editSemesterIds.length === 0) {
      toast.error("Please fill all required fields."); return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/allocations/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_id: editTeacherId, allocation_type: editAllocationType, rate: Number(editRate), semester_ids: editSemesterIds }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Something went wrong."); return; }
      toast.success("Allocation updated.");
      setEditModalOpen(false); setEditTarget(null); load();
    } finally { setEditSaving(false); }
  }

  /* ── Delete ──────────────────────────────────────────────────────────── */
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/allocations/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Something went wrong."); return; }
      toast.success("Allocation removed."); setDeleteTarget(null); load();
    } finally { setDeleting(false); }
  }

  /* ── Transfer ────────────────────────────────────────────────────────── */
  function openTransfer(a: Allocation) {
    setTransferTarget(a);
    setXferTeacherId("");
    setXferDate("");
    setXferAllocType(a.allocation_type);
    setXferRate(a.rate);
    setShowAllXferTeachers(false);
    setTransferModalOpen(true);
  }

  // Teachers eligible for transfer (exclude current teacher, must be active)
  const xferTeacherOptions = useMemo(() => {
    if (!transferTarget) return [];
    const pool = showAllXferTeachers
      ? teachers
      : teachers.filter((t) => t.department_id === (transferTarget.semesters[0]?.department_id ?? ""));
    return pool
      .filter((t) => t.status === "active" && t.id !== transferTarget.teacher_id)
      .map((t) => ({ value: t.id, label: `${t.name} (${t.type})` }));
  }, [teachers, transferTarget, showAllXferTeachers]);

  async function handleTransferSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transferTarget) return;
    if (!xferTeacherId || !xferDate) { toast.error("Select a teacher and transfer date."); return; }
    setTransferring(true);
    try {
      const res = await fetch(`/api/admin/allocations/${transferTarget.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_teacher_id: xferTeacherId,
          transfer_date: xferDate,
          allocation_type: xferAllocType,
          rate: Number(xferRate),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Transfer failed."); return; }
      toast.success("Course transferred successfully.");
      setTransferModalOpen(false); setTransferTarget(null); load();
    } finally { setTransferring(false); }
  }

  /* ── History ─────────────────────────────────────────────────────────── */
  async function openHistory(a: Allocation) {
    if (historyTarget?.id === a.id) { setHistoryTarget(null); setHistoryRows([]); return; }
    setHistoryTarget(a);
    setHistoryRows([]);
    setHistoryLoading(true);
    try {
      const res  = await fetch(`/api/admin/allocations/history?allocation_id=${a.id}`);
      const data = await res.json();
      if (res.ok) setHistoryRows(data.history ?? []);
      else toast.error(data.error || "Failed to load history.");
    } finally { setHistoryLoading(false); }
  }

  /* ── Filters ─────────────────────────────────────────────────────────── */
  const filterSessionOptions = useMemo(() => {
    const set = new Set(classes.filter((c) => !filterDepartmentId || c.department_id === filterDepartmentId).map((c) => c.session));
    return Array.from(set).map((s) => ({ value: s, label: s }));
  }, [classes, filterDepartmentId]);

  const filterClassOptions = useMemo(() =>
    classes
      .filter((c) => (!filterDepartmentId || c.department_id === filterDepartmentId) && (!filterSession || c.session === filterSession))
      .map((c) => ({ value: c.id, label: c.class_name })),
    [classes, filterDepartmentId, filterSession]);

  const filteredAllocations = useMemo(() =>
    allocations.filter((a) => {
      if (filterDepartmentId && !a.semesters.some((s) => s.department_id === filterDepartmentId)) return false;
      if (filterSession && !a.semesters.some((s) => s.session === filterSession)) return false;
      if (filterClassId && !a.semesters.some((s) => s.class_id === filterClassId)) return false;
      if (filterTeacherId && a.teacher_id !== filterTeacherId) return false;
      if (filterStatus && a.status !== filterStatus) return false;
      return true;
    }),
    [allocations, filterDepartmentId, filterSession, filterClassId, filterTeacherId, filterStatus]);

  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (filterDepartmentId) parts.push(`Department: ${departments.find((d) => d.value === filterDepartmentId)?.label ?? ""}`);
    if (filterSession) parts.push(`Session: ${filterSession}`);
    if (filterClassId) parts.push(`Class: ${filterClassOptions.find((c) => c.value === filterClassId)?.label ?? ""}`);
    if (filterTeacherId) parts.push(`Teacher: ${teachers.find((t) => t.id === filterTeacherId)?.name ?? ""}`);
    return parts.length ? parts.join(" ·") : "All allocations";
  }, [filterDepartmentId, filterSession, filterClassId, filterTeacherId, departments, filterClassOptions, teachers]);

  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Allocation Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Assign teachers to courses for active semesters</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FileDown size={18} /> Export PDF
          </button>
          {!readOnly && (
            <button
              onClick={openCreate}
              className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Plus size={18} /> New Allocation
            </button>
          )}
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-1 gap-3 card-3d p-4 print:hidden sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Department</label>
          <SearchableSelect
            options={departments}
            value={departments.find((d) => d.value === filterDepartmentId) || null}
            onChange={(opt) => { setFilterDepartmentId(opt ? (opt as SelectOption).value : ""); setFilterSession(""); setFilterClassId(""); }}
            placeholder="All departments"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Session</label>
          <SearchableSelect
            options={filterSessionOptions}
            value={filterSessionOptions.find((s) => s.value === filterSession) || null}
            onChange={(opt) => { setFilterSession(opt ? (opt as SelectOption).value : ""); setFilterClassId(""); }}
            placeholder="All sessions"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Class</label>
          <SearchableSelect
            options={filterClassOptions}
            value={filterClassOptions.find((c) => c.value === filterClassId) || null}
            onChange={(opt) => setFilterClassId(opt ? (opt as SelectOption).value : "")}
            placeholder="All classes"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Teacher</label>
          <SearchableSelect
            options={allTeacherOptions}
            value={allTeacherOptions.find((t) => t.value === filterTeacherId) || null}
            onChange={(opt) => setFilterTeacherId(opt ? (opt as SelectOption).value : "")}
            placeholder="All teachers"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="transferred">Transferred</option>
          </select>
        </div>
      </div>

      {/* ── Print header ────────────────────────────────────────────────── */}
      <div className="hidden print:mb-4 print:block print:rounded-lg print:border-2 print:border-indigo-600 print:bg-gradient-to-r print:from-indigo-600 print:to-sky-500 print:p-4 print:text-center print:text-white">
        <h2 className="text-xl font-extrabold tracking-wide">City College (University Campus)</h2>
        <p className="text-sm font-semibold">Allocation Report — {activeFilterSummary}</p>
        <p className="text-xs opacity-90">Generated on {new Date().toLocaleString()}</p>
      </div>

      {/* ── Allocations table ────────────────────────────────────────────── */}
      <div className="overflow-hidden card-3d card-hover print:rounded-none print:border-0">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 print:bg-indigo-600 print:text-white">
            <tr>
              <th className="px-4 py-3 print:border print:border-indigo-400">Course</th>
              <th className="px-4 py-3 print:border print:border-indigo-400">Teacher</th>
              <th className="px-4 py-3 print:border print:border-indigo-400">Class(es)</th>
              <th className="px-4 py-3 print:border print:border-indigo-400">Type</th>
              <th className="px-4 py-3 print:border print:border-indigo-400">Rate (PKR)</th>
              <th className="px-4 py-3 print:border print:border-indigo-400">Status</th>
              <th className="px-4 py-3 print:border print:border-indigo-400">Result</th>
              <th className="px-4 py-3 text-right print:hidden">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <TableLoader colSpan={8} />
            ) : filteredAllocations.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">No allocations found.</td>
              </tr>
            ) : (
              filteredAllocations.map((a, idx) => {
                const isHistOpen = historyTarget?.id === a.id;
                const hasHistory = !!a.transfer_group_id || a.status === "transferred";
                return (
                  <>
                    <tr
                      key={a.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                        a.status === "transferred" ? "opacity-70" : ""
                      } ${idx % 2 === 0 ? "print:bg-indigo-50/60" : "print:bg-white"}`}
                    >
                      <td className="px-4 py-3 print:border print:border-indigo-200">
                        <div className="font-medium text-slate-800 dark:text-slate-100 print:text-indigo-900">{a.course_code}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 print:text-slate-700">{a.course_title}</div>
                        {a.lecture_seq_offset > 0 && (
                          <div className="text-[10px] text-indigo-500">starts at lecture {a.lecture_seq_offset + 1}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 print:border print:border-indigo-200 print:text-slate-800">
                        {a.teacher_name}
                        {a.started_at && (
                          <div className="text-[10px] text-slate-400">
                            from {a.started_at}{a.end_date ? ` → ${a.end_date}` : ""}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 print:border print:border-indigo-200">
                        <div className="flex flex-wrap gap-1.5">
                          {a.semesters.map((s) => (
                            <span key={s.semester_id} className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 print:bg-transparent print:px-0 print:py-0">
                              {a.is_combined && <Layers size={11} />}
                              {s.class_name} ({s.session}) Sem {s.semester_number}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 print:border print:border-indigo-200 print:text-slate-800">{allocationTypeLabel[a.allocation_type]}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 print:border print:border-indigo-200 print:text-slate-800">{a.rate}</td>
                      <td className="px-4 py-3 print:border print:border-indigo-200">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-4 py-3 print:border print:border-indigo-200">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                          a.result_uploaded
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                        }`}>
                          {a.result_uploaded ? "Uploaded" : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3 print:hidden">
                        {!readOnly && (
                          <div className="flex items-center justify-end gap-1">
                            {/* History toggle */}
                            {hasHistory && (
                              <button
                                onClick={() => openHistory(a)}
                                title="View transfer history"
                                className={`flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 ${isHistOpen ? "text-indigo-600" : "text-slate-500"}`}
                              >
                                <History size={16} />
                              </button>
                            )}
                            {/* Transfer — only for active allocations */}
                            {a.status === "active" && (
                              <button
                                onClick={() => openTransfer(a)}
                                title="Transfer to another teacher"
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                              >
                                <ArrowRightLeft size={16} />
                              </button>
                            )}
                            {/* Edit — only for active allocations */}
                            {a.status === "active" && (
                              <button
                                onClick={() => openEdit(a)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                              >
                                <Pencil size={16} />
                              </button>
                            )}
                            {/* Delete */}
                            <button
                              onClick={() => setDeleteTarget(a)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* ── History panel (inline below the row) ──────────── */}
                    {isHistOpen && (
                      <tr key={`${a.id}-history`}>
                        <td colSpan={8} className="bg-indigo-50/40 px-4 pb-4 pt-2 dark:bg-indigo-900/10">
                          <div className="flex items-center gap-2 mb-3">
                            <History size={14} className="text-indigo-500" />
                            <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">Transfer History — {a.course_title}</span>
                          </div>
                          {historyLoading ? (
                            <p className="text-sm text-slate-400">Loading…</p>
                          ) : historyRows.length === 0 ? (
                            <p className="text-sm text-slate-400">No history found.</p>
                          ) : (
                            <div className="overflow-x-auto rounded-lg border border-indigo-100 dark:border-indigo-900">
                              <table className="w-full min-w-[600px] border-collapse text-left text-xs">
                                <thead className="bg-indigo-100/70 text-[11px] uppercase text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                                  <tr>
                                    <th className="px-3 py-2">#</th>
                                    <th className="px-3 py-2">Teacher</th>
                                    <th className="px-3 py-2">Period</th>
                                    <th className="px-3 py-2 text-center">Lectures</th>
                                    <th className="px-3 py-2 text-center">Lec # Range</th>
                                    <th className="px-3 py-2 text-center">Rate</th>
                                    <th className="px-3 py-2 text-center">Status</th>
                                    <th className="px-3 py-2">Semester(s)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-indigo-50 dark:divide-indigo-900/30">
                                  {historyRows.map((h, i) => (
                                    <>
                                      <tr key={h.id} className="hover:bg-white dark:hover:bg-indigo-900/20">
                                        <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                                        <td className="px-3 py-2">
                                          <div className="font-medium text-slate-700 dark:text-slate-200">{h.teacher_name}</div>
                                          <div className="text-[10px] text-slate-400">{h.teacher_type}</div>
                                        </td>
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                                          {h.started_at ?? "—"} → {h.end_date ?? "ongoing"}
                                        </td>
                                        <td className="px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-200">{h.total_lectures}</td>
                                        <td className="px-3 py-2 text-center text-slate-500">
                                          {h.total_lectures > 0 ? `${h.delivered_from} – ${h.delivered_to}` : "—"}
                                        </td>
                                        <td className="px-3 py-2 text-center text-slate-500">PKR {Number(h.rate).toLocaleString()}</td>
                                        <td className="px-3 py-2 text-center">
                                          <StatusBadge status={h.status} />
                                        </td>
                                        <td className="px-3 py-2">
                                          <button
                                            onClick={() => setExpandedHistId(expandedHistId === h.id ? null : h.id)}
                                            className="flex items-center gap-1 text-indigo-500 hover:underline"
                                          >
                                            {h.semesters.length} class{h.semesters.length !== 1 ? "es" : ""}
                                            {expandedHistId === h.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                          </button>
                                          {expandedHistId === h.id && (
                                            <ul className="mt-1 space-y-0.5">
                                              {h.semesters.map((s) => (
                                                <li key={s.semester_id} className="text-[10px] text-slate-500">{s.class_name} ({s.session}) Sem {s.semester_number}</li>
                                              ))}
                                            </ul>
                                          )}
                                        </td>
                                      </tr>
                                    </>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ══════════════════ CREATE MODAL ═══════════════════════════════════ */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Allocation" widthClass="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Department</label>
              <SearchableSelect
                options={departments}
                value={departments.find((d) => d.value === departmentId) || null}
                onChange={(opt) => { setDepartmentId(opt ? (opt as SelectOption).value : ""); setSession(""); setClassId(""); setCourseId(""); setTeacherId(""); }}
                placeholder="Select..."
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Session</label>
              <SearchableSelect
                options={sessionOptions}
                value={sessionOptions.find((s) => s.value === session) || null}
                onChange={(opt) => { setSession(opt ? (opt as SelectOption).value : ""); setClassId(""); }}
                placeholder="Select..."
                isDisabled={!departmentId}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Class</label>
              <SearchableSelect
                options={classOptions}
                value={classOptions.find((c) => c.value === classId) || null}
                onChange={(opt) => { setClassId(opt ? (opt as SelectOption).value : ""); setCourseId(""); }}
                placeholder="Select..."
                isDisabled={!session}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Active Semester</label>
              <input
                readOnly
                value={primarySemester ? `Semester ${primarySemester.semester_number} — ${primarySemester.term_type}` : classId ? "No active semester" : ""}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Course</label>
            <SearchableSelect
              options={availableCourseOptions}
              value={availableCourseOptions.find((c) => c.value === courseId) || null}
              onChange={(opt) => setCourseId(opt ? (opt as SelectOption).value : "")}
              placeholder={primarySemester ? "Select course..." : "Select a class with an active semester first"}
              isDisabled={!primarySemester}
            />
          </div>
          <div className="flex items-center gap-2">
            <input id="showAllTeachers" type="checkbox" checked={showAllTeachers}
              onChange={(e) => { setShowAllTeachers(e.target.checked); setTeacherId(""); }}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="showAllTeachers" className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
              <Users size={14} /> Show all teachers (not just this department)
            </label>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Teacher</label>
            <SearchableSelect
              options={teacherOptions}
              value={teacherOptions.find((t) => t.value === teacherId) || null}
              onChange={(opt) => setTeacherId(opt ? (opt as SelectOption).value : "")}
              placeholder="Search teacher..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Allocation Type</label>
              <SearchableSelect
                options={allocationTypeOptions}
                value={allocationTypeOptions.find((t) => t.value === allocationType)}
                onChange={(opt) => setAllocationType((opt as { value: string }).value as typeof allocationType)}
                isClearable={false}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Rate (PKR)</label>
              <input type="number" required min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input id="isCombined" type="checkbox" checked={isCombined}
              onChange={(e) => { setIsCombined(e.target.checked); if (!e.target.checked) setCombinedSemesterIds([]); }}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isCombined" className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
              <Layers size={14} /> Combined with another class + semester
            </label>
          </div>
          {isCombined && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Combined Classes</label>
              <SearchableSelect
                options={combinedOptions}
                value={combinedOptions.filter((o) => combinedSemesterIds.includes(o.value))}
                onChange={(opts) => setCombinedSemesterIds((opts as SelectOption[] | null)?.map((o) => o.value) ?? [])}
                placeholder="Select one or more active classes..."
                isMulti
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {saving ? "Saving..." : "Create Allocation"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══════════════════ EDIT MODAL ═════════════════════════════════════ */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Allocation" widthClass="max-w-xl">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Course</label>
            <input readOnly value={editTarget ? `${editTarget.course_code} — ${editTarget.course_title}` : ""}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
            />
            <p className="mt-1 text-xs text-slate-400">Course cannot be changed after creation. Delete and re-create to switch course.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Teacher</label>
            <SearchableSelect
              options={allTeacherOptions}
              value={allTeacherOptions.find((t) => t.value === editTeacherId) || null}
              onChange={(opt) => setEditTeacherId(opt ? (opt as SelectOption).value : "")}
              placeholder="Search teacher..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Allocation Type</label>
              <SearchableSelect
                options={allocationTypeOptions}
                value={allocationTypeOptions.find((t) => t.value === editAllocationType)}
                onChange={(opt) => setEditAllocationType((opt as { value: string }).value as typeof editAllocationType)}
                isClearable={false}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Rate (PKR)</label>
              <input type="number" required min="0" step="0.01" value={editRate} onChange={(e) => setEditRate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5"><Layers size={14} /> Classes / Semesters taught (select one or more)</span>
            </label>
            <SearchableSelect
              options={allActiveSemesterOptions}
              value={allActiveSemesterOptions.filter((o) => editSemesterIds.includes(o.value))}
              onChange={(opts) => setEditSemesterIds((opts as SelectOption[] | null)?.map((o) => o.value) ?? [])}
              placeholder="Select active classes..."
              isMulti
            />
            <p className="mt-1 text-xs text-slate-400">Selecting more than one class marks this as a combined lecture.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              Cancel
            </button>
            <button type="submit" disabled={editSaving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {editSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══════════════════ TRANSFER MODAL ═════════════════════════════════ */}
      <Modal open={transferModalOpen} onClose={() => setTransferModalOpen(false)} title="Transfer Course" widthClass="max-w-lg">
        {transferTarget && (
          <form onSubmit={handleTransferSubmit} className="space-y-4">
            {/* Info card */}
            <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {transferTarget.course_code} — {transferTarget.course_title}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Currently taught by <strong>{transferTarget.teacher_name}</strong>
              </p>
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
                The transfer date must be <strong>after</strong> the last delivered lecture. Teacher A&apos;s allocation will be closed; Teacher B will continue from the next lecture number.
              </p>
            </div>

            {/* Teacher selection */}
            <div className="flex items-center gap-2">
              <input id="showAllXfer" type="checkbox" checked={showAllXferTeachers}
                onChange={(e) => { setShowAllXferTeachers(e.target.checked); setXferTeacherId(""); }}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              <label htmlFor="showAllXfer" className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
                <Users size={13} /> Show teachers from all departments
              </label>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Transfer To (New Teacher) *</label>
              <SearchableSelect
                options={xferTeacherOptions}
                value={xferTeacherOptions.find((t) => t.value === xferTeacherId) || null}
                onChange={(opt) => setXferTeacherId(opt ? (opt as SelectOption).value : "")}
                placeholder="Search teacher..."
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Transfer Effective Date *</label>
              <input type="date" required value={xferDate} onChange={(e) => setXferDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <p className="mt-1 text-xs text-slate-400">Teacher B will start marking attendance from this date onward.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Allocation Type</label>
                <SearchableSelect
                  options={allocationTypeOptions}
                  value={allocationTypeOptions.find((t) => t.value === xferAllocType)}
                  onChange={(opt) => setXferAllocType((opt as { value: string }).value as typeof xferAllocType)}
                  isClearable={false}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Rate (PKR)</label>
                <input type="number" min="0" step="0.01" value={xferRate} onChange={(e) => setXferRate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setTransferModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                Cancel
              </button>
              <button type="submit" disabled={transferring}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
                <ArrowRightLeft size={15} /> {transferring ? "Transferring…" : "Confirm Transfer"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ══════════════════ DELETE CONFIRM ═════════════════════════════════ */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Allocation"
        message={`Remove the allocation for "${deleteTarget?.course_code}" — ${deleteTarget?.teacher_name}? This cannot be undone.`}
        confirmLabel="Remove"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
