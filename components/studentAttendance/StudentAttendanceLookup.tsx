"use client";

import { useCallback, useMemo, useState } from "react";
import { ClipboardCheck, User } from "lucide-react";
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
  const [studentId, setStudentId] = useState("");
  const [semesters, setSemesters] = useState<SemesterAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [studentInfo, setStudentInfo] = useState<StudentAttendanceStudent | null>(null);
  const [historySemester, setHistorySemester] = useState<SemesterAttendance | null>(null);

  const studentOptions = useMemo(
    () =>
      students.map((student) => ({
        value: student.id,
        label: `${student.name}${student.roll_no ? ` (${student.roll_no})` : ""} — ${student.class_name} ${student.session}`,
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

  return (
    <div className="space-y-4">
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
    </div>
  );
}