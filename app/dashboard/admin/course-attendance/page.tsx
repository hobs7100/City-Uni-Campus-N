"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookCheck, CheckCircle2, XCircle, GraduationCap, ClipboardList, Search, AlertTriangle } from "lucide-react";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";

interface CourseGroup {
  course_title: string;
  course_code: string;
  credit_hours: string;
  class_id: string;
  class_name: string;
  session: string;
  semester_number: number;
  teacher_id: string;
  teacher_name: string;
  teacher_type: string;
  teacher_count: number;
  coord_count: number;
}

interface Course {
  id: string;
  code: string;
  title: string;
  department_id: string;
  department_name: string;
  credit_hours: string;
  status: string;
}

interface Department {
  id: string;
  name: string;
}

export default function CourseAttendancePage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses,     setCourses]     = useState<Course[]>([]);
  const [deptId,      setDeptId]      = useState("");
  const [courseId,    setCourseId]    = useState("");
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [groups,      setGroups]      = useState<CourseGroup[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [fetched,     setFetched]     = useState(false);

  /* ── load departments + courses on mount ── */
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/departments").then((r) => r.json()),
      fetch("/api/admin/courses").then((r) => r.json()),
    ]).then(([dData, cData]) => {
      if (dData.departments) setDepartments(dData.departments);
      if (cData.courses)     setCourses(cData.courses);
    });
  }, []);

  const filteredCourses = useMemo(
    () => (deptId ? courses.filter((c) => c.department_id === deptId) : courses),
    [courses, deptId],
  );

  const deptOptions: SelectOption[]   = departments.map((d) => ({ value: d.id, label: d.name }));
  const courseOptions: SelectOption[] = filteredCourses.map((c) => ({
    value: c.id,
    label: `${c.code} — ${c.title}`,
  }));

  // When a specific course is selected → show all (matched + mismatched) for that course.
  // When no course → show only mismatched across all (optionally filtered by dept).
  const load = useCallback(async () => {
    setLoading(true);
    setFetched(false);
    try {
      const params = new URLSearchParams();
      if (courseId)  params.set("course_id",     courseId);
      if (deptId)    params.set("department_id", deptId);
      if (dateFrom)  params.set("date_from",      dateFrom);
      if (dateTo)    params.set("date_to",        dateTo);
      // When no specific course selected show mismatched only
      if (!courseId) params.set("mismatch_only", "true");

      const res  = await fetch(`/api/admin/course-attendance?${params}`);
      const data = await res.json();
      if (res.ok) {
        setGroups(data.groups ?? []);
        setFetched(true);
      }
    } finally {
      setLoading(false);
    }
  }, [courseId, deptId, dateFrom, dateTo]);

  /* auto-load on mount and whenever filters change */
  useEffect(() => { load(); }, [load]);

  const matched    = groups.filter((g) => Number(g.teacher_count) === Number(g.coord_count));
  const mismatched = groups.filter((g) => Number(g.teacher_count) !== Number(g.coord_count));

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-500/10">
            <BookCheck size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Course Attendance</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {courseId
                ? "Showing all records for the selected course — matched and mismatched"
                : "Showing all mismatched records across all courses — select a course to see full details"}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 card-3d rounded-2xl p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Department */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Department
            </label>
            <SearchableSelect
              options={deptOptions}
              value={deptOptions.find((d) => d.value === deptId) || null}
              onChange={(opt) => {
                setDeptId(opt ? (opt as SelectOption).value : "");
                setCourseId("");
              }}
              placeholder="All departments…"
            />
          </div>

          {/* Course */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Course
            </label>
            <SearchableSelect
              options={courseOptions}
              value={courseOptions.find((c) => c.value === courseId) || null}
              onChange={(opt) => {
                setCourseId(opt ? (opt as SelectOption).value : "");
              }}
              placeholder="All courses…"
            />
          </div>

          {/* Date From */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              From Date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              To Date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="mt-4 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          <Search size={14} />
          {loading ? "Loading…" : "Apply Filters"}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      )}

      {/* No results */}
      {!loading && fetched && groups.length === 0 && (
        <div className="card-3d flex flex-col items-center gap-3 rounded-2xl py-16 text-center">
          <CheckCircle2 size={40} className="text-emerald-400" />
          <p className="font-semibold text-slate-600 dark:text-slate-300">All attendance counts match</p>
          <p className="text-sm text-slate-400">No mismatches found for the current filters.</p>
        </div>
      )}

      {/* Summary bar */}
      {!loading && groups.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          {/* Mismatch alert pill — always visible when mismatches exist */}
          {mismatched.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-400">
              <AlertTriangle size={15} />
              {mismatched.length} mismatch{mismatched.length !== 1 ? "es" : ""}
            </div>
          )}
          {courseId && matched.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CheckCircle2 size={15} />
              {matched.length} matched
            </div>
          )}
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <GraduationCap size={15} className="text-indigo-500" />
            {groups.length} group{groups.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Cards grid */}
      {!loading && groups.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => {
            const tCount  = Number(g.teacher_count);
            const cCount  = Number(g.coord_count);
            const isMatch = tCount === cCount;
            return (
              <div
                key={`${g.class_id}-${g.semester_number}-${g.teacher_id}`}
                className="card-3d card-hover group relative flex flex-col overflow-hidden rounded-2xl p-0 transition-all duration-300"
              >
                {/* Coloured top accent */}
                <div
                  className={`h-1.5 w-full ${
                    isMatch
                      ? "bg-gradient-to-r from-emerald-400 to-green-500"
                      : "bg-gradient-to-r from-red-400 to-rose-500"
                  }`}
                />

                <div className="flex flex-1 flex-col gap-4 p-5">
                  {/* Course info */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
                          {g.course_code}
                        </span>
                        <h3 className="mt-0.5 text-[15px] font-semibold leading-snug text-slate-800 dark:text-slate-100">
                          {g.course_title}
                        </h3>
                      </div>
                      <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                        {g.credit_hours} Cr
                      </span>
                    </div>
                  </div>

                  {/* Class / session / semester / teacher */}
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {g.class_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {g.session} &middot; Semester {g.semester_number}
                    </p>
                    <p className="mt-1 truncate text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      {g.teacher_name}
                      <span className="ml-1 font-normal text-slate-400">
                        ({g.teacher_type === "permanent" ? "Permanent" : "Visiting"})
                      </span>
                    </p>
                  </div>

                  {/* Attendance counts */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Teacher */}
                    <div className="flex flex-col items-center gap-1 rounded-xl border border-slate-100 bg-white py-3 dark:border-slate-700 dark:bg-slate-800/40">
                      <GraduationCap size={18} className="text-indigo-400" />
                      <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                        {tCount}
                      </span>
                      <span className="text-center text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        Teacher
                      </span>
                    </div>
                    {/* Coordinator/Admin */}
                    <div className="flex flex-col items-center gap-1 rounded-xl border border-slate-100 bg-white py-3 dark:border-slate-700 dark:bg-slate-800/40">
                      <ClipboardList size={18} className="text-violet-400" />
                      <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                        {cCount}
                      </span>
                      <span className="text-center text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        Coordinator/Admin
                      </span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="mt-auto pt-1">
                    {isMatch ? (
                      <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                        <CheckCircle2 size={16} />
                        Attendance Matched
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 rounded-xl bg-red-50 py-2.5 text-sm font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-400">
                        <XCircle size={16} />
                        {tCount > cCount
                          ? `Mismatch — Teacher +${tCount - cCount} more`
                          : `Mismatch — Coordinator +${cCount - tCount} more`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
