"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { CalendarDays, FileDown, Plus, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";
import PrintableTimetable, {
  PrintableTimetableData,
} from "@/components/timetable/PrintableTimetable";
import { TableLoader } from "@/components/ui/Loaders";

interface ClassOption {
  id: string;
  department_id: string;
  class_name: string;
  session: string;
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
}

interface TimetableRow {
  id: string;
  class_id: string;
  semester_id: string;
  department_id: string;
  class_name: string;
  session: string;
  department_name: string;
  semester_number: number;
  term_type: string;
  semester_status: string;
  shift: "morning" | "evening";
  wef_date: string;
}

const shiftOptions = [
  { value: "morning", label: "Morning (8:00 AM – 1:00 PM)" },
  { value: "evening", label: "Evening (11:00 AM – 5:00 PM)" },
];

export default function TimetablesPage() {
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [semesters, setSemesters] = useState<SemesterRow[]>([]);
  const [timetables, setTimetables] = useState<TimetableRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TimetableRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [departmentId, setDepartmentId] = useState("");
  const [session, setSession] = useState("");
  const [classId, setClassId] = useState("");
  const [shift, setShift] = useState<"morning" | "evening">("morning");
  const [wefDate, setWefDate] = useState("");

  const [filterDepartmentId, setFilterDepartmentId] = useState("");
  const [filterSession, setFilterSession] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [printData, setPrintData] = useState<PrintableTimetableData[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, classRes, semRes, ttRes] = await Promise.all([
        fetch("/api/admin/departments"),
        fetch("/api/admin/classes"),
        fetch("/api/admin/semesters?status=active"),
        fetch("/api/admin/timetables"),
      ]);
      const deptData = await deptRes.json();
      const classData = await classRes.json();
      const semData = await semRes.json();
      const ttData = await ttRes.json();
      if (deptRes.ok)
        setDepartments(
          deptData.departments.map((d: { id: string; name: string }) => ({
            value: d.id,
            label: d.name,
          })),
        );
      if (classRes.ok) setClasses(classData.classes);
      if (semRes.ok) setSemesters(semData.semesters);
      if (ttRes.ok) setTimetables(ttData.timetables);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setDepartmentId("");
    setSession("");
    setClassId("");
    setShift("morning");
    setWefDate("");
  }

  function openCreate() {
    resetForm();
    setModalOpen(true);
  }

  const sessionOptions = useMemo(() => {
    const set = new Set(
      classes.filter((c) => c.department_id === departmentId).map((c) => c.session),
    );
    return Array.from(set).map((s) => ({ value: s, label: s }));
  }, [classes, departmentId]);

  const classOptions = useMemo(
    () =>
      classes
        .filter((c) => c.department_id === departmentId && c.session === session)
        .map((c) => ({ value: c.id, label: c.class_name })),
    [classes, departmentId, session],
  );

  const activeSemester = useMemo(
    () => semesters.find((s) => s.class_id === classId && s.status === "active"),
    [semesters, classId],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSemester) {
      toast.error("Selected class has no active semester.");
      return;
    }
    if (!wefDate) {
      toast.error("Please select a w.e.f. date.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/timetables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_id: departmentId,
          class_id: classId,
          semester_id: activeSemester.id,
          shift,
          wef_date: wefDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Timetable created.");
      setModalOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/timetables/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Timetable removed.");
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  const filterSessionOptions = useMemo(() => {
    const set = new Set(
      classes
        .filter((c) => !filterDepartmentId || c.department_id === filterDepartmentId)
        .map((c) => c.session),
    );
    return Array.from(set).map((s) => ({ value: s, label: s }));
  }, [classes, filterDepartmentId]);

  const filteredTimetables = useMemo(() => {
    return timetables.filter((tt) => {
      if (filterDepartmentId && tt.department_id !== filterDepartmentId) return false;
      if (filterSession && tt.session !== filterSession) return false;
      return true;
    });
  }, [timetables, filterDepartmentId, filterSession]);

  const filteredIdSet = useMemo(
    () => new Set(filteredTimetables.map((tt) => tt.id)),
    [filteredTimetables],
  );
  const visibleSelectedIds = useMemo(
    () => selectedIds.filter((id) => filteredIdSet.has(id)),
    [selectedIds, filteredIdSet],
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    if (visibleSelectedIds.length === filteredTimetables.length) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      setSelectedIds((prev) =>
        Array.from(new Set([...prev, ...filteredTimetables.map((tt) => tt.id)])),
      );
    }
  }

  async function handleBulkExport() {
    if (visibleSelectedIds.length === 0) {
      toast.error("Select at least one timetable to export.");
      return;
    }
    setExporting(true);
    try {
      const results = await Promise.all(
        visibleSelectedIds.map(async (id) => {
          const res = await fetch(`/api/admin/timetables/${id}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to load a timetable.");
          return data as PrintableTimetableData;
        }),
      );
      setPrintData(results);
      setTimeout(() => window.print(), 100);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export timetables.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Timetable Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create and manage class timetables with teacher clash detection
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleBulkExport}
            disabled={exporting || visibleSelectedIds.length === 0}
            className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FileDown size={18} /> Export Selected ({visibleSelectedIds.length})
          </button>
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus size={18} /> New Timetable
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 card-3d p-4 print:hidden sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
            Department
          </label>
          <SearchableSelect
            options={departments}
            value={departments.find((d) => d.value === filterDepartmentId) || null}
            onChange={(opt) => {
              setFilterDepartmentId(opt ? (opt as SelectOption).value : "");
              setFilterSession("");
            }}
            placeholder="All departments"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
            Session
          </label>
          <SearchableSelect
            options={filterSessionOptions}
            value={filterSessionOptions.find((s) => s.value === filterSession) || null}
            onChange={(opt) => setFilterSession(opt ? (opt as SelectOption).value : "")}
            placeholder="All sessions"
          />
        </div>
      </div>

      <div className="overflow-hidden card-3d card-hover print:hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={
                    filteredTimetables.length > 0 &&
                    visibleSelectedIds.length === filteredTimetables.length
                  }
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Semester</th>
              <th className="px-4 py-3">Shift</th>
              <th className="px-4 py-3">W.e.f</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <TableLoader colSpan={7} />
            ) : filteredTimetables.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No timetables found.
                </td>
              </tr>
            ) : (
              filteredTimetables.map((tt) => (
                <tr key={tt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={visibleSelectedIds.includes(tt.id)}
                      onChange={() => toggleSelect(tt.id)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800 dark:text-slate-100">
                      {tt.class_name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{tt.session}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {tt.department_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    Sem {tt.semester_number} — {tt.term_type}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">
                    {tt.shift}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {new Date(tt.wef_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Link
                        href={`/dashboard/admin/timetables/${tt.id}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                        title="Open grid"
                      >
                        <CalendarDays size={16} />
                      </Link>
                      <button
                        onClick={() => setDeleteTarget(tt)}
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

      {printData.length > 0 && (
        <div className="hidden print:block">
          {printData.map((d, idx) => (
            <PrintableTimetable
              key={d.timetable.id}
              data={d}
              isLast={idx === printData.length - 1}
            />
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Timetable"
        widthClass="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Department
              </label>
              <SearchableSelect
                options={departments}
                value={departments.find((d) => d.value === departmentId) || null}
                onChange={(opt) => {
                  setDepartmentId(opt ? (opt as SelectOption).value : "");
                  setSession("");
                  setClassId("");
                }}
                placeholder="Select..."
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Session
              </label>
              <SearchableSelect
                options={sessionOptions}
                value={sessionOptions.find((s) => s.value === session) || null}
                onChange={(opt) => {
                  setSession(opt ? (opt as SelectOption).value : "");
                  setClassId("");
                }}
                placeholder="Select..."
                isDisabled={!departmentId}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Class
              </label>
              <SearchableSelect
                options={classOptions}
                value={classOptions.find((c) => c.value === classId) || null}
                onChange={(opt) => setClassId(opt ? (opt as SelectOption).value : "")}
                placeholder="Select..."
                isDisabled={!session}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Active Semester
              </label>
              <input
                readOnly
                value={
                  activeSemester
                    ? `Semester ${activeSemester.semester_number} — ${activeSemester.term_type}`
                    : classId
                      ? "No active semester"
                      : ""
                }
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Shift
            </label>
            <SearchableSelect
              options={shiftOptions}
              value={shiftOptions.find((s) => s.value === shift)}
              onChange={(opt) => setShift((opt as { value: string }).value as typeof shift)}
              isClearable={false}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              W.e.f. Date
            </label>
            <input
              type="date"
              required
              value={wefDate}
              onChange={(e) => setWefDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create Timetable"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Timetable"
        message={`Delete the timetable for"${deleteTarget?.class_name}" (${deleteTarget?.session})? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
