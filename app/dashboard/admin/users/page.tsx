"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { KeyRound, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import StatusBadge from "@/components/ui/StatusBadge";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { DataFetchLoader } from "@/components/ui/Loaders";

interface UserRow {
  id: string;
  name: string;
  email: string;
  cellno: string | null;
  role: "admin" | "hod" | "coordinator" | "finance_manager";
  status: "active" | "blocked";
  created_at: string;
}

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "hod", label: "HoD" },
  { value: "coordinator", label: "Coordinator" },
  { value: "finance_manager", label: "Finance Manager" },
];

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "blocked", label: "Blocked" },
];

const emptyForm = {
  id: "",
  name: "",
  email: "",
  cellno: "",
  role: "coordinator" as UserRow["role"],
  status: "active" as UserRow["status"],
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [regenTarget, setRegenTarget] = useState<UserRow | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (res.ok) setUsers(data.users);
      else toast.error(data.error || "Failed to load users.");
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

  function openEdit(user: UserRow) {
    setForm({
      id: user.id,
      name: user.name,
      email: user.email,
      cellno: user.cellno || "",
      role: user.role,
      status: user.status,
    });
    setEditing(true);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editing ? `/api/admin/users/${form.id}` : "/api/admin/users";
      const method = editing ? "PATCH" : "POST";
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        cellno: form.cellno,
        role: form.role,
        status: form.status,
      };

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
      if (!editing) {
        if (data.emailSent) {
          toast.success("User created and welcome email sent.");
        } else {
          toast.error(
            `User created, but the welcome email failed to send${
              data.generatedPassword ? ` (password: ${data.generatedPassword})` : ""
            }. ${data.emailError || ""}`,
            { duration: 10000 },
          );
        }
      } else {
        toast.success("User updated.");
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
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to delete user.");
        return;
      }
      toast.success("User removed.");
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  async function handleRegeneratePassword() {
    if (!regenTarget) return;
    setRegenerating(true);
    try {
      const res = await fetch(`/api/admin/users/${regenTarget.id}/regenerate-password`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to regenerate password.");
        return;
      }
      if (data.emailSent) {
        toast.success("Password regenerated and emailed to the user.");
      } else {
        toast.error(
          `Password regenerated, but the email failed to send${
            data.generatedPassword ? ` (password: ${data.generatedPassword})` : ""
          }. ${data.emailError || ""}`,
          { duration: 10000 },
        );
      }
      setRegenTarget(null);
    } finally {
      setRegenerating(false);
    }
  }

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">User Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage Admin, HoD, and Coordinator accounts
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Plus size={18} /> Add User
        </button>
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
      </div>

      <div className="overflow-hidden card-3d card-hover">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Cell No</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  <DataFetchLoader />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No users found.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                    {u.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {u.cellno || "-"}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">
                    {u.role}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(u)}
                        title="Edit user"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setRegenTarget(u)}
                        title="Regenerate password"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                      >
                        <KeyRound size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(u)}
                        title="Remove user"
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
        title={editing ? "Edit User" : "Add User"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Name
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
              Email
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          {!editing && (
            <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
              A password will be auto-generated and emailed to this user. They can change it after logging in.
            </p>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Cell No
            </label>
            <input
              value={form.cellno}
              onChange={(e) => setForm({ ...form, cellno: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Role
              </label>
              <SearchableSelect
                options={roleOptions}
                value={roleOptions.find((r) => r.value === form.role)}
                onChange={(opt) =>
                  setForm({ ...form, role: (opt as { value: string }).value as UserRow["role"] })
                }
                isClearable={false}
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
                    status: (opt as { value: string }).value as UserRow["status"],
                  })
                }
                isClearable={false}
              />
            </div>
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
              {saving ? "Saving..." : editing ? "Save Changes" : "Create User"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove User"
        message={`Are you sure you want to remove ${deleteTarget?.name}? This action can be reversed by an administrator later.`}
        confirmLabel="Remove"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!regenTarget}
        title="Regenerate Password"
        message={`A new password will be generated for ${regenTarget?.name} and emailed to ${regenTarget?.email}. Continue?`}
        confirmLabel="Regenerate & Send"
        loading={regenerating}
        onConfirm={handleRegeneratePassword}
        onCancel={() => setRegenTarget(null)}
      />
    </div>
  );
}
