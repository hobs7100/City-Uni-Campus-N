"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import toast from "react-hot-toast";
import { BookOpen, Calendar, CheckCircle, FileDown, Lock, Pencil, Play, Plus, RefreshCw, X, AlertTriangle } from "lucide-react";
import OutlineUploadButton from "@/components/ui/OutlineUploadButton";
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
  status: string;
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
  syllabus_completed_at: string | null;
  syllabus_completed_by: string | null;
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
  status: "active" | "mid_term" | "final_term" | "closed";
  updated_at: string;
  courses: SemesterCourse[];
}

const termOptions = [
  { value: "Fall", label: "Fall" },
  { value: "Spring", label: "Spring" },
];

const stepperSchemes = [
  {
    card: "linear-gradient(135deg, rgba(239,246,255,0.98), rgba(238,242,255,0.92) 52%, rgba(250,245,255,0.98))",
    darkCard: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.98) 52%, rgba(49,46,129,0.5))",
    accent: "#4f46e5",
    accentSoft: "#c7d2fe",
    line: "linear-gradient(90deg, #38bdf8, #6366f1 52%, #a855f7)",
    mutedLine: "linear-gradient(90deg, rgba(56,189,248,0.38), rgba(99,102,241,0.46), rgba(168,85,247,0.38))",
  },
  {
    card: "linear-gradient(135deg, rgba(236,254,255,0.98), rgba(240,253,250,0.94) 52%, rgba(239,246,255,0.98))",
    darkCard: "linear-gradient(135deg, rgba(8,47,73,0.98), rgba(15,46,54,0.98) 52%, rgba(30,64,175,0.45))",
    accent: "#0891b2",
    accentSoft: "#a5f3fc",
    line: "linear-gradient(90deg, #06b6d4, #14b8a6 52%, #3b82f6)",
    mutedLine: "linear-gradient(90deg, rgba(6,182,212,0.38), rgba(20,184,166,0.46), rgba(59,130,246,0.38))",
  },
  {
    card: "linear-gradient(135deg, rgba(255,247,237,0.98), rgba(254,252,232,0.94) 52%, rgba(255,241,242,0.98))",
    darkCard: "linear-gradient(135deg, rgba(67,20,7,0.98), rgba(66,32,6,0.98) 52%, rgba(127,29,29,0.45))",
    accent: "#ea580c",
    accentSoft: "#fed7aa",
    line: "linear-gradient(90deg, #f97316, #eab308 52%, #ef4444)",
    mutedLine: "linear-gradient(90deg, rgba(249,115,22,0.38), rgba(234,179,8,0.46), rgba(239,68,68,0.38))",
  },
  {
    card: "linear-gradient(135deg, rgba(240,253,244,0.98), rgba(236,253,245,0.94) 52%, rgba(239,246,255,0.98))",
    darkCard: "linear-gradient(135deg, rgba(5,46,22,0.98), rgba(6,52,38,0.98) 52%, rgba(30,64,175,0.45))",
    accent: "#059669",
    accentSoft: "#a7f3d0",
    line: "linear-gradient(90deg, #22c55e, #14b8a6 52%, #3b82f6)",
    mutedLine: "linear-gradient(90deg, rgba(34,197,94,0.38), rgba(20,184,166,0.46), rgba(59,130,246,0.38))",
  },
  {
    card: "linear-gradient(135deg, rgba(253,244,255,0.98), rgba(250,245,255,0.94) 52%, rgba(252,231,243,0.98))",
    darkCard: "linear-gradient(135deg, rgba(59,7,100,0.98), rgba(49,15,75,0.98) 52%, rgba(131,24,67,0.45))",
    accent: "#9333ea",
    accentSoft: "#e9d5ff",
    line: "linear-gradient(90deg, #a855f7, #ec4899 52%, #f43f5e)",
    mutedLine: "linear-gradient(90deg, rgba(168,85,247,0.38), rgba(236,72,153,0.46), rgba(244,63,94,0.38))",
  },
] as const;

function formatSemesterDate(value: string | null | undefined) {
  if (!value) return "—";
  // Read the calendar date from the API value directly. Parsing an ISO date
  // with `new Date()` can move it across a day when the browser timezone differs.
  const datePart = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "—";
}

export default function SemestersPage() {
  const [tab, setTab] = useState<"start" | "update" | "close" | "history">("start");
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
  const [startModalOpen, setStartModalOpen] = useState(false);

  const [closeDepartmentId, setCloseDepartmentId] = useState("");
  const [closeClassId, setCloseClassId] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  // Update-status tab
  const [updateDeptId,    setUpdateDeptId]    = useState("");
  const [updateClassId,   setUpdateClassId]   = useState("");
  const [updateTarget,    setUpdateTarget]    = useState<Semester | null>(null);
  const [updateStatus,    setUpdateStatus]    = useState<"active" | "mid_term" | "final_term">("active");
  const [updatingStatus,  setUpdatingStatus]  = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSemester, setEditSemester] = useState<Semester | null>(null);
  const [editTermType, setEditTermType] = useState<"Fall" | "Spring">("Fall");
  const [editStartDate, setEditStartDate] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [addCourseId, setAddCourseId] = useState("");
  const [addingCourse, setAddingCourse] = useState(false);
  const [removingCourseId, setRemovingCourseId] = useState<string | null>(null);
  const [outlineUploading, setOutlineUploading] = useState<Record<string, boolean>>({});
  const [syllabusTarget, setSyllabusTarget] = useState<SemesterCourse | null>(null);
  const [syllabusUpdatingId, setSyllabusUpdatingId] = useState<string | null>(null);
  const [newSemesterId, setNewSemesterId] = useState<string | null>(null);
  const [newSemesterCourses, setNewSemesterCourses] = useState<
    { id: string; code: string; title: string; outline_url: string | null }[]
  >([]);
  const [postStartUploading, setPostStartUploading] = useState<Record<string, boolean>>({});

  // History tab filters
  const [historyDeptId,   setHistoryDeptId]   = useState("");
  const [historySession,  setHistorySession]   = useState("");
  const [historyStatus,   setHistoryStatus]    = useState<"" | "active" | "mid_term" | "final_term" | "closed">("");
  const [historyTermType, setHistoryTermType]  = useState<"" | "Fall" | "Spring">("");

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

  const semesterTimelines = useMemo(() => {
    return classes
      .filter((classInfo) => classInfo.status === "active")
      .map((classInfo) => {
        const classSemesters = semesters
          .filter((semester) => semester.class_id === classInfo.id)
          .sort((a, b) => a.semester_number - b.semester_number);
        const hasActiveSemester = classSemesters.some((semester) => semester.status === "active");
        const hasUpcomingSemesterRecord = classSemesters.some(
          (semester) => semester.status !== "active",
        );
        if (hasActiveSemester || !hasUpcomingSemesterRecord) return null;

        const semesterByNumber = new Map(
          classSemesters.map((semester) => [semester.semester_number, semester]),
        );
        const runningSemester = classSemesters.find((semester) => semester.status !== "closed");
        const nextSemesterNumber =
          (classSemesters.reduce(
            (highest, semester) => Math.max(highest, semester.semester_number),
            0,
          ) || 0) + 1;

        const steps = Array.from({ length: classInfo.total_semesters }, (_, index) => {
          const number = index + 1;
          const semester = semesterByNumber.get(number) ?? null;
          const isNext = number === nextSemesterNumber;
          const isReady = isNext && !runningSemester;

          return {
            number,
            semester,
            state: semester
              ? semester.status === "closed"
                ? "completed"
                : "current"
              : isReady
                ? "ready"
                : isNext && runningSemester
                  ? "blocked"
                  : "locked",
          } as const;
        });

        return { classInfo, steps, runningSemester };
      })
      .filter((timeline): timeline is NonNullable<typeof timeline> => timeline !== null)
      .sort((a, b) => a.classInfo.class_name.localeCompare(b.classInfo.class_name));
  }, [classes, semesters]);

  const editCourseOptions = useMemo(() => {
    if (!editSemester) return [];
    const existingIds = new Set(editSemester.courses.map((c) => c.id));
    return courses
      .filter((c) => c.department_id === editSemester.department_id)
      .filter((c) => !existingIds.has(c.id))
      .filter((c) => c.status !== "blocked")
      .map((c) => ({ value: c.id, label: `${c.code} — ${c.title} (${c.credit_hours} Cr)` }));
  }, [courses, editSemester]);

  // History tab — derived filter helpers
  const historySessionOptions = useMemo(() => {
    const sessions = new Set(
      semesters
        .filter((s) => !historyDeptId || s.department_id === historyDeptId)
        .map((s) => s.session),
    );
    return Array.from(sessions)
      .sort()
      .map((s) => ({ value: s, label: s }));
  }, [semesters, historyDeptId]);

  const filteredHistorySemesters = useMemo(() => {
    return semesters.filter((s) => {
      if (historyDeptId   && s.department_id !== historyDeptId)   return false;
      if (historySession  && s.session       !== historySession)   return false;
      if (historyStatus   && s.status        !== historyStatus)    return false;
      if (historyTermType && s.term_type     !== historyTermType)  return false;
      return true;
    });
  }, [semesters, historyDeptId, historySession, historyStatus, historyTermType]);

  const historyActiveFilters =
    [historyDeptId, historySession, historyStatus, historyTermType].filter(Boolean).length;

  function clearHistoryFilters() {
    setHistoryDeptId("");
    setHistorySession("");
    setHistoryStatus("");
    setHistoryTermType("");
  }

  function openStartModal(targetClass: ClassOption, targetSemesterNumber: number) {
    setDepartmentId(targetClass.department_id);
    setSession(targetClass.session);
    setClassId(targetClass.id);
    setSemesterNumber(String(targetSemesterNumber));
    setTermType("Fall");
    setStartDate("");
    setSelectedCourseIds([]);
    setStartModalOpen(true);
  }

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
      setStartModalOpen(false);
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
    const found = semesters.find((s) => s.class_id === closeClassId && s.status !== "closed");
    setActiveSemester(found || null);
  }, [closeClassId, semesters]);

  const updateClassOptions = useMemo(
    () =>
      classes
        .filter((c) => c.department_id === updateDeptId)
        .map((c) => ({ value: c.id, label: `${c.class_name} (${c.session})` })),
    [classes, updateDeptId],
  );

  useEffect(() => {
    if (!updateClassId) {
      setUpdateTarget(null);
      return;
    }
    const found = semesters.find((s) => s.class_id === updateClassId && s.status !== "closed");
    setUpdateTarget(found || null);
    if (found) setUpdateStatus(found.status as "active" | "mid_term" | "final_term");
  }, [updateClassId, semesters]);

  async function handleUpdateStatus() {
    if (!updateTarget) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/admin/semesters/${updateTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: updateStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Semester status updated.");
      setUpdateClassId("");
      setUpdateDeptId("");
      setUpdateTarget(null);
      load();
    } finally {
      setUpdatingStatus(false);
    }
  }

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

  async function handleMarkSyllabusComplete() {
    if (!editSemester || !syllabusTarget) return;
    setSyllabusUpdatingId(syllabusTarget.id);
    try {
      const res = await fetch(
        `/api/admin/semesters/${editSemester.id}/courses/${syllabusTarget.id}/syllabus-completion`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to mark the syllabus complete.");
        return;
      }
      toast.success("Syllabus marked complete.");
      setSyllabusTarget(null);
      await refreshEditSemester(editSemester.id);
    } finally {
      setSyllabusUpdatingId(null);
    }
  }

  function completionDate(value: string) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Karachi",
    }).format(new Date(value));
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
          { key: "start",   label: "Start Semester",  icon: Play },
          { key: "update",  label: "Update Status",   icon: RefreshCw },
          { key: "close",   label: "Close Semester",  icon: Lock },
          { key: "history", label: "History",          icon: Calendar },
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
        <div className="space-y-5">
          <div className="overflow-hidden rounded-xl card-3d">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 dark:border-slate-800 dark:from-blue-900/20 dark:to-indigo-900/20">
              <Calendar size={18} className="text-blue-600 dark:text-blue-400" />
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Upcoming Semesters</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Active classes with a completed or in-progress semester
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Ready to start
                </span>
                <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Waiting to close
                </span>
              </div>
            </div>

            {semesterTimelines.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-5 py-14 text-center">
                 <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                   <Calendar size={19} />
                 </span>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  No active classes found.
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Closed classes are hidden from semester progress.
                </p>
              </div>
            ) : (
              <div className="space-y-4 p-5">
                  {semesterTimelines.map(({ classInfo, steps, runningSemester }, classIndex) => {
                   const scheme = stepperSchemes[classIndex % stepperSchemes.length];
                   return (
                  <div
                    key={classInfo.id}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
                     style={{
                       borderTopColor: scheme.accentSoft,
                       boxShadow: `0 12px 28px -20px ${scheme.accent}`,
                     }}
                  >
                     <div
                        className="semester-stepper-header flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 px-4 py-4 dark:border-white/10"
                       style={{
                         "--semester-card-bg": scheme.card,
                         "--semester-card-dark-bg": scheme.darkCard,
                       } as CSSProperties}
                     >
                       <div className="min-w-0">
                         <h4 className="text-[15px] font-bold tracking-[-0.01em] text-slate-950 dark:text-white">
                          {classInfo.class_name}
                           <span className="ml-2 inline-flex rounded-md bg-white/75 px-2 py-0.5 align-middle text-xs font-semibold tracking-normal text-slate-700 ring-1 ring-slate-900/10 dark:bg-slate-950/40 dark:text-slate-200 dark:ring-white/15">
                            {classInfo.session}
                          </span>
                        </h4>
                         <p className="mt-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                           <span className="font-bold text-slate-900 dark:text-white">{classInfo.total_semesters}</span>{" "}
                           semester{classInfo.total_semesters === 1 ? "" : "s"} in program
                        </p>
                      </div>
                      {runningSemester && (
                         <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-300/80 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-800 shadow-sm dark:border-red-400/30 dark:bg-red-950/35 dark:text-red-200">
                          <AlertTriangle size={13} />
                          Close Semester {runningSemester.semester_number} to continue
                        </span>
                      )}
                    </div>

                      <div className="overflow-x-auto bg-slate-50/90 px-4 pb-5 pt-5 dark:bg-slate-950/60">
                       <div className="flex min-w-max items-start">
                        {steps.map((step, index) => {
                          const record = step.semester;
                          const isReady = step.state === "ready";
                          const isBlocked = step.state === "blocked";
                          const isCompleted = step.state === "completed";
                          const isCurrent = step.state === "current";
                           const hasRecord = Boolean(record);
                           const connectorStyle = {
                             background: hasRecord ? scheme.line : scheme.mutedLine,
                             boxShadow: hasRecord
                               ? `inset 0 1px 1px rgba(255,255,255,0.55), 0 3px 6px -3px ${scheme.accent}`
                               : "inset 0 1px 1px rgba(255,255,255,0.45), 0 2px 4px -3px rgba(100,116,139,0.8)",
                           };
                          const node = (
                            <span
                               className={`relative flex h-12 w-12 items-center justify-center rounded-[15px] border-2 text-sm font-bold shadow-[inset_0_1px_1px_rgba(255,255,255,0.55),0_6px_10px_-6px_rgba(15,23,42,0.7)] transition ${
                                isCompleted
                                  ? "border-emerald-500 bg-emerald-500 text-white"
                                  : isCurrent
                                     ? "text-white"
                                    : isReady
                                      ? "border-blue-500 bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                                      : isBlocked
                                        ? "border-red-500 bg-red-500 text-white shadow-lg shadow-red-500/25"
                                        : "border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-900"
                              }`}
                              style={
                                 isCurrent
                                   ? {
                                       borderColor: scheme.accent,
                                       background: `linear-gradient(145deg, ${scheme.accentSoft}, ${scheme.accent})`,
                                       boxShadow: `inset 0 1px 1px rgba(255,255,255,0.55), 0 8px 14px -7px ${scheme.accent}`,
                                     }
                                   : undefined
                               }
                            >
                               {(isReady || isBlocked) && (
                                <>
                                  <span
                                    className={`absolute inset-[-5px] rounded-full border ${
                                      isReady ? "border-blue-400" : "border-red-400"
                                    } animate-[semester-ripple_1.8s_ease-out_infinite]`}
                                  />
                                  <span
                                    className={`absolute inset-[-5px] rounded-full border ${
                                      isReady ? "border-blue-400" : "border-red-400"
                                    } animate-[semester-ripple_1.8s_ease-out_900ms_infinite]`}
                                  />
                                </>
                              )}
                              {isCompleted ? <CheckCircle size={18} /> : step.number}
                            </span>
                          );

                          return (
                              <div key={step.number} className="flex w-[182px] shrink-0 items-start">
                                <div
                                  className={`flex w-[136px] shrink-0 flex-col items-center rounded-lg px-1.5 pb-2 ${
                                    isReady
                                      ? "bg-blue-50/90 dark:bg-blue-950/30"
                                      : isBlocked
                                        ? "bg-red-50/90 dark:bg-red-950/30"
                                        : isCurrent
                                          ? "bg-indigo-50/90 dark:bg-indigo-950/30"
                                          : "bg-white/55 dark:bg-slate-900/55"
                                  }`}
                                >
                                {isReady ? (
                                  <button
                                    type="button"
                                    onClick={() => openStartModal(classInfo, step.number)}
                                    aria-label={`Start semester ${step.number} for ${classInfo.class_name}`}
                                    className="rounded-full focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                                  >
                                    {node}
                                  </button>
                                ) : (
                                  <span
                                    title={isBlocked ? "Close the current semester before starting this one" : undefined}
                                  >
                                    {node}
                                  </span>
                                )}
                                <span
                                  className={`mt-2 text-center text-xs font-bold tracking-tight ${
                                    isReady
                                      ? "text-blue-700 dark:text-blue-300"
                                      : isBlocked
                                        ? "text-red-700 dark:text-red-300"
                                        : isCurrent
                                          ? "text-indigo-700 dark:text-indigo-300"
                                          : "text-slate-600 dark:text-slate-300"
                                  }`}
                                >
                                  Semester {step.number}
                                </span>
                                <span className="mt-2 min-h-[88px] w-full space-y-1 rounded-md border border-slate-200/80 bg-white/75 px-2 py-2 text-left text-[11px] leading-[1.25] text-slate-700 shadow-sm dark:border-slate-700/80 dark:bg-slate-950/55 dark:text-slate-200">
                                  <span className="flex items-start justify-between gap-1">
                                    <span className="font-semibold text-slate-500 dark:text-slate-400">Status</span>
                                    <span className={`text-right font-bold ${
                                      isReady ? "text-blue-700 dark:text-blue-300" :
                                      isBlocked ? "text-red-700 dark:text-red-300" :
                                      isCompleted ? "text-emerald-700 dark:text-emerald-300" :
                                      isCurrent ? "text-indigo-700 dark:text-indigo-300" :
                                      "text-slate-700 dark:text-slate-200"
                                    }`}>
                                      {record
                                        ? record.status === "mid_term"
                                          ? "Mid-Term"
                                          : record.status === "final_term"
                                            ? "Final-Term"
                                            : record.status === "closed"
                                              ? "Closed"
                                              : "Active"
                                        : isReady
                                          ? "Ready to start"
                                          : isBlocked
                                            ? "Waiting to close"
                                            : "Not available"}
                                    </span>
                                  </span>
                                  <span className="flex justify-between gap-1"><span className="font-semibold text-slate-500 dark:text-slate-400">Start</span><span className="text-right font-medium">{formatSemesterDate(record?.start_date)}</span></span>
                                  <span className="flex justify-between gap-1"><span className="font-semibold text-slate-500 dark:text-slate-400">Closed</span><span className="text-right font-medium">{formatSemesterDate(record?.close_date)}</span></span>
                                  <span className="flex justify-between gap-1"><span className="font-semibold text-slate-500 dark:text-slate-400">Updated</span><span className="text-right font-medium">{formatSemesterDate(record?.updated_at)}</span></span>
                                </span>
                              </div>
                              {index < steps.length - 1 && (
                                 <div
                                   aria-hidden="true"
                                    className="mt-[21px] h-2 w-[46px] shrink-0 rounded-full"
                                   style={connectorStyle}
                                 />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                   );
                 })}
              </div>
            )}
          </div>
        </div>
      ) : tab === "update" ? (
        <div className="max-w-2xl space-y-5 card-3d p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Department
              </label>
              <SearchableSelect
                options={departments}
                value={departments.find((d) => d.value === updateDeptId) || null}
                onChange={(opt) => {
                  setUpdateDeptId(opt ? (opt as SelectOption).value : "");
                  setUpdateClassId("");
                  setUpdateTarget(null);
                }}
                placeholder="Select..."
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Class
              </label>
              <SearchableSelect
                options={updateClassOptions}
                value={updateClassOptions.find((c) => c.value === updateClassId) || null}
                onChange={(opt) => setUpdateClassId(opt ? (opt as SelectOption).value : "")}
                placeholder="Select..."
                isDisabled={!updateDeptId}
              />
            </div>
          </div>

          {updateClassId && !updateTarget && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              This class has no running semester.
            </p>
          )}

          {updateTarget && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  Semester {updateTarget.semester_number} — {updateTarget.term_type}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    ({updateTarget.class_name}, {updateTarget.session})
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Started: {new Date(updateTarget.start_date).toLocaleDateString()}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  New Status
                </label>
                <div className="flex flex-wrap gap-3">
                  {(
                    [
                      { value: "active",     label: "Active",          color: "text-emerald-600 dark:text-emerald-400" },
                      { value: "mid_term",   label: "Mid Term Exam",   color: "text-violet-600 dark:text-violet-400" },
                      { value: "final_term", label: "Final Term Exam", color: "text-blue-600 dark:text-blue-400" },
                    ] as const
                  ).map(({ value, label, color }) => (
                    <label key={value} className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="radio"
                        name="update-status"
                        value={value}
                        checked={updateStatus === value}
                        onChange={() => setUpdateStatus(value)}
                        className="accent-indigo-600"
                      />
                      <span className={`text-sm font-medium ${color}`}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={updatingStatus || updateStatus === updateTarget.status}
                  onClick={handleUpdateStatus}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  <RefreshCw size={15} />
                  {updatingStatus ? "Saving..." : "Update Status"}
                </button>
              </div>
            </div>
          )}
        </div>
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
        <div className="space-y-4">
          {/* ── Filters ────────────────────────────────────────────────── */}
          <div className="card-3d p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* Department */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Department
                </label>
                <select
                  value={historyDeptId}
                  onChange={(e) => {
                    setHistoryDeptId(e.target.value);
                    setHistorySession("");
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              {/* Session */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Session
                </label>
                <select
                  value={historySession}
                  onChange={(e) => setHistorySession(e.target.value)}
                  disabled={historySessionOptions.length === 0}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">All Sessions</option>
                  {historySessionOptions.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Term Type */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Term
                </label>
                <select
                  value={historyTermType}
                  onChange={(e) => setHistoryTermType(e.target.value as "" | "Fall" | "Spring")}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">All Terms</option>
                  <option value="Fall">Fall</option>
                  <option value="Spring">Spring</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Status
                </label>
                <select
                  value={historyStatus}
                  onChange={(e) => setHistoryStatus(e.target.value as "" | "active" | "closed")}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="mid_term">Mid Term Exam</option>
                  <option value="final_term">Final Term Exam</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            {/* Result count + clear */}
            {historyActiveFilters > 0 && (
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Showing{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {filteredHistorySemesters.length}
                  </span>{" "}
                  of {semesters.length} semesters
                </p>
                <button
                  type="button"
                  onClick={clearHistoryFilters}
                  className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          {/* ── Desktop table (md+) ─────────────────────────────────────── */}
          <div className="hidden overflow-hidden rounded-xl card-3d card-hover md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Sem</th>
                    <th className="px-4 py-3">Term</th>
                    <th className="px-4 py-3">Started</th>
                    <th className="px-4 py-3">Closed</th>
                    <th className="px-4 py-3">Courses</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredHistorySemesters.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                        {semesters.length === 0
                          ? "No semesters found."
                          : "No semesters match the selected filters."}
                      </td>
                    </tr>
                  ) : (
                    filteredHistorySemesters.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                          {s.class_name}
                          <span className="ml-1 text-xs font-normal text-slate-400">
                            ({s.session})
                          </span>
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
                          {s.close_date ? new Date(s.close_date).toLocaleDateString() : "—"}
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
          </div>

          {/* ── Mobile cards (< md) ─────────────────────────────────────── */}
          <div className="space-y-3 md:hidden">
            {filteredHistorySemesters.length === 0 ? (
              <div className="card-3d rounded-xl px-4 py-10 text-center text-sm text-slate-400">
                {semesters.length === 0
                  ? "No semesters found."
                  : "No semesters match the selected filters."}
              </div>
            ) : (
              filteredHistorySemesters.map((s) => (
                <div key={s.id} className="card-3d rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
                        {s.class_name}
                        <span className="ml-1 text-xs font-normal text-slate-400">
                          ({s.session})
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {s.department_name}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={s.status} />
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
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-y-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-700">
                    <div>
                      <p className="text-slate-400">Semester</p>
                      <p className="font-medium text-slate-700 dark:text-slate-200">
                        {s.semester_number}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Term</p>
                      <p className="font-medium text-slate-700 dark:text-slate-200">{s.term_type}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Courses</p>
                      <p className="font-medium text-slate-700 dark:text-slate-200">
                        {s.courses.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Started</p>
                      <p className="font-medium text-slate-700 dark:text-slate-200">
                        {new Date(s.start_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Closed</p>
                      <p className="font-medium text-slate-700 dark:text-slate-200">
                        {s.close_date ? new Date(s.close_date).toLocaleDateString() : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
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
        open={startModalOpen}
        onClose={() => setStartModalOpen(false)}
        title={
          selectedClass && semesterNumber
            ? `Start Semester ${semesterNumber} — ${selectedClass.class_name}`
            : "Start Semester"
        }
        widthClass="max-w-2xl"
      >
        <form onSubmit={handleStart} className="space-y-5">
          <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:bg-blue-500/10 dark:text-blue-200">
            Complete the semester details and curriculum below. The new semester will start as Active.
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  setSemesterNumber("");
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
                  setSemesterNumber("");
                  setSelectedCourseIds([]);
                }}
                placeholder="Select..."
                isDisabled={!departmentId}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  setSelectedCourseIds([]);
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  {selectedCoursesDetail.map((course) => (
                    <tr key={course.id}>
                      <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">
                        {course.code}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{course.title}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                        {course.credit_hours}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedCourseIds(selectedCourseIds.filter((id) => id !== course.id))
                          }
                          className="text-red-500 hover:text-red-600"
                          aria-label={`Remove ${course.code}`}
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

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setStartModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={starting}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              <Play size={16} /> {starting ? "Starting..." : "Start Semester"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(newSemesterId)}
        onClose={() => {
          setNewSemesterId(null);
          setNewSemesterCourses([]);
          setPostStartUploading({});
        }}
        title="Semester started successfully"
        widthClass="max-w-2xl"
      >
        <div className="space-y-5">
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
                {newSemesterCourses.map((course) => (
                  <tr key={course.id}>
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">
                      {course.code}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{course.title}</td>
                    <td className="px-3 py-2">
                      {course.outline_url ? (
                        <a
                          href={course.outline_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          <FileDown size={12} /> View
                        </a>
                      ) : (
                        <OutlineUploadButton
                          uploading={postStartUploading[course.id] ?? false}
                          onFile={(file) => handlePostStartOutlineUpload(course.id, file)}
                        />
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
      </Modal>

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
              {editSemester.courses.length === 0 ? (
                <p className="mt-3 rounded-lg border border-slate-200 px-3 py-4 text-center text-sm text-slate-400 dark:border-slate-700">
                  No courses in this semester yet.
                </p>
              ) : (
                <>
                  {/* ── Desktop table (sm+) ──────────────────────────────── */}
                  <div className="mt-3 hidden overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 sm:block">
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                        <tr>
                          <th className="px-3 py-2">Code</th>
                          <th className="px-3 py-2">Title</th>
                          <th className="px-3 py-2">Cr.</th>
                          <th className="px-3 py-2">Outline</th>
                          <th className="px-3 py-2">Syllabus</th>
                          <th className="px-3 py-2 text-right">Remove</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {editSemester.courses.map((c) => (
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
                                <OutlineUploadButton
                                  uploading={outlineUploading[c.id] ?? false}
                                  onFile={(f) => handleOutlineUpload(c.id, f)}
                                />
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {c.syllabus_completed_at ? (
                                <span className="inline-flex flex-col rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                  <span>Syllabus Complete</span>
                                  <span className="font-normal">{completionDate(c.syllabus_completed_at)}</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={syllabusUpdatingId === c.id}
                                  onClick={() => setSyllabusTarget(c)}
                                  className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  Mark Complete
                                </button>
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
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* ── Mobile cards (< sm) ───────────────────────────────── */}
                  <div className="mt-3 space-y-2 sm:hidden">
                    {editSemester.courses.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                              <span className="mr-1.5 text-indigo-600 dark:text-indigo-400">
                                {c.code}
                              </span>
                              <span className="font-normal text-slate-600 dark:text-slate-300">
                                {c.title}
                              </span>
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              Credit Hours: {c.credit_hours}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={removingCourseId === c.id}
                            onClick={() => handleRemoveCourseFromSemester(c.id)}
                            className="shrink-0 text-red-500 hover:text-red-600 disabled:opacity-50"
                            title="Remove course"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                          <div className="mb-2">
                            {c.syllabus_completed_at ? (
                              <span className="inline-flex flex-col rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                <span>Syllabus Complete</span>
                                <span className="font-normal">{completionDate(c.syllabus_completed_at)}</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={syllabusUpdatingId === c.id}
                                onClick={() => setSyllabusTarget(c)}
                                className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                Mark Syllabus Complete
                              </button>
                            )}
                          </div>
                          {c.outline_url ? (
                            <div className="flex items-center gap-2">
                              <a
                                href={c.outline_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                              >
                                <FileDown size={12} /> View Outline
                              </a>
                              <button
                                type="button"
                                onClick={() => handleOutlineDelete(c.id)}
                                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600"
                                title="Remove outline"
                              >
                                <X size={12} /> Remove
                              </button>
                            </div>
                          ) : (
                            <OutlineUploadButton
                              uploading={outlineUploading[c.id] ?? false}
                              onFile={(f) => handleOutlineUpload(c.id, f)}
                            />
                          )}

                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <p className="mt-2 text-xs text-slate-400">
                A course already allocated to a teacher in this semester cannot be removed.
              </p>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(syllabusTarget)}
        title="Mark Syllabus Complete"
        message={`Mark ${syllabusTarget?.code ?? "this course"} as syllabus complete? It will stop appearing for new attendance, release the teacher's timetable clashes, and remove its credit hours from assigned workload. Existing timetable and attendance history will remain available.`}
        confirmLabel="Mark Complete"
        loading={Boolean(syllabusTarget && syllabusUpdatingId === syllabusTarget.id)}
        onConfirm={handleMarkSyllabusComplete}
        onCancel={() => setSyllabusTarget(null)}
      />
    </div>
  );
}
