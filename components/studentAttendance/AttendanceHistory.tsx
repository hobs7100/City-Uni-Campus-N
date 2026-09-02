"use client";

import { useEffect, useState } from "react";
import { Eye, X } from "lucide-react";
import { formatDateOnly } from "@/lib/format";
import { DataFetchLoader } from "@/components/ui/Loaders";
import type { StudentAttendanceHistoryRecord } from "@/lib/student-attendance-history";

const attendanceStyles: Record<string, string> = {
  present: "text-emerald-600 dark:text-emerald-400",
  absent: "text-red-600 dark:text-red-400",
  leave: "text-amber-600 dark:text-amber-400",
};

const standingStyles: Record<string, string> = {
  active:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  warning:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  struck_off:
    "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

const standingLabels: Record<string, string> = {
  active: "Active",
  warning: "Warning",
  struck_off: "Struck Off",
};

export function AttendanceHistoryTable({
  records,
}: {
  records: StudentAttendanceHistoryRecord[];
}) {
  if (records.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-slate-400">
        No attendance history found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Attendance Status</th>
            <th className="px-4 py-3">Percentage on This Date</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {records.map((record) => (
            <tr key={record.attendance_date}>
              <td className="px-4 py-3">{formatDateOnly(record.attendance_date)}</td>
              <td
                className={`px-4 py-3 font-semibold capitalize ${
                  attendanceStyles[record.attendance_status] ?? ""
                }`}
              >
                {record.attendance_status}
              </td>
              <td className="px-4 py-3 font-medium">
                {record.percentage === null ? "—" : `${record.percentage}%`}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    standingStyles[record.standing] ?? ""
                  }`}
                >
                  {standingLabels[record.standing] ?? record.standing}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface AttendanceHistoryModalProps {
  studentId: string;
  semesterId: string;
  studentName: string;
  from?: string;
  to?: string;
  onClose: () => void;
}

export function AttendanceHistoryModal({
  studentId,
  semesterId,
  studentName,
  from,
  to,
  onClose,
}: AttendanceHistoryModalProps) {
  const [records, setRecords] = useState<StudentAttendanceHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      student_id: studentId,
      semester_id: semesterId,
    });
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    setLoading(true);
    setError("");
    fetch(`/api/student-attendance/history?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load attendance history.");
        setRecords(data.records ?? []);
      })
      .catch((requestError: Error) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [studentId, semesterId, from, to]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">
              Attendance History
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{studentName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close attendance history"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[calc(88vh-76px)] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-16">
              <DataFetchLoader />
            </div>
          ) : error ? (
            <div className="px-5 py-12 text-center text-sm text-red-500">{error}</div>
          ) : (
            <AttendanceHistoryTable records={records} />
          )}
        </div>
      </div>
    </div>
  );
}

export function ViewAttendanceHistoryButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:border-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
    >
      <Eye size={14} />
      View Details
    </button>
  );
}