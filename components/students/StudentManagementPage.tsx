"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  GraduationCap, KeyRound, Pencil, Plus, Search, Trash2, Upload, User, Users, UserX,
} from "lucide-react";
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
  status_changed_by_name: string | null;
}

interface ClassOption {
  id: string;
  department_id: string;
  class_name: string;
  session: string;
  total_semesters: number;
}

const statusOptions = [
  { value: "active",    label: "Active" },
  { value: "struck_off", label: "Struck Off" },
  { value: "left",      label: "Left" },
  { value: "dropped",   label: "Dropped" },
  { value: "freezed",   label: "Freezed" },
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

type Tab = "active" | "struck_off";

interface Props {
  /** "admin" | "coordinator" | "hod" — controls which action buttons appear */
  role: "admin" | "coordinator" | "hod";
}

export default function StudentManagementPage({ role }: Props) {
  const canAdd    = role === "admin" || role === "coordinator";
  const canDelete = role === "admin" || role === "coordinator";
  const canRegen  = role === "admin" || role === "coordinator";

  const [tab, setTab] = useState<Tab>("active");
  const [items, setItems] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);

  // filters (shared across tabs)
  const [search, setSearch] = useState("");
  const [filterClassId, setFilterClassId] = useState<string>("");

  // form / modal
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // confirm dialogs
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [regenTarget, setRegenTarget] = useState<Student | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [stuRes, deptRes, classRes] = await Promise.all([
        fetch("/api/admin/students"),
        fetch("/api/admin/departments"),
        fetch("/api/admin/classes"),
      ]);
      const stuData  = await stuRes.json();
      const deptData = await deptRes.json();
      const classData = await classRes.json();
      if (stuRes.ok)   setItems(stuData.students ?? []);
      if (deptRes.ok)  setDepartments(deptData.departments.map((d: { id: string; name: string }) => ({ value: d.id, label: d.name })));
      if (classRes.ok) setClasses(classData.classes ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Class+Session dropdown options (for filter) ──────────────────────────
  const classSessionOptions: SelectOption[] = useMemo(() => {
    const seen = new Set<string>();
    const opts: SelectOption[] = [];
    classes.forEach((c) => {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        opts.push({ value: c.id, label: `${c.class_name} (${c.session})` });
      }
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [classes]);

  // ── Derived filtered lists ───────────────────────────────────────────────
  const activeStudents = useMemo(() => {
    return items.filter((s) => {
      if (s.status !== "active") return false;
      if (filterClassId && s.class_id !== filterClassId) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, search, filterClassId]);

  const struckOffStudents = useMemo(() => {
    return items.filter((s) => {
      if (s.status !== "struck_off") return false;
      if (filterClassId && s.class_id !== filterClassId) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, search, filterClassId]);

  // Group struck-off students by Class + Session + Semester
  const struckOffGroups = useMemo(() => {
    const map = new Map<string, { label: string; classLabel: string; semLabel: string; students: Student[] }>();
    struckOffStudents.forEach((s) => {
      const sem = s.status_change_semester ? `Semester ${s.status_change_semester}` : "Semester N/A";
      const key = `${s.class_id}__${sem}`;
      if (!map.has(key)) {
        map.set(key, {
          label: `${s.class_name} (${s.session}) — ${sem}`,
          classLabel: `${s.class_name} (${s.session})`,
          semLabel: sem,
          students: [],
        });
      }
      map.get(key)!.students.push(s);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [struckOffStudents]);

  // ── Form helpers ─────────────────────────────────────────────────────────
  const sessionOptions = useMemo(() => {
    const sessions = new Set(classes.filter((c) => c.department_id === form.department_id).map((c) => c.session));
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
      status_change_semester: item.status_change_semester ? String(item.status_change_semester) : "",
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
      if (!res.ok) { toast.error(data.error || "Upload failed."); return; }
      setForm((f) => ({ ...f, profile_image_url: data.url }));
      toast.success("Image uploaded.");
    } finally { setUploading(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const needsStatusFields = ["left", "dropped", "freezed"].includes(form.status);
      const payload = {
        ...form,
        status_change_date: needsStatusFields ? form.status_change_date || null : null,
        status_change_semester: needsStatusFields && form.status_change_semester ? Number(form.status_change_semester) : null,
      };
      const url    = editing ? `/api/admin/students/${form.id}` : "/api/admin/students";
      const method = editing ? "PATCH" : "POST";
      const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Something went wrong."); return; }
      if (!editing) {
        if (data.emailSent) toast.success("Student created. Login credentials emailed.", { duration: 5000 });
        else if (data.generatedPassword) toast.success(`Student created. Email failed — password: ${data.generatedPassword}`, { duration: 10000 });
        else toast.success("Student created.");
      } else {
        toast.success("Student updated.");
      }
      setModalOpen(false);
      load();
    } finally { setSaving(false); }
  }

  async function handleRegen() {
    if (!regenTarget) return;
    setRegenLoading(true);
    try {
      const res  = await fetch(`/api/admin/students/${regenTarget.id}/regenerate-password`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed."); return; }
      if (data.emailSent) toast.success(`New password emailed to ${regenTarget.name}.`, { duration: 5000 });
      else toast.success(`Email failed. New password: ${data.newPassword}`, { duration: 10000 });
      setRegenTarget(null);
    } finally { setRegenLoading(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res  = await fetch(`/api/admin/students/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success("Student removed.");
      setDeleteTarget(null);
      load();
    } finally { setDeleting(false); }
  }

  const needsStatusFields = ["left", "dropped", "freezed"].includes(form.status);

  // ── Shared filter bar ────────────────────────────────────────────────────
  const FilterBar = () => (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by student name…"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
        />
      </div>
      <div className="w-full sm:w-72">
        <SearchableSelect
          options={classSessionOptions}
          value={classSessionOptions.find((o) => o.value === filterClassId) || null}
          onChange={(opt) => setFilterClassId(opt ? (opt as SelectOption).value : "")}
          placeholder="Filter by Class + Session…"
          isClearable
        />
      </div>
    </div>
  );

  // ── Student row cells (shared between both tabs' tables) ─────────────────
  const StudentRow = ({ s }: { s: Student }) => (
    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {s.profile_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.profile_image_url} alt={s.name} className="h-8 w-8 rounded-full object-cover" />
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
      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.department_name}</td>
      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.class_name}</td>
      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.session}</td>
      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-sm">
        {s.status_changed_by_name ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <button onClick={() => openEdit(s)} title="Edit"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <Pencil size={16} />
          </button>
          {canRegen && (
            <button onClick={() => setRegenTarget(s)} title="Regenerate Password"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10">
              <KeyRound size={16} />
            </button>
          )}
          {canDelete && (
            <button onClick={() => setDeleteTarget(s)} title="Delete"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );

  const tableHead = (
    <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
      <tr>
        <th className="px-4 py-3">Student</th>
        <th className="px-4 py-3">CNIC</th>
        <th className="px-4 py-3">Department</th>
        <th className="px-4 py-3">Class</th>
        <th className="px-4 py-3">Session</th>
        <th className="px-4 py-3">Status</th>
        <th className="px-4 py-3">Status Changed By</th>
        <th className="px-4 py-3 text-right">Actions</th>
      </tr>
    </thead>
  );

  const activeCount    = items.filter((s) => s.status === "active").length;
  const struckOffCount = items.filter((s) => s.status === "struck_off").length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Student Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage student records and enrollment</p>
        </div>
        {canAdd && (
          <button onClick={openCreate}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
            <Plus size={18} /> Add Student
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60 w-fit">
        <button
          onClick={() => setTab("active")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === "active"
              ? "bg-white text-indigo-700 shadow dark:bg-slate-700 dark:text-indigo-400"
              : "text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Users size={15} />
          Active
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            tab === "active" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
          }`}>{activeCount}</span>
        </button>
        <button
          onClick={() => setTab("struck_off")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === "struck_off"
              ? "bg-white text-red-600 shadow dark:bg-slate-700 dark:text-red-400"
              : "text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <UserX size={15} />
          Struck Off
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            tab === "struck_off" ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
          }`}>{struckOffCount}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <FilterBar />

      {/* ── Active Tab ─────────────────────────────────────────────────── */}
      {tab === "active" && (
        <div className="overflow-hidden card-3d card-hover">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              {tableHead}
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <TableLoader colSpan={8} />
                ) : activeStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <GraduationCap size={32} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-slate-400">No active students found.</p>
                    </td>
                  </tr>
                ) : (
                  activeStudents.map((s) => <StudentRow key={s.id} s={s} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Struck Off Tab ─────────────────────────────────────────────── */}
      {tab === "struck_off" && (
        <div className="space-y-6">
          {loading ? (
            <div className="overflow-hidden card-3d"><table className="w-full text-sm"><tbody><TableLoader colSpan={8} /></tbody></table></div>
          ) : struckOffGroups.length === 0 ? (
            <div className="card-3d flex flex-col items-center justify-center py-16 text-center">
              <UserX size={40} className="mb-3 text-slate-300" />
              <p className="text-slate-400">No struck off students found.</p>
            </div>
          ) : (
            struckOffGroups.map((group) => (
              <div key={group.label} className="overflow-hidden card-3d card-hover">
                {/* Group header */}
                <div className="flex items-center gap-3 border-b border-slate-200 bg-gradient-to-r from-red-50 to-orange-50 px-4 py-3 dark:border-slate-700 dark:from-red-900/20 dark:to-orange-900/10">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-500/20">
                    <UserX size={16} className="text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{group.classLabel}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{group.semLabel} · {group.students.length} student{group.students.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    {tableHead}
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {group.students.map((s) => <StudentRow key={s.id} s={s} />)}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Add / Edit Modal ─────────────────────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? "Edit Student" : "Add Student"} widthClass="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            {form.profile_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.profile_image_url} alt="Profile" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                <User size={28} />
              </div>
            )}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              <Upload size={16} /> {uploading ? "Uploading..." : "Upload Photo (Optional)"}
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Father Name</label>
              <input value={form.father_name} onChange={(e) => setForm({ ...form, father_name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">CNIC</label>
              <input required value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })}
                placeholder="XXXXX-XXXXXXX-X"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Contact</label>
              <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Address</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Email{" "}
              {!editing && <span className="text-xs text-slate-400">(login credentials will be generated)</span>}
            </label>
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Department</label>
              <SearchableSelect options={departments}
                value={departments.find((d) => d.value === form.department_id) || null}
                onChange={(opt) => setForm({ ...form, department_id: opt ? (opt as SelectOption).value : "", session: "", class_id: "" })}
                placeholder="Select..." />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Session</label>
              <SearchableSelect options={sessionOptions}
                value={sessionOptions.find((s) => s.value === form.session) || null}
                onChange={(opt) => setForm({ ...form, session: opt ? (opt as SelectOption).value : "", class_id: "" })}
                placeholder="Select..." isDisabled={!form.department_id} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Class</label>
              <SearchableSelect options={classOptions}
                value={classOptions.find((c) => c.value === form.class_id) || null}
                onChange={(opt) => setForm({ ...form, class_id: opt ? (opt as SelectOption).value : "" })}
                placeholder="Select..." isDisabled={!form.session} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
            <SearchableSelect options={statusOptions}
              value={statusOptions.find((s) => s.value === form.status)}
              onChange={(opt) => setForm({ ...form, status: (opt as { value: string }).value as Student["status"] })}
              isClearable={false} />
          </div>

          {needsStatusFields && (
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-amber-50 p-3 dark:bg-amber-500/10">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Effective Date</label>
                <input type="date" value={form.status_change_date}
                  onChange={(e) => setForm({ ...form, status_change_date: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Semester</label>
                <SearchableSelect options={semesterOptions}
                  value={semesterOptions.find((s) => s.value === form.status_change_semester) || null}
                  onChange={(opt) => setForm({ ...form, status_change_semester: opt ? (opt as SelectOption).value : "" })}
                  placeholder="Select semester..." />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Student"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm: Delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Student"
        message={`Remove ${deleteTarget?.name}? This action soft-deletes the record.`}
        confirmLabel="Remove"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
        danger
      />

      {/* Confirm: Regen password */}
      <ConfirmDialog
        open={!!regenTarget}
        title="Regenerate Password"
        message={`Generate a new password for ${regenTarget?.name} and send it to their email?`}
        confirmLabel="Regenerate"
        onConfirm={handleRegen}
        onCancel={() => setRegenTarget(null)}
        loading={regenLoading}
      />
    </div>
  );
}
