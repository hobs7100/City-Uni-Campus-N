"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import StatusBadge from "@/components/ui/StatusBadge";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";

interface Teacher {
  id: string;
  name: string;
  department_id: string;
  department_name: string;
  phone: string | null;
  email: string;
  type: "permanent" | "visiting";
  workload_credit_hours: number | null;
  rate_per_hour: number | null;
  bank_name: string | null;
  account_title: string | null;
  account_number: string | null;
  status: "active" | "blocked";
}

const typeOptions = [
  { value: "permanent", label: "Permanent" },
  { value: "visiting", label: "Visiting" },
];

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "blocked", label: "Blocked" },
];

const emptyForm = {
  id: "",
  name: "",
  department_id: "",
  phone: "",
  email: "",
  type: "permanent" as Teacher["type"],
  workload_credit_hours: "",
  rate_per_hour: "",
  bank_name: "",
  account_title: "",
  account_number: "",
  status: "active" as "active" | "blocked",
};

export default function TeachersPage() {
  const [items, setItems] = useState<Teacher[]>([]);
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [teacherRes, deptRes] = await Promise.all([
        fetch("/api/admin/teachers"),
        fetch("/api/admin/departments"),
      ]);
      const teacherData = await teacherRes.json();
      const deptData = await deptRes.json();
      if (teacherRes.ok) setItems(teacherData.teachers);
      if (deptRes.ok)
        setDepartments(deptData.departments.map((d: { id: string; name: string }) => ({ value: d.id, label: d.name })));
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

  function openEdit(item: Teacher) {
    setForm({
      id: item.id,
      name: item.name,
      department_id: item.department_id,
      phone: item.phone || "",
      email: item.email,
      type: item.type,
      workload_credit_hours: item.workload_credit_hours ? String(item.workload_credit_hours) : "",
      rate_per_hour: item.rate_per_hour ? String(item.rate_per_hour) : "",
      bank_name: item.bank_name || "",
      account_title: item.account_title || "",
      account_number: item.account_number || "",
      status: item.status,
    });
    setEditing(true);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        workload_credit_hours: form.type === "permanent" && form.workload_credit_hours ? Number(form.workload_credit_hours) : null,
        rate_per_hour: form.rate_per_hour ? Number(form.rate_per_hour) : null,
      };
      const url = editing ? `/api/admin/teachers/${form.id}` : "/api/admin/teachers";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      if (!editing && data.generatedPassword) {
        toast.success(`Teacher created. Temporary password: ${data.generatedPassword}`, { duration: 8000 });
      } else {
        toast.success("Teacher updated.");
      }
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
      const res = await fetch(`/api/admin/teachers/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error);
        return;
      }
      toast.success("Teacher removed.");
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
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Teacher Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage permanent and visiting faculty</p>
        </div>
        <button onClick={openCreate} className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
          <Plus size={18} /> Add Teacher
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Teacher</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400"><Loader2 className="mx-auto animate-spin" /></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No teachers found.</td></tr>
            ) : (
              items.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{t.department_name}</td>
                  <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">{t.type}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{t.phone || "-"}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(t)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil size={16} /></button>
                      <button onClick={() => setDeleteTarget(t)} className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Teacher" : "Add Teacher"} widthClass="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Department</label>
              <SearchableSelect
                options={departments}
                value={departments.find((d) => d.value === form.department_id) || null}
                onChange={(opt) => setForm({ ...form, department_id: opt ? (opt as SelectOption).value : "" })}
                placeholder="Select..."
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email {!editing && <span className="text-xs text-slate-400">(login credentials will be generated)</span>}
              </label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Employment Type</label>
            <SearchableSelect
              options={typeOptions}
              value={typeOptions.find((t) => t.value === form.type)}
              onChange={(opt) => setForm({ ...form, type: (opt as { value: string }).value as Teacher["type"] })}
              isClearable={false}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
            {form.type === "permanent" ? (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Workload (Credit Hours)</label>
                <input type="number" step="0.5" value={form.workload_credit_hours} onChange={(e) => setForm({ ...form, workload_credit_hours: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Rate per Hour</label>
                <input type="number" step="0.01" value={form.rate_per_hour} onChange={(e) => setForm({ ...form, rate_per_hour: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Bank Name</label>
              <input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Account Title</label>
              <input value={form.account_title} onChange={(e) => setForm({ ...form, account_title: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Account Number</label>
              <input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
            <SearchableSelect
              options={statusOptions}
              value={statusOptions.find((s) => s.value === form.status)}
              onChange={(opt) => setForm({ ...form, status: (opt as { value: string }).value as "active" | "blocked" })}
              isClearable={false}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {saving ? "Saving..." : editing ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Teacher"
        message={`Are you sure you want to remove ${deleteTarget?.name}?`}
        confirmLabel="Remove"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
