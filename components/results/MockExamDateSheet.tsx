"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Pencil, Save, Search, Trash2 } from "lucide-react";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";
import { ButtonLoader, DataFetchLoader } from "@/components/ui/Loaders";
import { formatDateOnly } from "@/lib/format";

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

interface MockDateSheetRow {
  course_id: string;
  course_code: string;
  course_title: string;
  credit_hours: string;
  datesheet_id: string | null;
  paper_date: string;
  paper_time: string;
  bundle_received_date: string;
  return_date: string;
}

interface DateSheetSummary {
  semester_id: string;
  semester_number: number;
  term_type: string;
  status: string;
  class_id: string;
  class_name: string;
  session: string;
  department_id: string;
  department_name: string;
  scheduled_courses: number;
  first_paper_date: string | null;
  last_paper_date: string | null;
  created_date: string;
  updated_at: string;
}

function isPracticalCourse(row: Pick<MockDateSheetRow, "credit_hours" | "course_title">) {
  return Number(row.credit_hours) === 1 &&
    !row.course_title.toLowerCase().includes("translation of holy quran");
}

function PaperTimeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [rawHour = "", minute = "00"] = value.split(":");
  const hour24 = Number(rawHour);
  const period = value ? (hour24 >= 12 ? "PM" : "AM") : "AM";
  const hour12 = value ? String(hour24 % 12 || 12) : "";
  const update = (hour: string, nextMinute: string, nextPeriod: string) => {
    if (!hour) return onChange("");
    const base = Number(hour) % 12;
    onChange(`${String(base + (nextPeriod === "PM" ? 12 : 0)).padStart(2, "0")}:${nextMinute}`);
  };
  const cls = "rounded border border-slate-300 bg-white px-1.5 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white";
  return (
    <div className="flex items-center gap-1">
      <select aria-label="Paper hour" value={hour12} onChange={(e) => update(e.target.value, minute, period)} className={cls}>
        <option value="">--</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span>:</span>
      <select aria-label="Paper minute" value={minute} onChange={(e) => update(hour12, e.target.value, period)} disabled={!hour12} className={cls}>
        {["00", "15", "30", "45"].map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <select aria-label="AM or PM" value={period} onChange={(e) => update(hour12, minute, e.target.value)} disabled={!hour12} className={cls}>
        <option>AM</option><option>PM</option>
      </select>
    </div>
  );
}

export default function MockExamDateSheet({
  departments,
  allClasses,
  allSemesters,
}: {
  departments: SelectOption[];
  allClasses: ClassOption[];
  allSemesters: SemesterOption[];
}) {
  const [view, setView] = useState<"edit" | "saved">("edit");
  const [departmentId, setDepartmentId] = useState("");
  const [classId, setClassId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [rows, setRows] = useState<MockDateSheetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [rowSaving, setRowSaving] = useState<Record<string, boolean>>({});

  const [listDepartmentId, setListDepartmentId] = useState("");
  const [listSession, setListSession] = useState("");
  const [listClassId, setListClassId] = useState("");
  const [listSemesterId, setListSemesterId] = useState("");
  const [sheets, setSheets] = useState<DateSheetSummary[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const classesForEditor = useMemo(
    () => allClasses.filter((c) => !departmentId || c.department_id === departmentId),
    [allClasses, departmentId],
  );
  const semestersForEditor = useMemo(
    () => allSemesters.filter((s) =>
      s.class_id === classId &&
      (["active", "mid_term", "final_term"].includes(s.status) || s.id === semesterId),
    ),
    [allSemesters, classId, semesterId],
  );
  const listSessions = useMemo(
    () => Array.from(new Set(allClasses.filter((c) => !listDepartmentId || c.department_id === listDepartmentId).map((c) => c.session)))
      .map((session) => ({ value: session, label: session })),
    [allClasses, listDepartmentId],
  );
  const listClasses = useMemo(
    () => allClasses.filter((c) =>
      (!listDepartmentId || c.department_id === listDepartmentId) &&
      (!listSession || c.session === listSession)),
    [allClasses, listDepartmentId, listSession],
  );
  const listSemesters = useMemo(
    () => allSemesters.filter((s) => !listClassId || s.class_id === listClassId),
    [allSemesters, listClassId],
  );

  const loadRows = useCallback(async () => {
    if (!semesterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/mock-exam-datesheet?semester_id=${semesterId}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to load Mock Exam date sheet.");
        return;
      }
      setRows((data.rows ?? []).map((row: MockDateSheetRow) => ({
        ...row,
        paper_date: row.paper_date ?? "",
        paper_time: row.paper_time ?? "",
        bundle_received_date: row.bundle_received_date ?? "",
        return_date: row.return_date ?? "",
      })));
    } finally {
      setLoading(false);
    }
  }, [semesterId]);

  const loadSavedSheets = useCallback(async () => {
    setListLoading(true);
    try {
      const params = new URLSearchParams({ list: "all" });
      if (listDepartmentId) params.set("department_id", listDepartmentId);
      if (listSession) params.set("session", listSession);
      if (listClassId) params.set("class_id", listClassId);
      if (listSemesterId) params.set("filter_semester_id", listSemesterId);
      const res = await fetch(`/api/admin/mock-exam-datesheet?${params}`);
      const data = await res.json();
      if (res.ok) setSheets(data.sheets ?? []);
      else toast.error(data.error || "Failed to load Mock Exam date sheets.");
    } finally {
      setListLoading(false);
    }
  }, [listDepartmentId, listSession, listClassId, listSemesterId]);

  useEffect(() => {
    if (view !== "edit" || !semesterId) return;
    const timer = setTimeout(() => void loadRows(), 0);
    return () => clearTimeout(timer);
  }, [view, semesterId, loadRows]);
  useEffect(() => {
    if (view !== "saved") return;
    const timer = setTimeout(() => void loadSavedSheets(), 0);
    return () => clearTimeout(timer);
  }, [view, loadSavedSheets]);

  const deleteSheet = async (sheet: DateSheetSummary) => {
    const groupId = sheet.semester_id;
    const label = `${sheet.class_name} (${sheet.session}), Semester ${sheet.semester_number}`;
    if (!window.confirm(`Delete the complete Mock Exam date sheet for ${label}? This removes every paper for the semester.`)) return;
    setDeletingId(groupId);
    try {
      const params = new URLSearchParams({ semester_id: sheet.semester_id });
      const res = await fetch(`/api/admin/mock-exam-datesheet?${params}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to delete Mock Exam date sheet.");
        return;
      }
      toast.success(`Complete date sheet deleted (${data.deleted} papers).`);
      await loadSavedSheets();
    } finally {
      setDeletingId("");
    }
  };

  const saveRow = async (row: MockDateSheetRow) => {
    setRowSaving((prev) => ({ ...prev, [row.course_id]: true }));
    try {
      const res = await fetch("/api/admin/mock-exam-datesheet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semester_id: semesterId,
          course_id: row.course_id,
          paper_date: row.paper_date || null,
          paper_time: row.paper_time || null,
          bundle_received_date: row.bundle_received_date || null,
          return_date: row.return_date || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to save Mock Exam date sheet row.");
      } else {
        toast.success(`Saved — ${row.course_code}`);
      }
    } finally {
      setRowSaving((prev) => ({ ...prev, [row.course_id]: false }));
    }
  };

  const saveAllRows = async () => {
    setBulkSaving(true);
    try {
      const res = await fetch("/api/admin/mock-exam-datesheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semester_id: semesterId,
          rows: rows.map((row) => ({
            course_id: row.course_id,
            paper_date: row.paper_date || null,
            paper_time: row.paper_time || null,
            bundle_received_date: row.bundle_received_date || null,
            return_date: row.return_date || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save Mock Exam date sheet.");
        return;
      }
      toast.success(`Saved ${data.saved} course(s).`);
    } finally {
      setBulkSaving(false);
    }
  };

  const updateRow = (courseId: string, values: Partial<MockDateSheetRow>) => {
    setRows((prev) => prev.map((row) => row.course_id === courseId ? { ...row, ...values } : row));
  };

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button onClick={() => setView("edit")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === "edit" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"}`}>
          Edit Date Sheet
        </button>
        <button onClick={() => setView("saved")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === "saved" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"}`}>
          Saved Mock Exam Sheets
        </button>
      </div>

      {view === "saved" ? (
        <div>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="w-56">
              <label className="mb-1 block text-xs font-medium text-slate-500">Department</label>
              <SearchableSelect options={departments} value={departments.find((d) => d.value === listDepartmentId) || null}
                onChange={(v) => { setListDepartmentId((v as SelectOption | null)?.value || ""); setListSession(""); setListClassId(""); setListSemesterId(""); }} />
            </div>
            <div className="w-44">
              <label className="mb-1 block text-xs font-medium text-slate-500">Session</label>
              <SearchableSelect options={listSessions} value={listSessions.find((s) => s.value === listSession) || null}
                onChange={(v) => { setListSession((v as SelectOption | null)?.value || ""); setListClassId(""); setListSemesterId(""); }}
                isDisabled={!listDepartmentId} />
            </div>
            <div className="w-56">
              <label className="mb-1 block text-xs font-medium text-slate-500">Class</label>
              <SearchableSelect options={listClasses.map((c) => ({ value: c.id, label: c.class_name }))}
                value={listClasses.filter((c) => c.id === listClassId).map((c) => ({ value: c.id, label: c.class_name }))[0] || null}
                onChange={(v) => { setListClassId((v as SelectOption | null)?.value || ""); setListSemesterId(""); }}
                isDisabled={!listSession} />
            </div>
            <div className="w-64">
              <label className="mb-1 block text-xs font-medium text-slate-500">Semester</label>
              <SearchableSelect options={listSemesters.map((s) => ({ value: s.id, label: `Semester ${s.semester_number} – ${s.term_type} (${s.status})` }))}
                value={listSemesters.filter((s) => s.id === listSemesterId).map((s) => ({ value: s.id, label: `Semester ${s.semester_number} – ${s.term_type} (${s.status})` }))[0] || null}
                onChange={(v) => setListSemesterId((v as SelectOption | null)?.value || "")}
                isDisabled={!listClassId} />
            </div>
          </div>
          {listLoading ? <DataFetchLoader /> : sheets.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No saved Mock Exam date sheets match these filters.</p>
          ) : (
            <div className="overflow-x-auto card-3d shadow-sm">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-left dark:border-slate-800">
                  <th className="px-4 py-3">Department</th><th className="px-4 py-3">Class / Session</th>
                  <th className="px-4 py-3">Semester</th><th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Papers</th><th className="px-4 py-3">Date range</th><th className="px-4 py-3" />
                </tr></thead>
                <tbody>{sheets.map((sheet) => {
                  const groupId = sheet.semester_id;
                  return <tr key={groupId} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3">{sheet.department_name}</td>
                    <td className="px-4 py-3"><div className="font-medium">{sheet.class_name}</div><div className="text-xs text-slate-400">{sheet.session}</div></td>
                    <td className="px-4 py-3">Semester {sheet.semester_number} – {sheet.term_type}<div className="text-xs capitalize text-slate-400">{sheet.status}</div></td>
                    <td className="px-4 py-3">{formatDateOnly(sheet.created_date)}</td>
                    <td className="px-4 py-3">{sheet.scheduled_courses}</td>
                    <td className="px-4 py-3">{sheet.first_paper_date ? `${formatDateOnly(sheet.first_paper_date)}${sheet.last_paper_date && sheet.last_paper_date !== sheet.first_paper_date ? ` – ${formatDateOnly(sheet.last_paper_date)}` : ""}` : "Dates pending"}</td>
                    <td className="px-4 py-3"><div className="flex gap-2">
                      <button onClick={() => {
                        setDepartmentId(sheet.department_id);
                        setClassId(sheet.class_id);
                        setSemesterId(sheet.semester_id);
                        setRows([]);
                        setView("edit");
                      }} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"><Pencil size={12} /> View / Edit</button>
                      <button onClick={() => deleteSheet(sheet)} disabled={deletingId === groupId}
                        className="flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                        <Trash2 size={12} /> {deletingId === groupId ? "Deleting…" : "Delete"}
                      </button>
                    </div></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="w-56">
              <label className="mb-1 block text-xs font-medium text-slate-500">Department</label>
              <SearchableSelect options={departments} value={departments.find((d) => d.value === departmentId) || null}
                onChange={(v) => { setDepartmentId((v as SelectOption | null)?.value || ""); setClassId(""); setSemesterId(""); setRows([]); }} />
            </div>
            <div className="w-56">
              <label className="mb-1 block text-xs font-medium text-slate-500">Class</label>
              <SearchableSelect options={classesForEditor.map((c) => ({ value: c.id, label: `${c.class_name} (${c.session})` }))}
                value={classesForEditor.filter((c) => c.id === classId).map((c) => ({ value: c.id, label: `${c.class_name} (${c.session})` }))[0] || null}
                onChange={(v) => { setClassId((v as SelectOption | null)?.value || ""); setSemesterId(""); setRows([]); }}
                isDisabled={!departmentId} />
            </div>
            <div className="w-64">
              <label className="mb-1 block text-xs font-medium text-slate-500">Semester</label>
              <SearchableSelect options={semestersForEditor.map((s) => ({ value: s.id, label: `Semester ${s.semester_number} – ${s.term_type}` }))}
                value={semestersForEditor.filter((s) => s.id === semesterId).map((s) => ({ value: s.id, label: `Semester ${s.semester_number} – ${s.term_type}` }))[0] || null}
                onChange={(v) => { setSemesterId((v as SelectOption | null)?.value || ""); setRows([]); }}
                isDisabled={!classId} />
            </div>
            {semesterId && <button onClick={loadRows} className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><Search size={15} /> Refresh</button>}
          </div>
          {!semesterId ? (
            <p className="py-10 text-center text-sm text-slate-400">Select a department, class, and available semester to view the Mock Exam date sheet.</p>
          ) : loading ? <DataFetchLoader /> : (
            <>
              {[
                { label: "Mock Exam Date Sheet – Theory", isPractical: false, hdrCls: "bg-slate-50 dark:bg-slate-800" },
                { label: "Mock Exam Date Sheet – Practical", isPractical: true, hdrCls: "bg-green-50 dark:bg-green-500/5" },
              ].map(({ label, isPractical, hdrCls }) => {
                const groupedRows = rows.filter((row) => isPracticalCourse(row) === isPractical);
                if (groupedRows.length === 0) return null;
                return <div key={label} className="mb-5">
                  <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</h3>
                  <div className="overflow-x-auto card-3d shadow-sm">
                    <table className="w-full border-collapse text-sm">
                      <thead><tr className={`border-b border-slate-200 ${hdrCls} text-left dark:border-slate-800`}>
                        <th className="px-3 py-2">Course</th><th className="px-3 py-2 text-center">Cr. Hrs</th>
                        <th className="px-3 py-2">Paper Date</th><th className="px-3 py-2">Paper Time</th>
                        <th className="px-3 py-2">Bundle Received</th><th className="px-3 py-2">Return Date</th>
                         <th className="px-3 py-2" />
                      </tr></thead>
                      <tbody>{groupedRows.map((row) => <tr key={row.course_id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-1.5"><div className="font-medium">{row.course_title}</div><div className="text-xs text-slate-400">{row.course_code}</div></td>
                        <td className="px-3 py-1.5 text-center">{row.credit_hours}</td>
                        <td className="px-3 py-1.5"><input type="date" value={row.paper_date} onChange={(e) => updateRow(row.course_id, { paper_date: e.target.value })} className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></td>
                        <td className="px-3 py-1.5"><PaperTimeInput value={row.paper_time} onChange={(paper_time) => updateRow(row.course_id, { paper_time })} /></td>
                        <td className="px-3 py-1.5"><input type="date" value={row.bundle_received_date} onChange={(e) => updateRow(row.course_id, { bundle_received_date: e.target.value })} className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></td>
                        <td className="px-3 py-1.5"><input type="date" value={row.return_date} onChange={(e) => updateRow(row.course_id, { return_date: e.target.value })} className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></td>
                        <td className="px-3 py-1.5"><button onClick={() => saveRow(row)} disabled={rowSaving[row.course_id]} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{rowSaving[row.course_id] ? <ButtonLoader /> : <Save size={12} />} Save</button></td>
                      </tr>)}</tbody>
                    </table>
                  </div>
                </div>;
              })}
              {rows.length > 0 && <div className="mt-3 flex justify-end">
                <button onClick={saveAllRows} disabled={bulkSaving} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                  {bulkSaving ? <ButtonLoader /> : <Save size={16} />} Upload / Save Changes
                </button>
              </div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}