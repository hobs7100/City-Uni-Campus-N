"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, Layers, Loader2, Plus, Printer, Trash2, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SearchableSelect, { SelectOption } from "@/components/ui/SearchableSelect";

interface TimetableInfo {
  id: string;
  class_name: string;
  session: string;
  department_name: string;
  semester_number: number;
  term_type: string;
  semester_status: string;
  shift: "morning" | "evening";
  wef_date: string;
  semester_id: string;
}

interface DayRow {
  id: string;
  day_name: string;
  position: number;
}

interface PeriodRow {
  id: string;
  start_time: string;
  end_time: string;
  position: number;
}

interface CellRow {
  id: string;
  day_id: string;
  period_id: string;
  allocation_id: string | null;
  course_code: string | null;
  course_title: string | null;
  teacher_name: string | null;
  is_combined: boolean | null;
}

interface AllocationOption {
  id: string;
  course_code: string;
  course_title: string;
  teacher_name: string;
  is_combined: boolean;
}

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export default function TimetableGridPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [info, setInfo] = useState<TimetableInfo | null>(null);
  const [days, setDays] = useState<DayRow[]>([]);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [cells, setCells] = useState<CellRow[]>([]);
  const [allocations, setAllocations] = useState<AllocationOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [cellModalOpen, setCellModalOpen] = useState(false);
  const [activeCell, setActiveCell] = useState<CellRow | null>(null);
  const [savingCell, setSavingCell] = useState(false);
  const [selectedAllocationId, setSelectedAllocationId] = useState("");

  const [addPeriodOpen, setAddPeriodOpen] = useState(false);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [savingPeriod, setSavingPeriod] = useState(false);

  const [addDayOpen, setAddDayOpen] = useState(false);
  const [newDayName, setNewDayName] = useState("");
  const [savingDay, setSavingDay] = useState(false);

  const [removePeriodTarget, setRemovePeriodTarget] = useState<PeriodRow | null>(null);
  const [removeDayTarget, setRemoveDayTarget] = useState<DayRow | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/timetables/${id}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to load timetable.");
        return;
      }
      setInfo(data.timetable);
      setDays(data.days);
      setPeriods(data.periods);
      setCells(data.cells);

      if (data.timetable?.semester_id) {
        const allocRes = await fetch(`/api/admin/allocations?semester_id=${data.timetable.semester_id}`);
        const allocData = await allocRes.json();
        if (allocRes.ok) {
          setAllocations(
            allocData.allocations.map((a: { id: string; course_code: string; course_title: string; teacher_name: string; is_combined: boolean }) => ({
              id: a.id,
              course_code: a.course_code,
              course_title: a.course_title,
              teacher_name: a.teacher_name,
              is_combined: a.is_combined,
            }))
          );
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const cellMap = useMemo(() => {
    const map = new Map<string, CellRow>();
    for (const c of cells) map.set(`${c.day_id}:${c.period_id}`, c);
    return map;
  }, [cells]);

  const allocationOptions = useMemo(
    () =>
      allocations.map((a) => ({
        value: a.id,
        label: `${a.course_code} — ${a.course_title} (${a.teacher_name})${a.is_combined ? " · Combined" : ""}`,
      })),
    [allocations]
  );

  function openCell(cell: CellRow) {
    setActiveCell(cell);
    setSelectedAllocationId(cell.allocation_id || "");
    setCellModalOpen(true);
  }

  async function handleSaveCell() {
    if (!activeCell) return;
    setSavingCell(true);
    try {
      const res = await fetch(`/api/admin/timetables/${id}/cells/${activeCell.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocation_id: selectedAllocationId || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success(selectedAllocationId ? "Slot updated." : "Slot cleared.");
      setCellModalOpen(false);
      load();
    } finally {
      setSavingCell(false);
    }
  }

  async function handleAddPeriod(e: React.FormEvent) {
    e.preventDefault();
    if (!newStart || !newEnd) {
      toast.error("Please provide start and end time.");
      return;
    }
    setSavingPeriod(true);
    try {
      const res = await fetch(`/api/admin/timetables/${id}/periods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_time: `${newStart}:00`, end_time: `${newEnd}:00` }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Period added.");
      setAddPeriodOpen(false);
      setNewStart("");
      setNewEnd("");
      load();
    } finally {
      setSavingPeriod(false);
    }
  }

  async function handleAddDay(e: React.FormEvent) {
    e.preventDefault();
    if (!newDayName.trim()) {
      toast.error("Please provide a day name.");
      return;
    }
    setSavingDay(true);
    try {
      const res = await fetch(`/api/admin/timetables/${id}/days`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day_name: newDayName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Day added.");
      setAddDayOpen(false);
      setNewDayName("");
      load();
    } finally {
      setSavingDay(false);
    }
  }

  async function handleRemovePeriod() {
    if (!removePeriodTarget) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/admin/timetables/${id}/periods/${removePeriodTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Period removed.");
      setRemovePeriodTarget(null);
      load();
    } finally {
      setRemoving(false);
    }
  }

  async function handleRemoveDay() {
    if (!removeDayTarget) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/admin/timetables/${id}/days/${removeDayTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        return;
      }
      toast.success("Day removed.");
      setRemoveDayTarget(null);
      load();
    } finally {
      setRemoving(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={28} /></div>;
  }
  if (!info) {
    return <div className="py-10 text-center text-slate-400">Timetable not found.</div>;
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard/admin/timetables")} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{info.class_name} ({info.session})</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {info.department_name} · Sem {info.semester_number} {info.term_type} · <span className="capitalize">{info.shift}</span> Shift · W.e.f {new Date(info.wef_date).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setAddDayOpen(true)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            + Day
          </button>
          <button onClick={() => setAddPeriodOpen(true)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            + Time Slot
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            <Printer size={16} /> Print / PDF
          </button>
        </div>
      </div>

      <div className="hidden print:mb-4 print:block print:rounded-lg print:border-2 print:border-indigo-600 print:bg-gradient-to-r print:from-indigo-600 print:to-sky-500 print:p-4 print:text-center print:text-white">
        <h2 className="text-xl font-extrabold tracking-wide">City College (University Campus)</h2>
        <p className="text-sm font-semibold">Class Timetable — {info.class_name} ({info.session}) — Sem {info.semester_number} {info.term_type} — {info.shift} Shift</p>
        <p className="text-xs opacity-90">W.e.f {new Date(info.wef_date).toLocaleDateString()}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 print:rounded-none print:border-0">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 print:bg-indigo-600 print:text-white">
            <tr>
              <th className="border border-slate-200 px-3 py-2 dark:border-slate-800 print:border-indigo-400">Day</th>
              {periods.map((p) => (
                <th key={p.id} className="border border-slate-200 px-3 py-2 dark:border-slate-800 print:border-indigo-400">
                  <div className="flex items-center justify-between gap-1">
                    <span>{formatTime(p.start_time)} – {formatTime(p.end_time)}</span>
                    <button
                      onClick={() => setRemovePeriodTarget(p)}
                      className="print:hidden flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                      title="Remove period"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day, idx) => (
              <tr key={day.id} className={idx % 2 === 0 ? "print:bg-indigo-50/60" : "print:bg-white"}>
                <td className="border border-slate-200 px-3 py-2 font-medium text-slate-700 dark:border-slate-800 dark:text-slate-200 print:border-indigo-200 print:font-bold print:text-indigo-800">
                  <div className="flex items-center justify-between gap-1">
                    <span>{day.day_name}</span>
                    <button
                      onClick={() => setRemoveDayTarget(day)}
                      className="print:hidden flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                      title="Remove day"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </td>
                {periods.map((p) => {
                  const cell = cellMap.get(`${day.id}:${p.id}`);
                  return (
                    <td key={p.id} className="border border-slate-200 px-2 py-2 align-top dark:border-slate-800 print:border-indigo-200">
                      {cell?.allocation_id ? (
                        <button
                          onClick={() => openCell(cell)}
                          className="w-full rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-50 to-sky-50 p-2 text-left shadow-sm hover:from-indigo-100 hover:to-sky-100 dark:border-indigo-500/30 dark:from-indigo-500/10 dark:to-sky-500/10 dark:hover:from-indigo-500/20 dark:hover:to-sky-500/20 print:border-indigo-300 print:bg-indigo-50 print:shadow-none print:hover:bg-indigo-50"
                        >
                          <div className="flex items-center gap-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 print:text-indigo-800">
                            {cell.is_combined && <Layers size={11} />} {cell.course_title}
                          </div>
                          <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400 print:text-slate-700">{cell.teacher_name}</div>
                        </button>
                      ) : (
                        <button
                          onClick={() => cell && openCell(cell)}
                          className="flex h-12 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-300 hover:border-indigo-400 hover:text-indigo-500 dark:border-slate-700 print:hidden"
                        >
                          <Plus size={16} />
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={cellModalOpen}
        onClose={() => setCellModalOpen(false)}
        title="Assign Course / Teacher"
        widthClass="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Course & Teacher</label>
            <SearchableSelect
              options={allocationOptions}
              value={allocationOptions.find((o) => o.value === selectedAllocationId) || null}
              onChange={(opt) => setSelectedAllocationId(opt ? (opt as SelectOption).value : "")}
              placeholder="Select a course/teacher from this semester's allocations..."
            />
            {allocationOptions.length === 0 && (
              <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                No allocations found for this semester. Create allocations first.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setCellModalOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
            <button type="button" disabled={savingCell} onClick={handleSaveCell} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {savingCell ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={addPeriodOpen} onClose={() => setAddPeriodOpen(false)} title="Add Time Slot" widthClass="max-w-sm">
        <form onSubmit={handleAddPeriod} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Start Time</label>
              <input type="time" required value={newStart} onChange={(e) => setNewStart(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">End Time</label>
              <input type="time" required value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setAddPeriodOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={savingPeriod} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {savingPeriod ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={addDayOpen} onClose={() => setAddDayOpen(false)} title="Add Day" widthClass="max-w-sm">
        <form onSubmit={handleAddDay} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Day Name</label>
            <input type="text" required placeholder="e.g. Saturday" value={newDayName} onChange={(e) => setNewDayName(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setAddDayOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={savingDay} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {savingDay ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!removePeriodTarget}
        title="Remove Time Slot"
        message={removePeriodTarget ? `Remove the ${formatTime(removePeriodTarget.start_time)} – ${formatTime(removePeriodTarget.end_time)} slot across all days? Any assigned lectures in this slot will be lost.` : ""}
        confirmLabel="Remove"
        loading={removing}
        onConfirm={handleRemovePeriod}
        onCancel={() => setRemovePeriodTarget(null)}
      />

      <ConfirmDialog
        open={!!removeDayTarget}
        title="Remove Day"
        message={removeDayTarget ? `Remove "${removeDayTarget.day_name}" from this timetable? Any assigned lectures on this day will be lost.` : ""}
        confirmLabel="Remove"
        loading={removing}
        onConfirm={handleRemoveDay}
        onCancel={() => setRemoveDayTarget(null)}
      />
    </div>
  );
}
