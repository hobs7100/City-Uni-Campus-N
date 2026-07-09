"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FileDown, Save } from "lucide-react";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";
import { formatDateOnly } from "@/lib/format";
import { TableLoader, ButtonLoader } from "@/components/ui/Loaders";

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
}

interface RosterRow {
  student_id: string;
  name: string;
  roll_no: string | null;
  contact: string | null;
  status: "present" | "absent" | "leave";
  reason: string;
  call_remarks: string;
  already_marked: boolean;
}

interface ReportRow {
  student_id: string;
  name: string;
  roll_no: string | null;
  contact: string | null;
  student_status: string;
  presents: number;
  absents: number;
  leaves: number;
  percentage: number | null;
  flag: "ok" | "warning" | "struck_off";
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const flagLabels: Record<string, string> = {
  ok: "OK",
  warning: "Warning",
  struck_off: "Struck Off",
};
const flagStyles: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  struck_off: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

export default function StudentAttendanceManager({ role = "admin" }: { role?: "admin" | "coordinator" }) {
  const [tab, setTab] = useState<"mark" | "report">("mark");
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [allClasses, setAllClasses] = useState<ClassOption[]>([]);
  const [allSemesters, setAllSemesters] = useState<SemesterOption[]>([]);

  const [date, setDate] = useState(todayStr());
  const [departmentId, setDepartmentId] = useState("");
  const [classId, setClassId] = useState("");
  const [semesterInfo, setSemesterInfo] = useState<Record<string, unknown> | null>(null);
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [reportDepartmentId, setReportDepartmentId] = useState("");
  const [reportClassId, setReportClassId] = useState("");
  const [reportSemesterId, setReportSemesterId] = useState("");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

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
  }, []);

  const classOptions = useMemo(
    () =>
      allClasses
        .filter((c) => !departmentId || c.department_id === departmentId)
        .map((c) => ({ value: c.id, label: `${c.class_name} (${c.session})` })),
    [allClasses, departmentId],
  );

  const reportClassOptions = useMemo(
    () =>
      allClasses
        .filter((c) => !reportDepartmentId || c.department_id === reportDepartmentId)
        .map((c) => ({ value: c.id, label: `${c.class_name} (${c.session})` })),
    [allClasses, reportDepartmentId],
  );

  const reportSemesterOptions = useMemo(
    () =>
      allSemesters
        .filter((s) => !reportClassId || s.class_id === reportClassId)
        .map((s) => ({
          value: s.id,
          label: `Sem ${s.semester_number} — ${s.term_type} (${s.status})`,
        })),
    [allSemesters, reportClassId],
  );

  const loadRoster = useCallback(async () => {
    if (!classId || !date) {
      setRows([]);
      setSemesterInfo(null);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ class_id: classId, date });
      const res = await fetch(`/api/admin/student-attendance/roster?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not load roster.");
        setRows([]);
        setSemesterInfo(null);
        return;
      }
      setSemesterInfo(data.semester);
      setRows(data.rows);
    } finally {
      setLoading(false);
    }
  }, [classId, date]);

  useEffect(() => {
    if (tab === "mark") loadRoster();
  }, [tab, loadRoster]);

  function updateRow(studentId: string, patch: Partial<RosterRow>) {
    setRows((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, ...patch } : r)));
  }

  async function handleSave() {
    if (!semesterInfo) return;
    setSaving(true);
    try {
      const saveRows = role === "coordinator"
        ? rows.filter((r) => !r.already_marked)
        : rows;
      if (saveRows.length === 0) {
        toast("All attendance for this date is already saved.");
        return;
      }
      const res = await fetch("/api/admin/student-attendance/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semester_id: semesterInfo.id,
          attendance_date: date,
          rows: saveRows.map((r) => ({
            student_id: r.student_id,
            status: r.status,
            reason: r.status === "present" ? null : r.reason || null,
            call_remarks: r.call_remarks || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Attendance saved.");
    } finally {
      setSaving(false);
    }
  }

  const loadReport = useCallback(async () => {
    if (!reportSemesterId) {
      setReportRows([]);
      return;
    }
    setReportLoading(true);
    try {
      const params = new URLSearchParams({ semester_id: reportSemesterId });
      if (reportDepartmentId) params.set("department_id", reportDepartmentId);
      if (reportClassId) params.set("class_id", reportClassId);
      if (reportFrom) params.set("from", reportFrom);
      if (reportTo) params.set("to", reportTo);
      const res = await fetch(`/api/admin/student-attendance/report?${params.toString()}`);
      const data = await res.json();
      if (res.ok) setReportRows(data.students);
    } finally {
      setReportLoading(false);
    }
  }, [reportSemesterId, reportDepartmentId, reportClassId, reportFrom, reportTo]);

  useEffect(() => {
    if (tab === "report") loadReport();
  }, [tab, loadReport]);

  const reportSummary = useMemo(() => {
    const parts: string[] = [];
    if (reportDepartmentId)
      parts.push(departments.find((d) => d.value === reportDepartmentId)?.label ?? "");
    if (reportClassId)
      parts.push(reportClassOptions.find((c) => c.value === reportClassId)?.label ?? "");
    if (reportSemesterId)
      parts.push(reportSemesterOptions.find((s) => s.value === reportSemesterId)?.label ?? "");
    if (reportFrom || reportTo) parts.push(`${reportFrom || "…"} to ${reportTo || "…"}`);
    return parts.join(" ·");
  }, [
    reportDepartmentId,
    reportClassId,
    reportSemesterId,
    reportFrom,
    reportTo,
    departments,
    reportClassOptions,
    reportSemesterOptions,
  ]);

  function handleExportPdf() {
    window.print();
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Student Attendance</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Mark daily class attendance and review history
          </p>
        </div>
        <div className="flex gap-2 rounded-lg border border-slate-300 p-1 dark:border-slate-700">
          <button
            onClick={() => setTab("mark")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "mark" ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-300"}`}
          >
            Mark Attendance
          </button>
          <button
            onClick={() => setTab("report")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "report" ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-300"}`}
          >
            Attendance Report
          </button>
        </div>
      </div>

      {tab === "mark" && (
        <div className="print:hidden">
          <div className="mb-4 grid grid-cols-1 gap-3 card-3d p-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Department
              </label>
              <SearchableSelect
                options={departments}
                value={departments.find((d) => d.value === departmentId) || null}
                onChange={(opt) => {
                  setDepartmentId(opt ? (opt as SelectOption).value : "");
                  setClassId("");
                }}
                placeholder="Select department"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Class + Session
              </label>
              <SearchableSelect
                options={classOptions}
                value={classOptions.find((c) => c.value === classId) || null}
                onChange={(opt) => setClassId(opt ? (opt as SelectOption).value : "")}
                placeholder="Select class"
              />
            </div>
          </div>

          {semesterInfo && (
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Active Semester: {String(semesterInfo.semester_number)} —{" "}
              {String(semesterInfo.term_type)}
            </p>
          )}

          <div className="overflow-hidden card-3d card-hover">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Cell No</th>
                  <th className="px-4 py-3">Reason (Absent/Leave)</th>
                  <th className="px-4 py-3">Call Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <TableLoader colSpan={5} />
                ) : !classId ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                      Select a department and class to load the roster.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                      No active students found for this class.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const isReadOnly = role === "coordinator" && r.already_marked;
                    const statusColors: Record<string, string> = {
                      present: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
                      absent: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
                      leave: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
                    };
                    return (
                      <tr key={r.student_id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${isReadOnly ? "opacity-80" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div>
                              <div className="font-medium text-slate-800 dark:text-slate-100">
                                {r.name}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {r.roll_no || "—"}
                              </div>
                            </div>
                            {isReadOnly && (
                              <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:bg-slate-700 dark:text-slate-500">
                                saved
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {isReadOnly ? (
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusColors[r.status] ?? ""}`}>
                              {r.status}
                            </span>
                          ) : (
                            <div className="flex items-center gap-3">
                              {(["present", "absent", "leave"] as const).map((opt) => (
                                <label key={opt} className="flex cursor-pointer items-center gap-1.5">
                                  <input
                                    type="radio"
                                    name={`status-${r.student_id}`}
                                    value={opt}
                                    checked={r.status === opt}
                                    onChange={() => updateRow(r.student_id, { status: opt })}
                                    className="accent-indigo-600"
                                  />
                                  <span className={`text-xs font-medium capitalize ${
                                    opt === "present"
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : opt === "absent"
                                      ? "text-red-500 dark:text-red-400"
                                      : "text-amber-500 dark:text-amber-400"
                                  }`}>
                                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {r.contact || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {isReadOnly ? (
                            <span className="text-sm text-slate-500 dark:text-slate-400">{r.reason || "—"}</span>
                          ) : (
                            <input
                              type="text"
                              disabled={r.status === "present"}
                              value={r.reason}
                              onChange={(e) => updateRow(r.student_id, { reason: e.target.value })}
                              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-900"
                              placeholder="Optional"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isReadOnly ? (
                            <span className="text-sm text-slate-500 dark:text-slate-400">{r.call_remarks || "—"}</span>
                          ) : (
                            <input
                              type="text"
                              value={r.call_remarks}
                              onChange={(e) =>
                                updateRow(r.student_id, { call_remarks: e.target.value })
                              }
                              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              placeholder="Optional"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {rows.length > 0 && !(role === "coordinator" && rows.every((r) => r.already_marked)) && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? <ButtonLoader /> : <Save size={16} />}
                Save Attendance
              </button>
            </div>
          )}
          {rows.length > 0 && role === "coordinator" && rows.every((r) => r.already_marked) && (
            <div className="mt-4 flex justify-end">
              <span className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                <Save size={16} />
                Attendance already saved for this date
              </span>
            </div>
          )}
        </div>
      )}

      {tab === "report" && (
        <div>
          <div className="mb-4 grid grid-cols-1 gap-3 card-3d p-4 print:hidden sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Department
              </label>
              <SearchableSelect
                options={departments}
                value={departments.find((d) => d.value === reportDepartmentId) || null}
                onChange={(opt) => {
                  const v = opt ? (opt as SelectOption).value : "";
                  setReportDepartmentId(v);
                  setReportClassId("");
                  setReportSemesterId("");
                }}
                placeholder="Select department"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Class + Session
              </label>
              <SearchableSelect
                options={reportClassOptions}
                value={reportClassOptions.find((c) => c.value === reportClassId) || null}
                onChange={(opt) => {
                  const v = opt ? (opt as SelectOption).value : "";
                  setReportClassId(v);
                  setReportSemesterId("");
                }}
                placeholder="Select class"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Semester
              </label>
              <SearchableSelect
                options={reportSemesterOptions}
                value={reportSemesterOptions.find((s) => s.value === reportSemesterId) || null}
                onChange={(opt) => setReportSemesterId(opt ? (opt as SelectOption).value : "")}
                placeholder="Select semester"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                From (optional)
              </label>
              <input
                type="date"
                value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                To (optional)
              </label>
              <input
                type="date"
                value={reportTo}
                onChange={(e) => setReportTo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div className="flex items-end lg:col-span-5">
              <button
                onClick={handleExportPdf}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FileDown size={18} /> Export PDF
              </button>
            </div>
          </div>

          <div className="overflow-hidden card-3d print:hidden">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Cell No</th>
                  <th className="px-4 py-3">Presents</th>
                  <th className="px-4 py-3">Absents</th>
                  <th className="px-4 py-3">Leaves</th>
                  <th className="px-4 py-3">Percentage</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reportLoading ? (
                  <TableLoader colSpan={7} />
                ) : !reportSemesterId ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      Select a semester to load the report.
                    </td>
                  </tr>
                ) : reportRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      No students found.
                    </td>
                  </tr>
                ) : (
                  reportRows.map((r) => (
                    <tr key={r.student_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-slate-100">
                          {r.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {r.roll_no || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">{r.contact || "—"}</td>
                      <td className="px-4 py-3">{r.presents}</td>
                      <td className="px-4 py-3">{r.absents}</td>
                      <td className="px-4 py-3">{r.leaves}</td>
                      <td className="px-4 py-3">
                        {r.percentage !== null ? `${r.percentage}%` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${flagStyles[r.flag]}`}
                        >
                          {flagLabels[r.flag]}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="hidden print:block">
            <div className="mb-3 rounded-lg border-2 border-indigo-600 bg-gradient-to-r from-indigo-600 to-sky-500 p-3 text-center text-white">
              <h2 className="text-lg font-extrabold tracking-wide">
                City College (University Campus)
              </h2>
              <p className="text-xs font-semibold opacity-90">Student Attendance Report</p>
              <p className="text-sm font-bold">{reportSummary || "All Students"}</p>
              <p className="text-[10px] opacity-80">
                Generated: {formatDateOnly(new Date().toISOString())}
              </p>
            </div>
            <table className="w-full border-collapse text-left text-[11px]">
              <thead className="bg-indigo-600 text-white">
                <tr>
                  <th className="border border-indigo-400 px-1.5 py-0.5">Roll No</th>
                  <th className="border border-indigo-400 px-1.5 py-0.5">Student</th>
                  <th className="border border-indigo-400 px-1.5 py-0.5">Cell No</th>
                  <th className="border border-indigo-400 px-1.5 py-0.5">Presents</th>
                  <th className="border border-indigo-400 px-1.5 py-0.5">Absents</th>
                  <th className="border border-indigo-400 px-1.5 py-0.5">Leaves</th>
                  <th className="border border-indigo-400 px-1.5 py-0.5">Percentage</th>
                  <th className="border border-indigo-400 px-1.5 py-0.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((r, idx) => (
                  <tr key={r.student_id} className={idx % 2 === 0 ? "bg-indigo-50/60" : "bg-white"}>
                    <td className="border border-indigo-200 px-1.5 py-0.5 text-slate-800">
                      {r.roll_no || "—"}
                    </td>
                    <td className="border border-indigo-200 px-1.5 py-0.5 text-slate-800">
                      {r.name}
                    </td>
                    <td className="border border-indigo-200 px-1.5 py-0.5 text-slate-800">
                      {r.contact || "—"}
                    </td>
                    <td className="border border-indigo-200 px-1.5 py-0.5 text-slate-800">
                      {r.presents}
                    </td>
                    <td className="border border-indigo-200 px-1.5 py-0.5 text-slate-800">
                      {r.absents}
                    </td>
                    <td className="border border-indigo-200 px-1.5 py-0.5 text-slate-800">
                      {r.leaves}
                    </td>
                    <td className="border border-indigo-200 px-1.5 py-0.5 text-slate-800">
                      {r.percentage !== null ? `${r.percentage}%` : "—"}
                    </td>
                    <td className="border border-indigo-200 px-1.5 py-0.5 text-slate-800">
                      {flagLabels[r.flag]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
