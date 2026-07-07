"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import StatusBadge from "@/components/ui/StatusBadge";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";
import { TableLoader } from "@/components/ui/Loaders";
import { useUserRole } from "@/lib/roleContext";

interface Department {
  id: string;
  name: string;
  hod_id: string | null;
  coordinator_id: string | null;
  hod_name: string | null;
  coordinator_name: string | null;
  status: "active" | "blocked";
}

const emptyForm = {
  id: "",
  name: "",
  hod_id: null as string | null,
  coordinator_id: null as string | null,
  status: "active" as "active" | "blocked",
};

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "blocked", label: "Blocked" },
];

export default function DepartmentsPage() {
  const readOnly = useUserRole() === "finance_manager";
  const [items, setItems] = useState<Department[]>([]);
  const [hods, setHods] = useState<SelectOption[]>([]);
  const [coordinators, setCoordinators] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, hodRes, coordRes] = await Promise.all([
        fetch("/api/admin/departments"),
        fetch("/api/admin/users?role=hod"),
        fetch("/api/admin/users?role=coordinator"),
      ]);
      const deptData = await deptRes.json();
      const hodData = await hodRes.json();
      const coordData = await coordRes.json();
      if (deptRes.ok) setItems(deptData.departments);
      if (hodRes.ok)
        setHods(
          hodData.users.map((u: { id: string; name: string }) => ({ value: u.id, label: u.name })),
        );
      if (coordRes.ok)
        setCoordinators(
          coordData.users.map((u: { id: string; name: string }) => ({
            value: u.id,
            label: u.name,
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

  function openEdit(item: Department) {
    setForm({
      id: item.id,
      name: item.name,
      hod_id: item.hod_id,
      coordinator_id: item.coordinator_id,
      status: item.status,
    });
    setEditing(true);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editing ? `/api/admin/departments/${form.id}` : "/api/admin/departments";
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
      toast.success(editing ? "Faculty updated." : "Faculty created.");
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
      const res = await fetch(`/api/admin/departments/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error);
        return;
      }
      toast.success("Faculty deleted.");
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
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Faculty Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Assign HoDs and Coordinators to departments
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus size={18} /> Add Faculty
          </button>
        )}
      </div>

      <div className="overflow-hidden card-3d card-hover">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Faculty</th>
              <th className="px-4 py-3">HoD</th>
              <th className="px-4 py-3">Coordinator</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <TableLoader colSpan={5} />
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No departments found.
                </td>
              </tr>
            ) : (
              items.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                    {d.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {d.hod_name || "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {d.coordinator_name || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-3">
                    {!readOnly && (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(d)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(d)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
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
        title={editing ? "Edit Faculty" : "Add Faculty"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Faculty Name
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Head of Department
            </label>
            <SearchableSelect
              options={hods}
              value={hods.find((h) => h.value === form.hod_id) || null}
              onChange={(opt) =>
                setForm({ ...form, hod_id: opt ? (opt as SelectOption).value : null })
              }
              placeholder="Select HoD..."
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Coordinator
            </label>
            <SearchableSelect
              options={coordinators}
              value={coordinators.find((c) => c.value === form.coordinator_id) || null}
              onChange={(opt) =>
                setForm({ ...form, coordinator_id: opt ? (opt as SelectOption).value : null })
              }
              placeholder="Select Coordinator..."
            />
          </div>
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
        title="Delete Faculty"
        message={`Are you sure you want to delete"${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
