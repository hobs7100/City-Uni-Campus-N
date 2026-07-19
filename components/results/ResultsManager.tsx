"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FileDown, Save, Search, Snowflake, UserX, XCircle } from "lucide-react";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";
import { formatDateOnly } from "@/lib/format";
import { DataFetchLoader, ButtonLoader } from "@/components/ui/Loaders";

interface ClassOption {
  id: string;
  class_name: string;
  session: string;
  department_id: string;
}

interface SemesterOption {
  id: string;
  semester_number: number;
  term_type: string;
  class_id: string;
  status: string;
  courses: { id: string; code: string; title: string; credit_hours: number }[];
}

interface RosterRow {
  student_id: string;
  name: string;
  roll_no: string | null;
  student_status: string;
  mid: number;
  mid_absent: boolean;
  re_mid: number | null;
  re_mid_absent: boolean;
  sessional: number;
  final: number;
  practical: number;
  total: number | null;
  status: "pass" | "fail" | "freezed" | "drop";
}

interface FailedStudent {
  student_id: string;
  student_name: string;
  roll_no: string | null;
  department_name: string;
  university_name: string | null;
  class_name: string;
  session: string;
  failed_courses: {
    course_title: string;
    course_code: string;
    semester_number: number;
    term_type: string;
  }[];
}

interface FreezeDropStudent {
  student_id: string;
  student_name: string;
  roll_no: string | null;
  department_name: string;
  university_name: string | null;
  class_name: string;
  session: string;
  semester_number: number;
  term_type: string;
  updated_at?: string;
  drop_date?: string;
}

interface SearchStudent {
  id: string;
  name: string;
  roll_no: string | null;
  session: string;
  class_name: string;
  department_name: string;
}

interface ResultSheetCourse {
  course_code: string;
  course_title: string;
  credit_hours: number;
  mid: number;
  mid_absent: boolean;
  re_mid: number | null;
  re_mid_absent: boolean;
  sessional: number;
  final: number;
  practical: number;
  total: number;
  status: string;
}

interface ResultSheetSemester {
  semester_number: number;
  term_type: string;
  courses: ResultSheetCourse[];
}

interface DsRow {
  course_id: string;
  course_code: string;
  course_title: string;
  credit_hours: string;
  teacher_name: string;
  datesheet_id: string | null;
  paper_date: string;
  bundle_received_date: string;
  return_date: string;
  result_uploaded: boolean;
}

const statusBadgeClass: Record<string, string> = {
  pass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  fail: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  freezed: "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
  drop: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
};

type Tab = "failed" | "upload" | "freezed" | "dropped" | "search" | "datesheet" | "remid-datesheet";

export default function ResultsManager() {
  const [tab, setTab] = useState<Tab>("failed");
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [allClasses, setAllClasses] = useState<ClassOption[]>([]);
  const [allSemesters, setAllSemesters] = useState<SemesterOption[]>([]);

  const [counters, setCounters] = useState({ total_students: 0, passed: 0, failed: 0 });

  useEffect(() => {
    fetch("/api/admin/departments")
      .then((r) => r.json())
      .then((d) =>
        setDepartments(
          (d.departments ?? []).map((x: { id: string; name: string }) => ({
            value: x.id,
            label: x.name,
          })),
        ),
      );
    fetch("/api/admin/classes")
      .then((r) => r.json())
      .then((d) => setAllClasses(d.classes ?? []));
    fetch("/api/admin/semesters")
      .then((r) => r.json())
      .then((d) => setAllSemesters(d.semesters ?? []));
    fetch("/api/admin/results/counters")
      .then((r) => r.json())
      .then((d) => setCounters(d));
  }, []);

  // ---------------- Failed Students ----------------
  const [failedFilter, setFailedFilter] = useState<
    "all" | "department" | "department_session" | "class_semester"
  >("all");
  const [failedDeptId, setFailedDeptId] = useState("");
  const [failedSession, setFailedSession] = useState("");
  const [failedClassId, setFailedClassId] = useState("");
  const [failedSemesterId, setFailedSemesterId] = useState("");
  const [failedStudents, setFailedStudents] = useState<FailedStudent[]>([]);
  const [failedLoading, setFailedLoading] = useState(false);

  const sessionsForDept = useMemo(() => {
    const set = new Set(
      allClasses
        .filter((c) => !failedDeptId || c.department_id === failedDeptId)
        .map((c) => c.session),
    );
    return Array.from(set).map((s) => ({ value: s, label: s }));
  }, [allClasses, failedDeptId]);

  const classesForFailedFilter = useMemo(
    () => allClasses.filter((c) => !failedDeptId || c.department_id === failedDeptId),
    [allClasses, failedDeptId],
  );
  const semestersForFailedClass = useMemo(
    () => allSemesters.filter((s) => s.class_id === failedClassId),
    [allSemesters, failedClassId],
  );

  const loadFailed = useCallback(async () => {
    setFailedLoading(true);
    try {
      const params = new URLSearchParams();
      if (failedFilter === "department" && failedDeptId) params.set("department_id", failedDeptId);
      if (failedFilter === "department_session") {
        if (failedDeptId) params.set("department_id", failedDeptId);
        if (failedSession) params.set("session", failedSession);
      }
      if (failedFilter === "class_semester") {
        if (failedClassId) params.set("class_id", failedClassId);
        if (failedSemesterId) params.set("semester_id", failedSemesterId);
      }
      const res = await fetch(`/api/admin/results/failed?${params.toString()}`);
      const data = await res.json();
      setFailedStudents(data.students ?? []);
    } finally {
      setFailedLoading(false);
    }
  }, [failedFilter, failedDeptId, failedSession, failedClassId, failedSemesterId]);

  useEffect(() => {
    if (tab === "failed") loadFailed();
  }, [tab, loadFailed]);

  // ---------------- Upload Result ----------------
  const [upDeptId, setUpDeptId] = useState("");
  const [upClassId, setUpClassId] = useState("");
  const [upSemesterId, setUpSemesterId] = useState("");
  const [upCourseId, setUpCourseId] = useState("");
  const [rosterRows, setRosterRows] = useState<RosterRow[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [instructorName, setInstructorName] = useState("");
  const [exportExamType, setExportExamType] = useState<"MID" | "SEMESTER">("MID");
  const [exportSheetActive, setExportSheetActive] = useState(false);

  const classesForUpload = useMemo(
    () => allClasses.filter((c) => !upDeptId || c.department_id === upDeptId),
    [allClasses, upDeptId],
  );
  const semestersForUploadClass = useMemo(
    () => allSemesters.filter((s) => s.class_id === upClassId),
    [allSemesters, upClassId],
  );
  const selectedUploadSemester = useMemo(
    () => allSemesters.find((s) => s.id === upSemesterId),
    [allSemesters, upSemesterId],
  );
  const coursesForUploadSemester = (selectedUploadSemester?.courses ?? []).filter(
    (c) => !(c.credit_hours === 1 || c.code.toLowerCase().includes("lab")),
  );

  const loadRoster = useCallback(async () => {
    if (!upSemesterId || !upCourseId) return;
    setRosterLoading(true);
    try {
      const res = await fetch(
        `/api/admin/results/roster?semester_id=${upSemesterId}&course_id=${upCourseId}`,
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to load roster.");
        setRosterRows([]);
        return;
      }
      setRosterRows(
        (data.rows ?? []).map((r: RosterRow) => {
          const effectiveMid = r.mid_absent
            ? (r.re_mid_absent || r.re_mid === null ? 0 : r.re_mid)
            : r.mid;
          return { ...r, total: effectiveMid + r.sessional + r.final + r.practical };
        }),
      );
      setInstructorName(data.teacher_name || "");
    } finally {
      setRosterLoading(false);
    }
  }, [upSemesterId, upCourseId]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  useEffect(() => {
    if (!upSemesterId || !upCourseId) setInstructorName("");
  }, [upSemesterId, upCourseId]);

  function updateRosterCell(
    studentId: string,
    field: "roll_no" | "mid" | "mid_absent" | "re_mid" | "re_mid_absent" | "sessional" | "final" | "practical" | "status",
    value: string | number | boolean,
  ) {
    setRosterRows((prev) =>
      prev.map((r) => {
        if (r.student_id !== studentId) return r;
        const next = { ...r };
        if (field === "roll_no") next.roll_no = value as string;
        else if (field === "status") next.status = value as RosterRow["status"];
        else if (field === "mid_absent") {
          next.mid_absent = value as boolean;
          if (!value) { next.re_mid = null; next.re_mid_absent = false; }
        }
        else if (field === "re_mid_absent") next.re_mid_absent = value as boolean;
        else if (field === "re_mid") next.re_mid = Number(value) || 0;
        else {
          const num = Number(value) || 0;
          (next as unknown as Record<string, number>)[field] = num;
        }
        const effectiveMid = next.mid_absent
          ? (next.re_mid_absent || next.re_mid === null ? 0 : next.re_mid)
          : next.mid;
        next.total = effectiveMid + next.sessional + next.final + next.practical;
        return next;
      }),
    );
  }

  async function handleExportSheet() {
    const styleEl = document.createElement("style");
    styleEl.id = "__export-sheet-portrait";
    styleEl.textContent = "@page { size: A4 portrait !important; }";
    document.head.appendChild(styleEl);
    setExportSheetActive(true);
    await new Promise((r) => setTimeout(r, 150));
    window.print();
    setExportSheetActive(false);
    document.head.removeChild(styleEl);
  }

  async function handleSaveRoster() {
    if (!upSemesterId || !upCourseId || rosterRows.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/results/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semester_id: upSemesterId,
          course_id: upCourseId,
          rows: rosterRows.map((r) => ({
            student_id: r.student_id,
            roll_no: r.roll_no,
            mid: r.mid,
            mid_absent: r.mid_absent,
            re_mid: r.re_mid,
            re_mid_absent: r.re_mid_absent,
            sessional: r.sessional,
            final: r.final,
            practical: r.practical,
            status: r.status,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Results saved.");
      loadRoster();
    } finally {
      setSaving(false);
    }
  }

  // ---------------- Freezed / Dropped ----------------
  const [freezedDeptId, setFreezedDeptId] = useState("");
  const [freezedClassId, setFreezedClassId] = useState("");
  const [freezedStudents, setFreezedStudents] = useState<FreezeDropStudent[]>([]);
  const [freezedLoading, setFreezedLoading] = useState(false);

  const [droppedDeptId, setDroppedDeptId] = useState("");
  const [droppedClassId, setDroppedClassId] = useState("");
  const [droppedStudents, setDroppedStudents] = useState<FreezeDropStudent[]>([]);
  const [droppedLoading, setDroppedLoading] = useState(false);

  const classesForFreezed = useMemo(
    () => allClasses.filter((c) => !freezedDeptId || c.department_id === freezedDeptId),
    [allClasses, freezedDeptId],
  );
  const classesForDropped = useMemo(
    () => allClasses.filter((c) => !droppedDeptId || c.department_id === droppedDeptId),
    [allClasses, droppedDeptId],
  );

  const loadFreezed = useCallback(async () => {
    setFreezedLoading(true);
    try {
      const params = new URLSearchParams();
      if (freezedDeptId) params.set("department_id", freezedDeptId);
      if (freezedClassId) params.set("class_id", freezedClassId);
      const res = await fetch(`/api/admin/results/freezed?${params.toString()}`);
      const data = await res.json();
      setFreezedStudents(data.students ?? []);
    } finally {
      setFreezedLoading(false);
    }
  }, [freezedDeptId, freezedClassId]);

  const loadDropped = useCallback(async () => {
    setDroppedLoading(true);
    try {
      const params = new URLSearchParams();
      if (droppedDeptId) params.set("department_id", droppedDeptId);
      if (droppedClassId) params.set("class_id", droppedClassId);
      const res = await fetch(`/api/admin/results/dropped?${params.toString()}`);
      const data = await res.json();
      setDroppedStudents(data.students ?? []);
    } finally {
      setDroppedLoading(false);
    }
  }, [droppedDeptId, droppedClassId]);

  useEffect(() => {
    if (tab === "freezed") loadFreezed();
  }, [tab, loadFreezed]);
  useEffect(() => {
    if (tab === "dropped") loadDropped();
  }, [tab, loadDropped]);

  // ---------------- Search Result ----------------
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOptions, setSearchOptions] = useState<SearchStudent[]>([]);
  const [searchStudentId, setSearchStudentId] = useState("");
  const [sheetStudent, setSheetStudent] = useState<SearchStudent | null>(null);
  const [sheetSemesters, setSheetSemesters] = useState<ResultSheetSemester[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => {
      fetch(`/api/admin/results/students?q=${encodeURIComponent(searchQuery)}`)
        .then((r) => r.json())
        .then((d) => setSearchOptions(d.students ?? []));
    }, 250);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  async function loadSheet(studentId: string) {
    if (!studentId) return;
    setSheetLoading(true);
    try {
      const res = await fetch(`/api/admin/results/search?student_id=${studentId}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to load result sheet.");
        return;
      }
      setSheetStudent(data.student);
      setSheetSemesters(data.semesters ?? []);
    } finally {
      setSheetLoading(false);
    }
  }

  // ---------------- Mid Exam Date Sheet ----------------
  const [dsDeptId, setDsDeptId] = useState("");
  const [dsClassId, setDsClassId] = useState("");
  const [dsSemesterId, setDsSemesterId] = useState("");
  const [dsRows, setDsRows] = useState<DsRow[]>([]);
  const [dsLoading, setDsLoading] = useState(false);
  const [dsBulkSaving, setDsBulkSaving] = useState(false);
  const [dsRowSaving, setDsRowSaving] = useState<Record<string, boolean>>({});

  const classesForDs = useMemo(
    () => allClasses.filter((c) => !dsDeptId || c.department_id === dsDeptId),
    [allClasses, dsDeptId],
  );
  const semestersForDs = useMemo(
    () => allSemesters.filter((s) => s.class_id === dsClassId && s.status === "active"),
    [allSemesters, dsClassId],
  );

  const loadDs = useCallback(async () => {
    if (!dsSemesterId) return;
    setDsLoading(true);
    try {
      const res = await fetch(`/api/admin/mid-exam-datesheet?semester_id=${dsSemesterId}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to load date sheet.");
        return;
      }
      setDsRows(
        (data.rows ?? []).map((r: DsRow) => ({
          ...r,
          paper_date: r.paper_date ?? "",
          bundle_received_date: r.bundle_received_date ?? "",
          return_date: r.return_date ?? "",
        })),
      );
    } finally {
      setDsLoading(false);
    }
  }, [dsSemesterId]);

  useEffect(() => {
    if (tab === "datesheet") loadDs();
  }, [tab, loadDs]);

  const printMode =
    tab === "failed"
      ? "failed"
      : tab === "freezed"
        ? "freezed"
        : tab === "dropped"
          ? "dropped"
          : "search";

  const exportCls = allClasses.find((c) => c.id === upClassId);
  const exportCourse = coursesForUploadSemester.find((c) => c.id === upCourseId);
  const exportDept = departments.find((d) => d.value === upDeptId);
  const exportHalfLen = Math.ceil(rosterRows.length / 2);
  const exportLeftRows = rosterRows.slice(0, exportHalfLen);
  const exportRightRows = rosterRows.slice(exportHalfLen);
  const exportAppeared = rosterRows.filter(
    (r) => !r.mid_absent || (r.re_mid !== null && !r.re_mid_absent),
  ).length;
  const exportAbsent = rosterRows.length - exportAppeared;

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 print:hidden sm:grid-cols-3">
        <div className="card-3d p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Students (with results)
          </p>
          <p className="mt-1 text-2xl font-bold">{counters.total_students}</p>
        </div>
        <div className="card-3d p-4 shadow-sm">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Pass</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {counters.passed}
          </p>
        </div>
        <div className="card-3d p-4 shadow-sm">
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">Failed</p>
          <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">
            {counters.failed}
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 print:hidden">
        {(
          [
            ["failed", "Failed Students"],
            ["upload", "Upload Result"],
            ["freezed", "Freezed Students"],
            ["dropped", "Dropped Students"],
            ["search", "Search Result"],
            ["datesheet", "Mid Exam Date Sheet"],
            ["remid-datesheet", "Re-Mid Exam Date Sheet"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === key
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "failed" && (
        <div>
          <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Filter</label>
              <select
                value={failedFilter}
                onChange={(e) => setFailedFilter(e.target.value as typeof failedFilter)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="all">All</option>
                <option value="department">Department</option>
                <option value="department_session">Department + Session</option>
                <option value="class_semester">Class + Semester</option>
              </select>
            </div>
            {(failedFilter === "department" || failedFilter === "department_session") && (
              <div className="w-56">
                <label className="mb-1 block text-xs font-medium text-slate-500">Department</label>
                <SearchableSelect
                  options={departments}
                  value={departments.find((d) => d.value === failedDeptId) || null}
                  onChange={(v) => setFailedDeptId((v as SelectOption | null)?.value || "")}
                />
              </div>
            )}
            {failedFilter === "department_session" && (
              <div className="w-40">
                <label className="mb-1 block text-xs font-medium text-slate-500">Session</label>
                <SearchableSelect
                  options={sessionsForDept}
                  value={sessionsForDept.find((s) => s.value === failedSession) || null}
                  onChange={(v) => setFailedSession((v as SelectOption | null)?.value || "")}
                />
              </div>
            )}
            {failedFilter === "class_semester" && (
              <>
                <div className="w-56">
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Department
                  </label>
                  <SearchableSelect
                    options={departments}
                    value={departments.find((d) => d.value === failedDeptId) || null}
                    onChange={(v) => {
                      setFailedDeptId((v as SelectOption | null)?.value || "");
                      setFailedClassId("");
                      setFailedSemesterId("");
                    }}
                  />
                </div>
                <div className="w-56">
                  <label className="mb-1 block text-xs font-medium text-slate-500">Class</label>
                  <SearchableSelect
                    options={classesForFailedFilter.map((c) => ({
                      value: c.id,
                      label: `${c.class_name} (${c.session})`,
                    }))}
                    value={
                      classesForFailedFilter
                        .filter((c) => c.id === failedClassId)
                        .map((c) => ({
                          value: c.id,
                          label: `${c.class_name} (${c.session})`,
                        }))[0] || null
                    }
                    onChange={(v) => {
                      setFailedClassId((v as SelectOption | null)?.value || "");
                      setFailedSemesterId("");
                    }}
                  />
                </div>
                <div className="w-48">
                  <label className="mb-1 block text-xs font-medium text-slate-500">Semester</label>
                  <SearchableSelect
                    options={semestersForFailedClass.map((s) => ({
                      value: s.id,
                      label: `Sem ${s.semester_number} - ${s.term_type}`,
                    }))}
                    value={
                      semestersForFailedClass
                        .filter((s) => s.id === failedSemesterId)
                        .map((s) => ({
                          value: s.id,
                          label: `Sem ${s.semester_number} - ${s.term_type}`,
                        }))[0] || null
                    }
                    onChange={(v) => setFailedSemesterId((v as SelectOption | null)?.value || "")}
                  />
                </div>
              </>
            )}
            <button
              onClick={loadFailed}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Search size={16} /> Apply
            </button>
            <button
              onClick={() => window.print()}
              className="ml-auto flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <FileDown size={16} /> Export PDF
            </button>
          </div>

          {failedLoading ? (
            <DataFetchLoader />
          ) : (
            <PrintHeader
              title="Failed Students Report"
              subtitle={`${failedStudents.length} student(s)`}
              active={printMode === "failed"}
            >
              <table className="w-full border-collapse text-sm print:text-[11px]">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100 text-left dark:border-slate-700 dark:bg-slate-800 print:bg-indigo-100">
                    <th className="px-2 py-1.5">Student Name</th>
                    <th className="px-2 py-1.5">Department</th>
                    <th className="px-2 py-1.5">University</th>
                    <th className="px-2 py-1.5">Class</th>
                    <th className="px-2 py-1.5">Session</th>
                    <th className="px-2 py-1.5">Failed Courses</th>
                  </tr>
                </thead>
                <tbody>
                  {failedStudents.map((s) => (
                    <tr
                      key={s.student_id}
                      className="border-b border-slate-200 dark:border-slate-800"
                    >
                      <td className="px-2 py-1.5 font-medium">{s.student_name}</td>
                      <td className="px-2 py-1.5">{s.department_name}</td>
                      <td className="px-2 py-1.5">{s.university_name || "-"}</td>
                      <td className="px-2 py-1.5">{s.class_name}</td>
                      <td className="px-2 py-1.5">{s.session}</td>
                      <td className="px-2 py-1.5">
                        {s.failed_courses.map((c, idx) => (
                          <div key={idx}>
                            {c.course_code} - {c.course_title} (Sem {c.semester_number}{" "}
                            {c.term_type})
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                  {failedStudents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-2 py-6 text-center text-slate-400">
                        No failed students found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </PrintHeader>
          )}
        </div>
      )}

      {tab === "upload" && (
        <div>
          <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
            <div className="w-56">
              <label className="mb-1 block text-xs font-medium text-slate-500">Department</label>
              <SearchableSelect
                options={departments}
                value={departments.find((d) => d.value === upDeptId) || null}
                onChange={(v) => {
                  setUpDeptId((v as SelectOption | null)?.value || "");
                  setUpClassId("");
                  setUpSemesterId("");
                  setUpCourseId("");
                  setRosterRows([]);
                }}
              />
            </div>
            <div className="w-56">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Class + Session
              </label>
              <SearchableSelect
                options={classesForUpload.map((c) => ({
                  value: c.id,
                  label: `${c.class_name} (${c.session})`,
                }))}
                value={
                  classesForUpload
                    .filter((c) => c.id === upClassId)
                    .map((c) => ({ value: c.id, label: `${c.class_name} (${c.session})` }))[0] ||
                  null
                }
                onChange={(v) => {
                  setUpClassId((v as SelectOption | null)?.value || "");
                  setUpSemesterId("");
                  setUpCourseId("");
                  setRosterRows([]);
                }}
              />
            </div>
            <div className="w-48">
              <label className="mb-1 block text-xs font-medium text-slate-500">Semester</label>
              <SearchableSelect
                options={semestersForUploadClass.map((s) => ({
                  value: s.id,
                  label: `Sem ${s.semester_number} - ${s.term_type} (${s.status})`,
                }))}
                value={
                  semestersForUploadClass
                    .filter((s) => s.id === upSemesterId)
                    .map((s) => ({
                      value: s.id,
                      label: `Sem ${s.semester_number} - ${s.term_type} (${s.status})`,
                    }))[0] || null
                }
                onChange={(v) => {
                  setUpSemesterId((v as SelectOption | null)?.value || "");
                  setUpCourseId("");
                  setRosterRows([]);
                }}
              />
            </div>
            <div className="w-64">
              <label className="mb-1 block text-xs font-medium text-slate-500">Course</label>
              <SearchableSelect
                options={coursesForUploadSemester.map((c) => ({
                  value: c.id,
                  label: `${c.code} - ${c.title}`,
                }))}
                value={
                  coursesForUploadSemester
                    .filter((c) => c.id === upCourseId)
                    .map((c) => ({ value: c.id, label: `${c.code} - ${c.title}` }))[0] || null
                }
                onChange={(v) => setUpCourseId((v as SelectOption | null)?.value || "")}
                isDisabled={!upSemesterId}
              />
            </div>
          </div>

          {rosterLoading ? (
            <DataFetchLoader />
          ) : upSemesterId && upCourseId ? (
            <>
              {exportSheetActive && (
                <div className="hidden print:block">
                  <div className="mb-4 border-b-4 border-indigo-600 pb-3 text-center">
                    <h1 className="text-xl font-bold">CITY COLLEGE (UNIVERSITY CAMPUS)</h1>
                    <h2 className="text-sm font-semibold text-indigo-700">Exam Result Sheet</h2>
                    <p className="text-xs text-slate-600">
                      {exportDept?.label || "—"} &nbsp;|&nbsp; {exportCls?.class_name || "—"} ({exportCls?.session || "—"})
                    </p>
                    <p className="text-xs text-slate-500">Generated: {new Date().toLocaleDateString()}</p>
                  </div>
                  <div className="mb-4 grid grid-cols-2 gap-x-8 gap-y-0.5 text-[11px]">
                    <div><span className="font-semibold">DEPARTMENT:</span> {exportDept?.label || "—"}</div>
                    <div><span className="font-semibold">COURSE TITLE:</span> {exportCourse?.title || "—"}</div>
                    <div><span className="font-semibold">CLASS:</span> {exportCls?.class_name || "—"}</div>
                    <div><span className="font-semibold">COURSE CODE:</span> {exportCourse?.code || "—"}</div>
                    <div><span className="font-semibold">SESSION:</span> {exportCls?.session || "—"}</div>
                    <div><span className="font-semibold">CREDIT HOURS:</span> {exportCourse?.credit_hours ?? "—"}</div>
                    <div><span className="font-semibold">DATE:</span> {new Date().toLocaleDateString("en-PK")}</div>
                    <div><span className="font-semibold">INSTRUCTOR:</span> {instructorName || "—"}</div>
                    <div><span className="font-semibold">EXAM:</span> {exportExamType}</div>
                    <div><span className="font-semibold">CANDIDATES APPEARED:</span> {exportAppeared}</div>
                    <div><span className="font-semibold">ABSENT:</span> {exportAbsent}</div>
                  </div>
                  <div className="flex gap-6 text-[11px]">
                    {[exportLeftRows, exportRightRows].filter((g) => g.length > 0).map((group, gi) => (
                      <table key={gi} className="flex-1 border-collapse">
                        <thead>
                          <tr className="bg-slate-200">
                            <th className="border border-slate-400 px-2 py-0.5 text-left">Roll No</th>
                            <th className="border border-slate-400 px-2 py-0.5 text-left">Mid Marks</th>
                            <th className="border border-slate-400 px-2 py-0.5 text-left">Sessional</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.map((r) => (
                            <tr key={r.student_id}>
                              <td className="border border-slate-300 px-2 py-0.5">{r.roll_no || "—"}</td>
                              <td className="border border-slate-300 px-2 py-0.5">{r.mid}</td>
                              <td className="border border-slate-300 px-2 py-0.5">{r.sessional}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ))}
                  </div>
                </div>
              )}
              <div className={exportSheetActive ? "print:hidden" : ""}>
            <div className="overflow-x-auto card-3d shadow-sm">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-800 dark:bg-slate-800">
                    <th className="px-3 py-2">Roll No</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Mid</th>
                    <th className="px-3 py-2">Sessional</th>
                    <th className="px-3 py-2">Final</th>
                    <th className="px-3 py-2">Practical</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rosterRows.map((r) => (
                    <tr
                      key={r.student_id}
                      className="border-b border-slate-100 dark:border-slate-800"
                    >
                      <td className="px-3 py-1.5">
                        <input
                          value={r.roll_no || ""}
                          onChange={(e) =>
                            updateRosterCell(r.student_id, "roll_no", e.target.value)
                          }
                          className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                        />
                      </td>
                      <td className="px-3 py-1.5 font-medium">{r.name}</td>
                      {(["mid", "sessional", "final", "practical"] as const).map((field) => (
                        <td key={field} className="px-3 py-1.5">
                          <input
                            type="number"
                            value={r[field]}
                            onChange={(e) => updateRosterCell(r.student_id, field, e.target.value)}
                            className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-1.5 font-semibold">{r.total?.toFixed(2)}</td>
                      <td className="px-3 py-1.5">
                        <select
                          value={r.status}
                          onChange={(e) => updateRosterCell(r.student_id, "status", e.target.value)}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                        >
                          <option value="pass">Pass</option>
                          <option value="fail">Fail</option>
                          <option value="freezed">Freezed</option>
                          <option value="drop">Drop</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                  {rosterRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                        No students found for this class.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {rosterRows.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <select
                      value={exportExamType}
                      onChange={(e) => setExportExamType(e.target.value as "MID" | "SEMESTER")}
                      className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="MID">MID Exam</option>
                      <option value="SEMESTER">Semester Exam</option>
                    </select>
                    <button
                      onClick={handleExportSheet}
                      disabled={exportSheetActive}
                      className="flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                    >
                      <FileDown size={16} /> Export Sheet
                    </button>
                  </div>
                  <button
                    onClick={handleSaveRoster}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {saving ? <ButtonLoader /> : <Save size={16} />} Save Results
                  </button>
                </div>
              )}
            </div>
              </div>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">
              Select a department, class, semester and course to load the roster.
            </p>
          )}
        </div>
      )}

      {tab === "freezed" && (
        <div>
          <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
            <div className="w-56">
              <label className="mb-1 block text-xs font-medium text-slate-500">Department</label>
              <SearchableSelect
                options={departments}
                value={departments.find((d) => d.value === freezedDeptId) || null}
                onChange={(v) => {
                  setFreezedDeptId((v as SelectOption | null)?.value || "");
                  setFreezedClassId("");
                }}
              />
            </div>
            <div className="w-56">
              <label className="mb-1 block text-xs font-medium text-slate-500">Class</label>
              <SearchableSelect
                options={classesForFreezed.map((c) => ({
                  value: c.id,
                  label: `${c.class_name} (${c.session})`,
                }))}
                value={
                  classesForFreezed
                    .filter((c) => c.id === freezedClassId)
                    .map((c) => ({ value: c.id, label: `${c.class_name} (${c.session})` }))[0] ||
                  null
                }
                onChange={(v) => setFreezedClassId((v as SelectOption | null)?.value || "")}
              />
            </div>
            <button
              onClick={loadFreezed}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Search size={16} /> Apply
            </button>
            <button
              onClick={() => window.print()}
              className="ml-auto flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <FileDown size={16} /> Export PDF
            </button>
          </div>
          {freezedLoading ? (
            <DataFetchLoader />
          ) : (
            <PrintHeader
              title="Freezed Students Report"
              subtitle={`${freezedStudents.length} student(s)`}
              active={printMode === "freezed"}
            >
              <table className="w-full border-collapse text-sm print:text-[11px]">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100 text-left dark:border-slate-700 dark:bg-slate-800 print:bg-sky-100">
                    <th className="px-2 py-1.5">Student Name</th>
                    <th className="px-2 py-1.5">Department</th>
                    <th className="px-2 py-1.5">Class</th>
                    <th className="px-2 py-1.5">Session</th>
                    <th className="px-2 py-1.5">Freezed Semester</th>
                  </tr>
                </thead>
                <tbody>
                  {freezedStudents.map((s, idx) => (
                    <tr
                      key={`${s.student_id}-${idx}`}
                      className="border-b border-slate-200 dark:border-slate-800"
                    >
                      <td className="px-2 py-1.5 font-medium">{s.student_name}</td>
                      <td className="px-2 py-1.5">{s.department_name}</td>
                      <td className="px-2 py-1.5">{s.class_name}</td>
                      <td className="px-2 py-1.5">{s.session}</td>
                      <td className="px-2 py-1.5">
                        Sem {s.semester_number} - {s.term_type}
                      </td>
                    </tr>
                  ))}
                  {freezedStudents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-2 py-6 text-center text-slate-400">
                        No freezed students found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </PrintHeader>
          )}
        </div>
      )}

      {tab === "dropped" && (
        <div>
          <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
            <div className="w-56">
              <label className="mb-1 block text-xs font-medium text-slate-500">Department</label>
              <SearchableSelect
                options={departments}
                value={departments.find((d) => d.value === droppedDeptId) || null}
                onChange={(v) => {
                  setDroppedDeptId((v as SelectOption | null)?.value || "");
                  setDroppedClassId("");
                }}
              />
            </div>
            <div className="w-56">
              <label className="mb-1 block text-xs font-medium text-slate-500">Class</label>
              <SearchableSelect
                options={classesForDropped.map((c) => ({
                  value: c.id,
                  label: `${c.class_name} (${c.session})`,
                }))}
                value={
                  classesForDropped
                    .filter((c) => c.id === droppedClassId)
                    .map((c) => ({ value: c.id, label: `${c.class_name} (${c.session})` }))[0] ||
                  null
                }
                onChange={(v) => setDroppedClassId((v as SelectOption | null)?.value || "")}
              />
            </div>
            <button
              onClick={loadDropped}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Search size={16} /> Apply
            </button>
            <button
              onClick={() => window.print()}
              className="ml-auto flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <FileDown size={16} /> Export PDF
            </button>
          </div>
          {droppedLoading ? (
            <DataFetchLoader />
          ) : (
            <PrintHeader
              title="Dropped Students Report"
              subtitle={`${droppedStudents.length} student(s)`}
              active={printMode === "dropped"}
            >
              <table className="w-full border-collapse text-sm print:text-[11px]">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100 text-left dark:border-slate-700 dark:bg-slate-800 print:bg-amber-100">
                    <th className="px-2 py-1.5">Student Name</th>
                    <th className="px-2 py-1.5">Department</th>
                    <th className="px-2 py-1.5">Class</th>
                    <th className="px-2 py-1.5">Session</th>
                    <th className="px-2 py-1.5">Semester</th>
                    <th className="px-2 py-1.5">Drop Date</th>
                  </tr>
                </thead>
                <tbody>
                  {droppedStudents.map((s, idx) => (
                    <tr
                      key={`${s.student_id}-${idx}`}
                      className="border-b border-slate-200 dark:border-slate-800"
                    >
                      <td className="px-2 py-1.5 font-medium">{s.student_name}</td>
                      <td className="px-2 py-1.5">{s.department_name}</td>
                      <td className="px-2 py-1.5">{s.class_name}</td>
                      <td className="px-2 py-1.5">{s.session}</td>
                      <td className="px-2 py-1.5">
                        Sem {s.semester_number} - {s.term_type}
                      </td>
                      <td className="px-2 py-1.5">{formatDateOnly(s.drop_date)}</td>
                    </tr>
                  ))}
                  {droppedStudents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-2 py-6 text-center text-slate-400">
                        No dropped students found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </PrintHeader>
          )}
        </div>
      )}

      {tab === "search" && (
        <div>
          <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
            <div className="w-72">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Search Student
              </label>
              <SearchableSelect
                options={searchOptions.map((s) => ({
                  value: s.id,
                  label: `${s.name}${s.roll_no ? ` (${s.roll_no})` : ""} — ${s.class_name} · ${s.session}`,
                }))}
                onInputChange={(v) => setSearchQuery(v)}
                value={
                  searchOptions
                    .filter((s) => s.id === searchStudentId)
                    .map((s) => ({ value: s.id, label: `${s.name}${s.roll_no ? ` (${s.roll_no})` : ""} — ${s.class_name} · ${s.session}` }))[0] || null
                }
                onChange={(v) => {
                  const id = (v as SelectOption | null)?.value || "";
                  setSearchStudentId(id);
                  if (id) loadSheet(id);
                  else {
                    setSheetStudent(null);
                    setSheetSemesters([]);
                  }
                }}
              />
            </div>
            {sheetStudent && (
              <button
                onClick={() => window.print()}
                className="ml-auto flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <FileDown size={16} /> Export PDF
              </button>
            )}
          </div>

          {sheetLoading ? (
            <DataFetchLoader />
          ) : sheetStudent ? (
            <PrintHeader
              title="Student Result Sheet"
              subtitle={`${sheetStudent.name}${sheetStudent.roll_no ? ` (Roll No: ${sheetStudent.roll_no})` : ""} — ${sheetStudent.class_name}, ${sheetStudent.session}, ${sheetStudent.department_name}`}
              active={printMode === "search"}
            >
              {sheetSemesters.map((sem) => (
                <div key={sem.semester_number} className="mb-6">
                  <h3 className="mb-2 rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white print:bg-indigo-600 print:text-white">
                    Semester {sem.semester_number} — {sem.term_type}
                  </h3>
                  <table className="w-full border-collapse text-sm print:text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-300 bg-slate-100 text-left dark:border-slate-700 dark:bg-slate-800 print:bg-indigo-600 print:text-white">
                        <th className="px-2 py-1.5">Code</th>
                        <th className="px-2 py-1.5">Course</th>
                        <th className="px-2 py-1.5">Cr. Hrs</th>
                        <th className="px-2 py-1.5">Mid</th>
                        <th className="px-2 py-1.5">Sessional</th>
                        <th className="px-2 py-1.5">Final</th>
                        <th className="px-2 py-1.5">Practical</th>
                        <th className="px-2 py-1.5">Total</th>
                        <th className="px-2 py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sem.courses.map((c, idx) => (
                        <tr
                          key={c.course_code}
                          className={`border-b border-slate-200 dark:border-slate-800 ${idx % 2 === 1 ? "print:bg-indigo-50/60" : ""}`}
                        >
                          <td className="px-2 py-1.5">{c.course_code}</td>
                          <td className="px-2 py-1.5">{c.course_title}</td>
                          <td className="px-2 py-1.5">{c.credit_hours}</td>
                          <td className="px-2 py-1.5">{Number(c.mid).toFixed(2)}</td>
                          <td className="px-2 py-1.5">{Number(c.sessional).toFixed(2)}</td>
                          <td className="px-2 py-1.5">{Number(c.final).toFixed(2)}</td>
                          <td className="px-2 py-1.5">{Number(c.practical).toFixed(2)}</td>
                          <td className="px-2 py-1.5 font-semibold">
                            {Number(c.total).toFixed(2)}
                          </td>
                          <td className="px-2 py-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass[c.status]}`}
                            >
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-indigo-300 bg-slate-50 font-semibold dark:bg-slate-800/50 print:bg-indigo-50">
                        <td className="px-2 py-1.5" colSpan={7}>
                          Total Credit Hours: {sem.courses.reduce((s, c) => s + Number(c.credit_hours), 0)}
                        </td>
                        <td className="px-2 py-1.5 text-indigo-700 dark:text-indigo-400 print:text-indigo-700">
                          {sem.courses.reduce((s, c) => s + Number(c.total), 0).toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5" />
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
              {sheetSemesters.length === 0 && (
                <p className="py-10 text-center text-sm text-slate-400">
                  No results found for this student.
                </p>
              )}
            </PrintHeader>
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">
              Search and select a student to view their result sheet.
            </p>
          )}
        </div>
      )}

      {tab === "datesheet" && (
        <div>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="w-56">
              <label className="mb-1 block text-xs font-medium text-slate-500">Department</label>
              <SearchableSelect
                options={departments}
                value={departments.find((d) => d.value === dsDeptId) || null}
                onChange={(v) => {
                  setDsDeptId((v as SelectOption | null)?.value || "");
                  setDsClassId("");
                  setDsSemesterId("");
                  setDsRows([]);
                }}
              />
            </div>
            <div className="w-56">
              <label className="mb-1 block text-xs font-medium text-slate-500">Class</label>
              <SearchableSelect
                options={classesForDs.map((c) => ({
                  value: c.id,
                  label: `${c.class_name} (${c.session})`,
                }))}
                value={
                  classesForDs
                    .filter((c) => c.id === dsClassId)
                    .map((c) => ({ value: c.id, label: `${c.class_name} (${c.session})` }))[0] || null
                }
                onChange={(v) => {
                  setDsClassId((v as SelectOption | null)?.value || "");
                  setDsSemesterId("");
                  setDsRows([]);
                }}
                isDisabled={!dsDeptId}
              />
            </div>
            <div className="w-64">
              <label className="mb-1 block text-xs font-medium text-slate-500">Semester (Active only)</label>
              <SearchableSelect
                options={semestersForDs.map((s) => ({
                  value: s.id,
                  label: `Semester ${s.semester_number} – ${s.term_type}`,
                }))}
                value={
                  semestersForDs
                    .filter((s) => s.id === dsSemesterId)
                    .map((s) => ({
                      value: s.id,
                      label: `Semester ${s.semester_number} – ${s.term_type}`,
                    }))[0] || null
                }
                onChange={(v) => {
                  setDsSemesterId((v as SelectOption | null)?.value || "");
                  setDsRows([]);
                }}
                isDisabled={!dsClassId}
              />
            </div>
            {dsSemesterId && (
              <button
                onClick={loadDs}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Search size={15} /> Refresh
              </button>
            )}
          </div>

          {!dsSemesterId ? (
            <p className="py-10 text-center text-sm text-slate-400">
              Select a department, class, and active semester to view the date sheet.
            </p>
          ) : dsLoading ? (
            <DataFetchLoader />
          ) : (
            <>
              <div className="overflow-x-auto card-3d shadow-sm">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-800 dark:bg-slate-800">
                      <th className="px-3 py-2">Course</th>
                      <th className="px-3 py-2">Teacher</th>
                      <th className="px-3 py-2 text-center">Cr. Hrs</th>
                      <th className="px-3 py-2">Paper Date</th>
                      <th className="px-3 py-2">Bundle Received</th>
                      <th className="px-3 py-2">Return Date</th>
                      <th className="px-3 py-2 text-center">Result</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {dsRows.map((r) => (
                      <tr key={r.course_id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-1.5">
                          <div className="font-medium">{r.course_title}</div>
                          <div className="text-xs text-slate-400">{r.course_code}</div>
                        </td>
                        <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{r.teacher_name}</td>
                        <td className="px-3 py-1.5 text-center">{r.credit_hours}</td>
                        <td className="px-3 py-1.5">
                          <input
                            type="date"
                            value={r.paper_date}
                            onChange={(e) =>
                              setDsRows((prev) =>
                                prev.map((row) =>
                                  row.course_id === r.course_id
                                    ? { ...row, paper_date: e.target.value }
                                    : row,
                                ),
                              )
                            }
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="date"
                            value={r.bundle_received_date}
                            onChange={(e) =>
                              setDsRows((prev) =>
                                prev.map((row) =>
                                  row.course_id === r.course_id
                                    ? { ...row, bundle_received_date: e.target.value }
                                    : row,
                                ),
                              )
                            }
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="date"
                            value={r.return_date}
                            onChange={(e) =>
                              setDsRows((prev) =>
                                prev.map((row) =>
                                  row.course_id === r.course_id
                                    ? { ...row, return_date: e.target.value }
                                    : row,
                                ),
                              )
                            }
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              r.result_uploaded
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                            }`}
                          >
                            {r.result_uploaded ? "Uploaded" : "Pending"}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">
                          <button
                            onClick={async () => {
                              setDsRowSaving((p) => ({ ...p, [r.course_id]: true }));
                              try {
                                const res = await fetch("/api/admin/mid-exam-datesheet", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    semester_id: dsSemesterId,
                                    course_id: r.course_id,
                                    paper_date: r.paper_date || null,
                                    bundle_received_date: r.bundle_received_date || null,
                                    return_date: r.return_date || null,
                                  }),
                                });
                                if (!res.ok) {
                                  const d = await res.json();
                                  toast.error(d.error || "Failed to save.");
                                } else {
                                  toast.success(`Saved — ${r.course_code}`);
                                }
                              } finally {
                                setDsRowSaving((p) => ({ ...p, [r.course_id]: false }));
                              }
                            }}
                            disabled={dsRowSaving[r.course_id]}
                            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                          >
                            {dsRowSaving[r.course_id] ? <ButtonLoader /> : <Save size={12} />} Save
                          </button>
                        </td>
                      </tr>
                    ))}
                    {dsRows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-400">
                          No courses found for this semester.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {dsRows.length > 0 && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={async () => {
                      setDsBulkSaving(true);
                      try {
                        const res = await fetch("/api/admin/mid-exam-datesheet", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            semester_id: dsSemesterId,
                            rows: dsRows.map((r) => ({
                              course_id: r.course_id,
                              paper_date: r.paper_date || null,
                              bundle_received_date: r.bundle_received_date || null,
                              return_date: r.return_date || null,
                            })),
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          toast.error(data.error || "Failed to save.");
                          return;
                        }
                        toast.success(`Saved ${data.saved} course(s).`);
                      } finally {
                        setDsBulkSaving(false);
                      }
                    }}
                    disabled={dsBulkSaving}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {dsBulkSaving ? <ButtonLoader /> : <Save size={16} />} Upload / Save Changes
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PrintHeader({
  title,
  subtitle,
  active,
  children,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={active ? "" : "print:hidden"}>
      <div className="mb-4 hidden border-b-4 border-indigo-600 pb-3 text-center print:block">
        <h1 className="text-xl font-bold">CITY COLLEGE (UNIVERSITY CAMPUS)</h1>
        <h2 className="text-base font-semibold text-indigo-700">{title}</h2>
        <p className="text-xs text-slate-600">{subtitle}</p>
        <p className="text-xs text-slate-500">Generated: {new Date().toLocaleDateString()}</p>
      </div>
      <div className="mb-4 hidden print:hidden sm:block">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="overflow-x-auto card-3d p-4 shadow-sm print:border-0 print:p-0 print:shadow-none">
        {children}
      </div>
    </div>
  );
}
