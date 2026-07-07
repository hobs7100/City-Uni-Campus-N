"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import StatusBadge from "@/components/ui/StatusBadge";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";
import { TableLoader } from "@/components/ui/Loaders";

interface ClassRow {
  id: string;
  department_id: string;
  department_name: string;
  class_name: string;
  session: string;
  affiliation_id: string | null;
  university_name: string | null;
  type: "ADP" | "BS" | "DIT" | "LLB" | "BS-Bridging";
  total_semesters: number;
  status: "active" | "blocked";
}

const typeOptions = [
  { value: "ADP", label: "ADP" },
  { value: "BS-Bridging", label: "BS-Bridging (4 Semesters)" },
  { value: "BS", label: "BS" },
  { value: "DIT", label: "DIT" },
  { value: "LLB", label: "LLB" },
];

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "blocked", label: "Blocked" },
];

const semestersByType: Record<string, number> = { ADP: 4, DIT: 4, BS: 8, LLB: 8 };

const emptyForm = {
  id: "",
  department_id: "",
  class_name: "",
  session: "",
  affiliation_id: null as string | null,
  type: "BS" as ClassRow["type"],
  status: "active" as "active" | "blocked",
};

export default function ClassesPage() {
  const [items, setItems] = useState<ClassRow[]>([]);
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [affiliations, setAffiliations] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<ClassRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [classRes, deptRes, affRes] = await Promise.all([
        fetch("/api/admin/classes"),
        fetch("/api/admin/departments"),
        fetch("/api/admin/affiliations"),
      ]);
      const classData = await classRes.json();
      const deptData = await deptRes.json();
      const affData = await affRes.json();
      if (classRes.ok) setItems(classData.classes);
      if (deptRes.ok)
        setDepartments(
          deptData.departments.map((d: { id: string; name: string }) => ({
            value: d.id,
            label: d.name,
          })),
        );
      if (affRes.ok)
        setAffiliations(
          affData.affiliations.map((a: { id: string; university_name: string }) => ({
            value: a.id,
            label: a.university_name,
          })),
        );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setForm(emptyForm);
    setEditing(false);
    setModalOpen(true);
  }

  function openEdit(item: ClassRow) {
    setForm({
      id: item.id,
      department_id: item.department_id,
      class_name: item.class_name,
      session: item.session,
      affiliation_id: item.affiliation_id,
      type: item.type,
      status: item.status,
    });
    setEditing(true);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editing ? `/api/admin/classes/${form.id}` : "/api/admin/classes";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success(editing ? "Class updated." : "Class created.");
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
      const res = await fetch(`/api/admin/classes/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error);
        return;
      }
      toast.success("Class deleted.");
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Class Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage classes, sessions, and semester structure
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Plus size={18} /> Add Class
        </button>
      </div>

      <div className="overflow-hidden card-3d card-hover">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">University</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Semesters</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <TableLoader colSpan={8} />
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  No classes found.
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                    {c.class_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {c.department_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.session}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {c.university_name || "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.type}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {c.total_semesters}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(c)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Class" : "Add Class"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Department
            </label>
            <SearchableSelect
              options={departments}
              value={departments.find((d) => d.value === form.department_id) || null}
              onChange={(opt) =>
                setForm({ ...form, department_id: opt ? (opt as SelectOption).value : "" })
              }
              placeholder="Select department..."
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Class Name
            </label>
            <input
              required
              value={form.class_name}
              onChange={(e) => setForm({ ...form, class_name: e.target.value })}
              placeholder="e.g. BSCS Morning"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Session
              </label>
              <input
                required
                value={form.session}
                onChange={(e) => setForm({ ...form, session: e.target.value })}
                placeholder="e.g. 2021-25"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Type
              </label>
              <SearchableSelect
                options={typeOptions}
                value={typeOptions.find((t) => t.value === form.type)}
                onChange={(opt) =>
                  setForm({ ...form, type: (opt as { value: string }).value as ClassRow["type"] })
                }
                isClearable={false}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              University Affiliation
            </label>
            <SearchableSelect
              options={affiliations}
              value={affiliations.find((a) => a.value === form.affiliation_id) || null}
              onChange={(opt) =>
                setForm({ ...form, affiliation_id: opt ? (opt as SelectOption).value : null })
              }
              placeholder="Select university..."
            />
          </div>
          <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
            This class will have <strong>{semestersByType[form.type]}</strong> semesters
            (auto-calculated from type).
          </p>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Status
            </label>
            <SearchableSelect
              options={statusOptions}
              value={statusOptions.find((s) => s.value === form.status)}
              onChange={(opt) =>
                setForm({
                  ...form,
                  status: (opt as { value: string }).value as "active" | "blocked",
                })
              }
              isClearable={false}
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
              {saving ? "Saving..." : editing ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Class"
        message={`Are you sure you want to delete"${deleteTarget?.class_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
