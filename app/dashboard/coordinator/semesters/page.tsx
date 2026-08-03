"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { BookOpen, Calendar, CheckCircle, FileDown, Lock, Pencil, Play, Plus, Upload, X } from "lucide-react";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";
import StatusBadge from "@/components/ui/StatusBadge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import { DataFetchLoader } from "@/components/ui/Loaders";

interface ClassOption {
  id: string;
  department_id: string;
  class_name: string;
  session: string;
  total_semesters: number;
}

interface CourseOption {
  id: string;
  code: string;
  title: string;
  department_id: string;
  credit_hours: string;
  status: "active" | "blocked";
}

interface SemesterCourse {
  id: string;
  code: string;
  title: string;
  credit_hours: string;
  outline_url: string | null;
  outline_public_id: string | null;
}

interface Semester {
  id: string;
  class_id: string;
  department_id: string;
  class_name: string;
  session: string;
  department_name: string;
  semester_number: number;
  term_type: "Fall" | "Spring";
  start_date: string;
  close_date: string | null;
  status: "active" | "closed";
  courses: SemesterCourse[];
}

const termOptions = [
  { value: "Fall", label: "Fall" },
  { value: "Spring", label: "Spring" },
];

export default function SemestersPage() {
  const [tab, setTab] = useState<"start" | "close" | "history">("start");
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);

  const [departmentId, setDepartmentId] = useState("");
  const [session, setSession] = useState("");
  const [classId, setClassId] = useState("");
  const [semesterNumber, setSemesterNumber] = useState<string>("");
  const [termType, setTermType] = useState<"Fall" | "Spring">("Fall");
  const [startDate, setStartDate] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);

  const [closeDepartmentId, setCloseDepartmentId] = useState("");
  const [closeClassId, setCloseClassId] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSemester, setEditSemester] = useState<Semester | null>(null);
  const [editTermType, setEditTermType] = useState<"Fall" | "Spring">("Fall");
  const [editStartDate, setEditStartDate] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [addCourseId, setAddCourseId] = useState("");
  const [addingCourse, setAddingCourse] = useState(false);
  const [removingCourseId, setRemovingCourseId] = useState<string | null>(null);
  const [outlineUploading, setOutlineUploading] = useState<Record<string, boolean>>({});
  const [newSemesterId, setNewSemesterId] = useState<string | null>(null);
  const [newSemesterCourses, setNewSemesterCourses] = useState<
    { id: string; code: string; title: string; outline_url: string | null }[]
  >([]);
  const [postStartUploading, setPostStartUploading] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, classRes, courseRes, semRes] = await Promise.all([
        fetch("/api/admin/departments"),
        fetch("/api/admin/classes"),
        fetch("/api/admin/courses"),
        fetch("/api/admin/semesters"),
      ]);
      const deptData = await deptRes.json();
      const classData = await classRes.json();
      const courseData = await courseRes.json();
      const semData = await semRes.json();
      if (deptRes.ok)
        setDepartments(
          deptData.departments.map((d: { id: string; name: string }) => ({
            value: d.id,
            label: d.name,
          })),
        );
      if (classRes.ok) setClasses(classData.classes);
      if (courseRes.ok) setCourses(courseData.courses);
      if (semRes.ok) setSemesters(semData.semesters);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sessionOptions = useMemo(() => {
    const sessions = new Set(
      classes.filter((c) => c.department_id === departmentId).map((c) => c.session),
    );
    return Array.from(sessions).map((s) => ({ value: s, label: s }));
  }, [classes, departmentId]);

  const classOptions = useMemo(
    () =>
      classes
        .filter((c) => c.department_id === departmentId && c.session === session)
        .map((c) => ({ value: c.id, label: c.class_name })),
    [classes, departmentId, session],
  );

  const selectedClass = classes.find((c) => c.id === classId);
  const semesterNumberOptions = useMemo(() => {
    if (!selectedClass) return [];
    return Array.from({ length: selectedClass.total_semesters }, (_, idx) => ({
      value: String(idx + 1),
      label: `Semester ${idx + 1}`,
    }));
  }, [selectedClass]);

  const availableCourses = useMemo(
    () => courses.filter((c) => c.department_id === departmentId && c.status !== "blocked"),
    [courses, departmentId],
  );
  const courseOptions = availableCourses.map((c) => ({
    value: c.id,
    label: `${c.code} — ${c.title} (${c.credit_hours} Cr)`,
  }));
  const selectedCoursesDetail = availableCourses.filter((c) => selectedCourseIds.includes(c.id));

  const editCourseOptions = useMemo(() => {
    if (!editSemester) return [];
    const existingIds = new Set(editSemester.courses.map((c) => c.id));
    return courses
      .filter((c) => c.department_id === editSemester.department_id)
      .filter((c) => !existingIds.has(c.id))
      .filter((c) => c.status !== "blocked")
      .map((c) => ({ value: c.id, label: `${c.code} — ${c.title} (${c.credit_hours} Cr)` }));
  }, [courses, editSemester]);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    if (!classId || !semesterNumber || !startDate || selectedCourseIds.length === 0) {
      toast.error("Please fill all required fields and select at least one course.");
      return;
    }
    setStarting(true);
    try {
      const res = await fetch("/api/admin/semesters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_id: departmentId,
          class_id: classId,
          semester_number: Number(semesterNumber),
          term_type: termType,
          start_date: startDate,
          course_ids: selectedCourseIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Semester started successfully.");
      setNewSemesterId(data.semester.id);
      setNewSemesterCourses(
        selectedCoursesDetail.map((c) => ({ id: c.id, code: c.code, title: c.title, outline_url: null }))
      );
      setDepartmentId("");
      setSession("");
      setClassId("");
      setSemesterNumber("");
      setTermType("Fall");
      setStartDate("");
      setSelectedCourseIds([]);
      load();
    } finally {
      setStarting(false);
    }
  }

  const closeSessionOptions = useMemo(() => {
    const sessions = new Set(
      classes.filter((c) => c.department_id === closeDepartmentId).map((c) => c.session),
    );
    return Array.from(sessions).map((s) => ({ value: s, label: s }));
  }, [classes, closeDepartmentId]);

  const closeClassOptions = useMemo(
    () =>
      classes
        .filter((c) => c.department_id === closeDepartmentId)
        .map((c) => ({ value: c.id, label: `${c.class_name} (${c.session})` })),
    [classes, closeDepartmentId],
  );

  useEffect(() => {
    if (!closeClassId) {
      setActiveSemester(null);
      return;
    }
    const found = semesters.find((s) => s.class_id === closeClassId && s.status === "active");
    setActiveSemester(found || null);
  }, [closeClassId, semesters]);

  async function handleClose() {
    if (!activeSemester || !closeDate) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/admin/semesters/${activeSemester.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ close_date: closeDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Semester closed successfully.");
      setConfirmClose(false);
      setCloseClassId("");
      setCloseDate("");
      load();
    } finally {
      setClosing(false);
    }
  }

  function openEdit(s: Semester) {
    setEditSemester(s);
    setEditTermType(s.term_type);
    setEditStartDate(s.start_date ? s.start_date.slice(0, 10) : "");
    setAddCourseId("");
    setEditModalOpen(true);
  }

  async function refreshEditSemester(id: string) {
    const res = await fetch("/api/admin/semesters");
    const data = await res.json();
    if (res.ok) {
      setSemesters(data.semesters);
      const found = data.semesters.find((s: Semester) => s.id === id);
      if (found) setEditSemester(found);
    }
  }

  async function handleSaveDetails() {
    if (!editSemester) return;
    setSavingDetails(true);
    try {
      const res = await fetch(`/api/admin/semesters/${editSemester.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term_type: editTermType, start_date: editStartDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Semester details updated.");
      await refreshEditSemester(editSemester.id);
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleAddCourseToSemester() {
    if (!editSemester || !addCourseId) return;
    setAddingCourse(true);
    try {
      const res = await fetch(`/api/admin/semesters/${editSemester.id}/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: addCourseId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Course added to curriculum.");
      setAddCourseId("");
      await refreshEditSemester(editSemester.id);
    } finally {
      setAddingCourse(false);
    }
  }

  async function handleRemoveCourseFromSemester(courseId: string) {
    if (!editSemester) return;
    setRemovingCourseId(courseId);
    try {
      const res = await fetch(`/api/admin/semesters/${editSemester.id}/courses/${courseId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Course removed from curriculum.");
      await refreshEditSemester(editSemester.id);
    } finally {
      setRemovingCourseId(null);
    }
  }

  async function handleOutlineUpload(courseId: string, file: File) {
    if (!editSemester) return;
    setOutlineUploading((prev) => ({ ...prev, [courseId]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/admin/semesters/${editSemester.id}/courses/${courseId}/outline`,
        { method: "POST", body: fd }
      );
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Upload failed."); return; }
      setEditSemester((prev) =>
        prev
          ? {
              ...prev,
              courses: prev.courses.map((c) =>
                c.id === courseId ? { ...c, outline_url: data.url, outline_public_id: "uploaded" } : c
              ),
            }
          : null
      );
      toast.success("Course outline uploaded.");
    } finally {
      setOutlineUploading((prev) => ({ ...prev, [courseId]: false }));
    }
  }

  async function handlePostStartOutlineUpload(courseId: string, file: File) {
    if (!newSemesterId) return;
    setPostStartUploading((prev) => ({ ...prev, [courseId]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/admin/semesters/${newSemesterId}/courses/${courseId}/outline`,
        { method: "POST", body: fd }
      );
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Upload failed."); return; }
      setNewSemesterCourses((prev) =>
        prev.map((c) => (c.id === courseId ? { ...c, outline_url: data.url } : c))
      );
      toast.success("Outline uploaded.");
    } finally {
      setPostStartUploading((prev) => ({ ...prev, [courseId]: false }));
    }
  }

  async function handleOutlineDelete(courseId: string) {
    if (!editSemester) return;
    const res = await fetch(
      `/api/admin/semesters/${editSemester.id}/courses/${courseId}/outline`,
      { method: "DELETE" }
    );
    if (!res.ok) { toast.error("Failed to remove outline."); return; }
    setEditSemester((prev) =>
      prev
        ? {
            ...prev,
            courses: prev.courses.map((c) =>
              c.id === courseId ? { ...c, outline_url: null, outline_public_id: null } : c
            ),
          }
        : null
    );
    toast.success("Outline removed.");
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Semester Management</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Start and close semesters for each class
        </p>
      </div>

      <div className="mb-6 flex gap-2 border-b border-slate-200 dark:border-slate-800">
        {[
          { key: "start", label: "Start Semester", icon: Play },
          { key: "close", label: "Close Semester", icon: Lock },
          { key: "history", label: "History", icon: Calendar },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === t.key
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <DataFetchLoader />
        </div>
      ) : tab === "start" ? (
        newSemesterId ? (
          <div className="max-w-2xl card-3d p-6 space-y-5">
            <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-900/20">
              <CheckCircle size={20} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                  Semester started successfully!
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Optionally upload course outline files below, then click Done.
                </p>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Outline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {newSemesterCourses.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{c.code}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{c.title}</td>
                      <td className="px-3 py-2">
                        {c.outline_url ? (
                          <a
                            href={c.outline_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                          >
                            <FileDown size={12} /> View
                          </a>
                        ) : (
                          <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-500 hover:text-indigo-600">
                            {postStartUploading[c.id] ? (
                              "Uploading…"
                            ) : (
                              <>
                                <Upload size={12} /> Upload
                                <input
                                  type="file"
                                  accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handlePostStartOutlineUpload(c.id, f);
                                    e.target.value = "";
                                  }}
                                />
                              </>
                            )}
                          </label>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setNewSemesterId(null);
                  setNewSemesterCourses([]);
                  setPostStartUploading({});
                }}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleStart} className="max-w-2xl space-y-4 card-3d p-6">
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
                  setSelectedCourseIds([]);
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
                onChange={(opt) => {
                  setClassId(opt ? (opt as SelectOption).value : "");
                  setSemesterNumber("");
                }}
                placeholder="Select..."
                isDisabled={!session}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Semester
              </label>
              <SearchableSelect
                options={semesterNumberOptions}
                value={semesterNumberOptions.find((s) => s.value === semesterNumber) || null}
                onChange={(opt) => setSemesterNumber(opt ? (opt as SelectOption).value : "")}
                placeholder="Select..."
                isDisabled={!classId}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Term Type
              </label>
              <SearchableSelect
                options={termOptions}
                value={termOptions.find((t) => t.value === termType)}
                onChange={(opt) =>
                  setTermType((opt as { value: string }).value as "Fall" | "Spring")
                }
                isClearable={false}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Start Date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Add Courses
            </label>
            <SearchableSelect
              options={courseOptions}
              value={null}
              onChange={(opt) => {
                if (opt && !selectedCourseIds.includes((opt as SelectOption).value)) {
                  setSelectedCourseIds([...selectedCourseIds, (opt as SelectOption).value]);
                }
              }}
              placeholder={
                departmentId ? "Search by course name or code..." : "Select a department first"
              }
              isDisabled={!departmentId}
            />
          </div>
          {selectedCoursesDetail.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Credit Hours</th>
                    <th className="px-3 py-2 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedCoursesDetail.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">
                        {c.code}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{c.title}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                        {c.credit_hours}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedCourseIds(selectedCourseIds.filter((id) => id !== c.id))
                          }
                          className="text-red-500 hover:text-red-600"
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={starting}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              <Play size={16} /> {starting ? "Starting..." : "Start Semester"}
            </button>
          </div>
        </form>
        )
      ) : tab === "close" ? (
        <div className="max-w-2xl space-y-4 card-3d p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Department
              </label>
              <SearchableSelect
                options={departments}
                value={departments.find((d) => d.value === closeDepartmentId) || null}
                onChange={(opt) => {
                  setCloseDepartmentId(opt ? (opt as SelectOption).value : "");
                  setCloseClassId("");
                }}
                placeholder="Select..."
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Class
              </label>
              <SearchableSelect
                options={closeClassOptions}
                value={closeClassOptions.find((c) => c.value === closeClassId) || null}
                onChange={(opt) => setCloseClassId(opt ? (opt as SelectOption).value : "")}
                placeholder="Select..."
                isDisabled={!closeDepartmentId}
              />
            </div>
          </div>

          {closeClassId && !activeSemester && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              This class has no active semester.
            </p>
          )}

          {activeSemester && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    Semester {activeSemester.semester_number} — {activeSemester.term_type}
                  </p>
                  <StatusBadge status={activeSemester.status} />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Started: {new Date(activeSemester.start_date).toLocaleDateString()}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeSemester.courses.map((c) => (
                    <span
                      key={c.id}
                      className="flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                    >
                      <BookOpen size={12} /> {c.code}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Close Date
                </label>
                <input
                  type="date"
                  required
                  value={closeDate}
                  onChange={(e) => setCloseDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!closeDate}
                  onClick={() => setConfirmClose(true)}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  <Lock size={16} /> Close Semester
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden card-3d card-hover">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Semester</th>
                <th className="px-4 py-3">Term</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Closed</th>
                <th className="px-4 py-3">Courses</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {semesters.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    No semesters found.
                  </td>
                </tr>
              ) : (
                semesters.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                      {s.class_name} ({s.session})
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {s.department_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {s.semester_number}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.term_type}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {new Date(s.start_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {s.close_date ? new Date(s.close_date).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {s.courses.length}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        disabled={s.status === "closed"}
                        title={
                          s.status === "closed"
                            ? "Closed semesters cannot be edited"
                            : "Edit semester"
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-400 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
                      >
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirmClose}
        title="Close Semester"
        message="This will close the active semester and deactivate its courses for teachers and students. This cannot be undone. Continue?"
        confirmLabel="Close Semester"
        loading={closing}
        onConfirm={handleClose}
        onCancel={() => setConfirmClose(false)}
      />

      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={
          editSemester
            ? `Edit Semester — ${editSemester.class_name} (${editSemester.session})`
            : "Edit Semester"
        }
        widthClass="max-w-2xl"
      >
        {editSemester && (
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Semester Details
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Term Type
                  </label>
                  <SearchableSelect
                    options={termOptions}
                    value={termOptions.find((t) => t.value === editTermType)}
                    onChange={(opt) =>
                      setEditTermType((opt as { value: string }).value as "Fall" | "Spring")
                    }
                    isClearable={false}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={savingDetails}
                  onClick={handleSaveDetails}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {savingDetails ? "Saving..." : "Save Details"}
                </button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Curriculum Courses
              </p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <SearchableSelect
                    options={editCourseOptions}
                    value={null}
                    onChange={(opt) => setAddCourseId(opt ? (opt as SelectOption).value : "")}
                    placeholder="Search by course name or code to add..."
                  />
                </div>
                <button
                  type="button"
                  disabled={!addCourseId || addingCourse}
                  onClick={handleAddCourseToSemester}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Plus size={15} /> {addingCourse ? "Adding..." : "Add"}
                </button>
              </div>
              <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2">Title</th>
                      <th className="px-3 py-2">Credit Hours</th>
                      <th className="px-3 py-2">Outline</th>
                      <th className="px-3 py-2 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {editSemester.courses.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                          No courses in this semester yet.
                        </td>
                      </tr>
                    ) : (
                      editSemester.courses.map((c) => (
                        <tr key={c.id}>
                          <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">
                            {c.code}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                            {c.title}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                            {c.credit_hours}
                          </td>
                          <td className="px-3 py-2">
                            {c.outline_url ? (
                              <div className="flex items-center gap-1">
                                <a
                                  href={c.outline_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                                >
                                  <FileDown size={12} /> View
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleOutlineDelete(c.id)}
                                  className="ml-1 text-red-400 hover:text-red-600"
                                  title="Remove outline"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-500 hover:text-indigo-600">
                                {outlineUploading[c.id] ? (
                                  "Uploading…"
                                ) : (
                                  <>
                                    <Upload size={12} /> Upload
                                    <input
                                      type="file"
                                      accept=".pdf,.doc,.docx,.ppt,.pptx"
                                      className="hidden"
                                      onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) handleOutlineUpload(c.id, f);
                                        e.target.value = "";
                                      }}
                                    />
                                  </>
                                )}
                              </label>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              disabled={removingCourseId === c.id}
                              onClick={() => handleRemoveCourseFromSemester(c.id)}
                              className="text-red-500 hover:text-red-600 disabled:opacity-50"
                            >
                              <X size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                A course already allocated to a teacher in this semester cannot be removed.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
