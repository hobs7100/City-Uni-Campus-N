"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Award, ClipboardCheck, Download, User } from "lucide-react";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";
import { DataFetchLoader } from "@/components/ui/Loaders";
import type { SingleValue } from "react-select";
import {
  AttendanceHistoryModal,
  ViewAttendanceHistoryButton,
} from "@/components/studentAttendance/AttendanceHistory";

export interface StudentAttendanceStudent {
  id: string;
  name: string;
  father_name?: string | null;
  roll_no: string | null;
  class_name: string;
  session: string;
}

interface CourseAttendance {
  course_title: string;
  teacher_name: string;
  presents: number;
  absents: number;
  leaves: number;
  percentage: number | null;
}

interface SemesterAttendance {
  semester_id: string;
  semester_number: number;
  term_type: string;
  sem_status: string;
  courses: CourseAttendance[];
  overall: {
    presents: number;
    absents: number;
    leaves: number;
    percentage: number | null;
  };
}

interface StudentOfMonthRow {
  student_id: string;
  name: string;
  class_name: string;
  session: string;
  semester_number: number;
  percentage: number;
  profile_image_url: string | null;
}

function previousMonthSelection() {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function csvCell(value: string | number | null) {
  const raw = String(value ?? "");
  const text = /^[\u0000-\u0020]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replaceAll('"', '""')}"`;
}

function percentageBadge(percentage: number | null) {
  if (percentage === null) return <span className="text-xs text-slate-400">—</span>;
  const className =
    percentage >= 75
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
      : percentage >= 60
        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
        : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>
      {percentage}%
    </span>
  );
}

export default function StudentAttendanceLookup({
  students,
}: {
  students: StudentAttendanceStudent[];
}) {
  const initialMonth = previousMonthSelection();
  const [tab, setTab] = useState<"lookup" | "month">("lookup");
  const [studentId, setStudentId] = useState("");
  const [semesters, setSemesters] = useState<SemesterAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [studentInfo, setStudentInfo] = useState<StudentAttendanceStudent | null>(null);
  const [historySemester, setHistorySemester] = useState<SemesterAttendance | null>(null);
  const [monthYear, setMonthYear] = useState(initialMonth.year);
  const [month, setMonth] = useState(initialMonth.month);
  const [monthRows, setMonthRows] = useState<StudentOfMonthRow[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthError, setMonthError] = useState("");
  const [loadedPeriod, setLoadedPeriod] = useState(initialMonth);
  const monthRequestId = useRef(0);

  const studentOptions = useMemo(
    () =>
      students.map((student) => ({
        value: student.id,
        label: `${student.name}${student.father_name ? ` — ${student.father_name}` : ""}${student.roll_no ? ` (${student.roll_no})` : ""} — ${student.class_name} ${student.session}`,
      })),
    [students],
  );

  const loadAttendance = useCallback(async (selectedStudentId: string) => {
    if (!selectedStudentId) {
      setSemesters([]);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `/api/hod/student-attendance?student_id=${encodeURIComponent(selectedStudentId)}`,
      );
      const data = await response.json();
      if (response.ok) setSemesters(data.semesters ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleStudentChange(option: SingleValue<SelectOption>) {
    const selectedId = option?.value ?? "";
    setStudentId(selectedId);
    setStudentInfo(students.find((student) => student.id === selectedId) ?? null);
    setSemesters([]);
    if (selectedId) loadAttendance(selectedId);
  }

  const loadStudentsOfMonth = useCallback(async (selectedYear: number, selectedMonth: number) => {
    const requestId = ++monthRequestId.current;
    setMonthLoading(true);
    setMonthError("");
    try {
      const response = await fetch(
        `/api/admin/student-attendance/student-of-month?year=${selectedYear}&month=${selectedMonth}`,
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => null);
      if (requestId !== monthRequestId.current) return;
      if (!response.ok) {
        setMonthRows([]);
        setMonthError(data?.error || "Could not load students of the month.");
        return;
      }
      setMonthRows(data.students ?? []);
      setLoadedPeriod({ year: selectedYear, month: selectedMonth });
    } catch (error) {
      if (requestId !== monthRequestId.current) return;
      setMonthRows([]);
      setMonthError(
        error instanceof Error ? error.message : "Could not load students of the month.",
      );
    } finally {
      if (requestId === monthRequestId.current) setMonthLoading(false);
    }
  }, []);

  function downloadStudentsOfMonthCsv() {
    const lines = [
      ["Name", "Class", "Session", "Semester", "Percentage", "Profile Picture URL"],
      ...monthRows.map((row) => [
        row.name,
        row.class_name,
        row.session,
        row.semester_number,
        `${row.percentage}%`,
        row.profile_image_url ?? "",
      ]),
    ];
    const csv = `\uFEFF${lines.map((line) => line.map(csvCell).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `students-of-the-month-${loadedPeriod.year}-${String(loadedPeriod.month).padStart(2, "0")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div aria-label="Attendance views" className="flex w-fit gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setTab("lookup")}
          aria-pressed={tab === "lookup"}
          className={`rounded-md px-3 py-2 text-sm font-semibold ${
            tab === "lookup"
              ? "bg-indigo-600 text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          Student Attendance
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("month");
            if (monthRows.length === 0 && !monthLoading) {
              void loadStudentsOfMonth(monthYear, month);
            }
          }}
          aria-pressed={tab === "month"}
          className={`rounded-md px-3 py-2 text-sm font-semibold ${
            tab === "month"
              ? "bg-amber-500 text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <Award size={15} className="mr-1.5 inline" />
          Student of the Month
        </button>
      </div>

      {tab === "month" ? (
        <section aria-label="Student of the Month results">
          <div className="card-3d flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Year
                </span>
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={monthYear}
                  onChange={(event) => setMonthYear(Number(event.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Month
                </span>
                <select
                  value={month}
                  onChange={(event) => setMonth(Number(event.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {monthNames.map((name, index) => (
                    <option key={name} value={index + 1}>{name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void loadStudentsOfMonth(monthYear, month)}
                disabled={monthLoading || monthYear < 2000 || monthYear > 2100}
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {monthLoading ? "Loading…" : "View Students"}
              </button>
              <button
                type="button"
                onClick={downloadStudentsOfMonthCsv}
                disabled={monthRows.length === 0 || monthLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={16} />
                Download CSV
              </button>
            </div>
          </div>

          <div aria-live="polite" className="overflow-hidden card-3d">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">
                  {monthNames[loadedPeriod.month - 1]} {loadedPeriod.year}
                </h2>
                <p className="text-xs text-slate-500">Students with 100% recorded attendance</p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                {monthRows.length} students
              </span>
            </div>
            {monthLoading ? (
              <DataFetchLoader />
            ) : monthError ? (
              <div role="alert" className="p-10 text-center text-sm text-red-600">{monthError}</div>
            ) : monthRows.length === 0 ? (
              <div className="p-14 text-center">
                <Award size={38} className="mx-auto text-slate-300 dark:text-slate-600" />
                <p className="mt-3 text-sm text-slate-500">No students have 100% attendance for this month.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Profile</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Class</th>
                      <th className="px-4 py-3">Session</th>
                      <th className="px-4 py-3">Semester</th>
                      <th className="px-4 py-3 text-center">Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {monthRows.map((row) => (
                      <tr key={row.student_id} className="hover:bg-amber-50/40 dark:hover:bg-amber-500/5">
                        <td className="px-4 py-3">
                          {row.profile_image_url ? (
                            <img
                              src={row.profile_image_url}
                              alt={`${row.name} profile`}
                              className="h-11 w-11 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                            />
                          ) : (
                            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                              <User size={18} />
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{row.name}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.class_name}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.session}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">Semester {row.semester_number}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                            {row.percentage}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section aria-label="Individual student attendance lookup">
      <div className="card-3d p-4">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <User size={12} className="mr-1 inline" /> Search Student
        </label>
        <SearchableSelect
          options={studentOptions}
          value={studentOptions.find((option) => option.value === studentId) ?? null}
          onChange={(option) => handleStudentChange(option as SingleValue<SelectOption>)}
          placeholder="Select student by name, roll no, class or session…"
        />
        {studentInfo && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {studentInfo.class_name} &middot; {studentInfo.session}
            {studentInfo.roll_no ? ` · Roll: ${studentInfo.roll_no}` : ""}
            {studentInfo.father_name ? ` · Father Name: ${studentInfo.father_name}` : ""}
          </p>
        )}
      </div>

      {!studentId ? (
        <div className="card-3d flex flex-col items-center justify-center gap-3 py-16 text-center">
          <ClipboardCheck size={40} className="text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400">Select a student above to view their attendance record.</p>
        </div>
      ) : loading ? (
        <DataFetchLoader />
      ) : semesters.length === 0 ? (
        <div className="card-3d py-16 text-center text-sm text-slate-400">
          No attendance records found for this student.
        </div>
      ) : (
        semesters.map((semester) => {
          const overall = semester.overall;
          const overallTotal = overall.presents + overall.absents;
          const overallPercentage =
            overallTotal > 0 ? Math.round((overall.presents / overallTotal) * 100) : null;

          return (
            <div key={semester.semester_id} className="overflow-hidden card-3d">
              <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-3 dark:border-slate-800 dark:from-indigo-900/20 dark:to-blue-900/20">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Semester {semester.semester_number}
                  {semester.term_type ? ` — ${semester.term_type}` : ""}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                      semester.sem_status === "active"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {semester.sem_status}
                  </span>
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Course</th>
                      <th className="px-4 py-2">Teacher</th>
                      <th className="px-4 py-2 text-center">Present</th>
                      <th className="px-4 py-2 text-center">Absent</th>
                      <th className="px-4 py-2 text-center">Leave</th>
                      <th className="px-4 py-2 text-center">%</th>
                      <th className="px-4 py-2 text-center">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {semester.courses.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-4 text-center text-xs text-slate-400">
                          No course-wise attendance marked by teachers for this semester.
                        </td>
                      </tr>
                    ) : (
                      semester.courses.map((course, index) => (
                        <tr key={`${course.course_title}-${course.teacher_name}-${index}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">{course.course_title}</td>
                          <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{course.teacher_name}</td>
                          <td className="px-4 py-2.5 text-center font-semibold text-emerald-600">{course.presents}</td>
                          <td className="px-4 py-2.5 text-center font-semibold text-red-500">{course.absents}</td>
                          <td className="px-4 py-2.5 text-center font-semibold text-amber-500">{course.leaves}</td>
                          <td className="px-4 py-2.5 text-center">{percentageBadge(course.percentage)}</td>
                          <td className="px-4 py-2.5" />
                        </tr>
                      ))
                    )}
                    <tr className="bg-indigo-50/60 dark:bg-indigo-900/20">
                      <td colSpan={2} className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                        Overall Attendance (Admin / Coordinator)
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-emerald-600">{overall.presents}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-red-500">{overall.absents}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-amber-500">{overall.leaves}</td>
                      <td className="px-4 py-2.5 text-center">{percentageBadge(overallPercentage)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <ViewAttendanceHistoryButton onClick={() => setHistorySemester(semester)} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
      {historySemester && studentInfo && (
        <AttendanceHistoryModal
          studentId={studentInfo.id}
          semesterId={historySemester.semester_id}
          studentName={`${studentInfo.name} — Semester ${historySemester.semester_number}`}
          onClose={() => setHistorySemester(null)}
        />
      )}
        </section>
      )}
    </div>
  );
}