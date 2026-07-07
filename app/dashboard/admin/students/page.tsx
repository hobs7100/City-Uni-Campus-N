"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { KeyRound, Pencil, Plus, Trash2, Upload, User } from "lucide-react";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import StatusBadge from "@/components/ui/StatusBadge";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";
import { TableLoader } from "@/components/ui/Loaders";

interface Student {
  id: string;
  name: string;
  father_name: string | null;
  cnic: string;
  contact: string | null;
  address: string | null;
  email: string;
  department_id: string;
  department_name: string;
  session: string;
  class_id: string;
  class_name: string;
  profile_image_url: string | null;
  status: "active" | "struck_off" | "left" | "dropped" | "freezed";
  status_change_date: string | null;
  status_change_semester: number | null;
}

interface ClassOption {
  id: string;
  department_id: string;
  class_name: string;
  session: string;
  total_semesters: number;
}

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "struck_off", label: "Struck Off" },
  { value: "left", label: "Left" },
  { value: "dropped", label: "Dropped" },
  { value: "freezed", label: "Freezed" },
];

const emptyForm = {
  id: "",
  name: "",
  father_name: "",
  cnic: "",
  contact: "",
  address: "",
  email: "",
  department_id: "",
  session: "",
  class_id: "",
  profile_image_url: "" as string | null,
  status: "active" as Student["status"],
  status_change_date: "",
  status_change_semester: "",
};

export default function StudentsPage() {
  const [items, setItems] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [regenTarget, setRegenTarget] = useState<Student | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stuRes, deptRes, classRes] = await Promise.all([
        fetch("/api/admin/students"),
        fetch("/api/admin/departments"),
        fetch("/api/admin/classes"),
      ]);
      const stuData = await stuRes.json();
      const deptData = await deptRes.json();
      const classData = await classRes.json();
      if (stuRes.ok) setItems(stuData.students);
      if (deptRes.ok)
        setDepartments(
          deptData.departments.map((d: { id: string; name: string }) => ({
            value: d.id,
            label: d.name,
          })),
        );
      if (classRes.ok) setClasses(classData.classes);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sessionOptions = useMemo(() => {
    const sessions = new Set(
      classes.filter((c) => c.department_id === form.department_id).map((c) => c.session),
    );
    return Array.from(sessions).map((s) => ({ value: s, label: s }));
  }, [classes, form.department_id]);

  const classOptions = useMemo(() => {
    return classes
      .filter((c) => c.department_id === form.department_id && c.session === form.session)
      .map((c) => ({ value: c.id, label: c.class_name }));
  }, [classes, form.department_id, form.session]);

  const selectedClass = classes.find((c) => c.id === form.class_id);
  const semesterOptions = useMemo(() => {
    if (!selectedClass) return [];
    return Array.from({ length: selectedClass.total_semesters }, (_, idx) => ({
      value: String(idx + 1),
      label: `Semester ${idx + 1}`,
    }));
  }, [selectedClass]);

  function openCreate() {
    setForm(emptyForm);
    setEditing(false);
    setModalOpen(true);
  }

  function openEdit(item: Student) {
    setForm({
      id: item.id,
      name: item.name,
      father_name: item.father_name || "",
      cnic: item.cnic,
      contact: item.contact || "",
      address: item.address || "",
      email: item.email,
      department_id: item.department_id,
      session: item.session,
      class_id: item.class_id,
      profile_image_url: item.profile_image_url,
      status: item.status,
      status_change_date: item.status_change_date || "",
      status_change_semester: item.status_change_semester
        ? String(item.status_change_semester)
        : "",
    });
    setEditing(true);
    setModalOpen(true);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: base64, folder: "students" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Upload failed.");
        return;
      }
      setForm((f) => ({ ...f, profile_image_url: data.url }));
      toast.success("Image uploaded.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const needsStatusFields = ["left", "dropped", "freezed"].includes(form.status);
      const payload = {
        ...form,
        status_change_date: needsStatusFields ? form.status_change_date || null : null,
        status_change_semester:
          needsStatusFields && form.status_change_semester
            ? Number(form.status_change_semester)
            : null,
      };
      const url = editing ? `/api/admin/students/${form.id}` : "/api/admin/students";
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
      if (!editing) {
        if (data.emailSent) {
          toast.success("Student created. Login credentials emailed.", { duration: 5000 });
        } else if (data.generatedPassword) {
          toast.success(`Student created. Email failed — temporary password: ${data.generatedPassword}`, { duration: 10000 });
        } else {
          toast.success("Student created.");
        }
      } else {
        toast.success("Student updated.");
      }
      setModalOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleRegen() {
    if (!regenTarget) return;
    setRegenLoading(true);
    try {
      const res = await fetch(`/api/admin/students/${regenTarget.id}/regenerate-password`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed."); return; }
      if (data.emailSent) {
        toast.success(`New password emailed to ${regenTarget.name}.`, { duration: 5000 });
      } else {
        toast.success(`Email failed. New password: ${data.newPassword}`, { duration: 10000 });
      }
      setRegenTarget(null);
    } finally {
      setRegenLoading(false);
    }
  }


  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/students/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error);
        return;
      }
      toast.success("Student removed.");
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  const needsStatusFields = ["left", "dropped", "freezed"].includes(form.status);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Student Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage student records and enrollment
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus size={18} /> Add Student
          </button>
        </div>
      </div>

      <div className="overflow-hidden card-3d card-hover">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">CNIC</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <TableLoader colSpan={7} />
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No students found.
                </td>
              </tr>
            ) : (
              items.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {s.profile_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.profile_image_url}
                          alt={s.name}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                          <User size={16} />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-100">{s.name}</p>
                        <p className="text-xs text-slate-400">{s.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.cnic}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {s.department_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.class_name}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.session}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(s)}
                        title="Edit"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setRegenTarget(s)}
                        title="Regenerate Password"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                      >
                        <KeyRound size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(s)}
                        title="Delete"
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
        title={editing ? "Edit Student" : "Add Student"}
        widthClass="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            {form.profile_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.profile_image_url}
                alt="Profile"
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                <User size={28} />
              </div>
            )}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              <Upload size={16} /> {uploading ? "Uploading..." : "Upload Photo (Optional)"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                Father Name
              </label>
              <input
                value={form.father_name}
                onChange={(e) => setForm({ ...form, father_name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                CNIC
              </label>
              <input
                required
                value={form.cnic}
                onChange={(e) => setForm({ ...form, cnic: e.target.value })}
                placeholder="XXXXX-XXXXXXX-X"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Contact
              </label>
              <input
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Address
            </label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Email{" "}
              {!editing && (
                <span className="text-xs text-slate-400">
                  (login credentials will be generated)
                </span>
              )}
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Department
              </label>
              <SearchableSelect
                options={departments}
                value={departments.find((d) => d.value === form.department_id) || null}
                onChange={(opt) =>
                  setForm({
                    ...form,
                    department_id: opt ? (opt as SelectOption).value : "",
                    session: "",
                    class_id: "",
                  })
                }
                placeholder="Select..."
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Session
              </label>
              <SearchableSelect
                options={sessionOptions}
                value={sessionOptions.find((s) => s.value === form.session) || null}
                onChange={(opt) =>
                  setForm({
                    ...form,
                    session: opt ? (opt as SelectOption).value : "",
                    class_id: "",
                  })
                }
                placeholder="Select..."
                isDisabled={!form.department_id}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Class
              </label>
              <SearchableSelect
                options={classOptions}
                value={classOptions.find((c) => c.value === form.class_id) || null}
                onChange={(opt) =>
                  setForm({ ...form, class_id: opt ? (opt as SelectOption).value : "" })
                }
                placeholder="Select..."
                isDisabled={!form.session}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Status
            </label>
            <SearchableSelect
              options={statusOptions}
              value={statusOptions.find((s) => s.value === form.status)}
              onChange={(opt) =>
                setForm({ ...form, status: (opt as { value: string }).value as Student["status"] })
              }
              isClearable={false}
            />
          </div>

          {needsStatusFields && (
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-amber-50 p-3 dark:bg-amber-500/10">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Effective Date
                </label>
                <input
                  type="date"
                  value={form.status_change_date}
                  onChange={(e) => setForm({ ...form, status_change_date: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Semester
                </label>
                <SearchableSelect
                  options={semesterOptions}
                  value={
                    semesterOptions.find((s) => s.value === form.status_change_semester) || null
                  }
                  onChange={(opt) =>
                    setForm({
                      ...form,
                      status_change_semester: opt ? (opt as SelectOption).value : "",
                    })
                  }
                  placeholder="Select semester..."
                />
              </div>
            </div>
          )}

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
        title="Remove Student"
        message={`Are you sure you want to remove ${deleteTarget?.name}?`}
        confirmLabel="Remove"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!regenTarget}
        title="Regenerate Password"
        message={`Generate a new password for ${regenTarget?.name} and email it to ${regenTarget?.email}?`}
        confirmLabel="Regenerate & Email"
        loading={regenLoading}
        onConfirm={handleRegen}
        onCancel={() => setRegenTarget(null)}
      />

    </div>
  );
}
