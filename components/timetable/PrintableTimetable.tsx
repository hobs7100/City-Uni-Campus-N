import { Layers } from "lucide-react";

interface DayRow {
  id: string;
  day_name: string;
}

interface PeriodRow {
  id: string;
  start_time: string;
  end_time: string;
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
  combined_with: { class_name: string; session: string }[] | null;
}

export interface PrintableTimetableData {
  timetable: {
    id: string;
    class_name: string;
    session: string;
    department_name: string;
    semester_number: number;
    term_type: string;
    shift: "morning" | "evening";
    wef_date: string;
  };
  days: DayRow[];
  periods: PeriodRow[];
  cells: CellRow[];
}

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export default function PrintableTimetable({
  data,
  isLast,
}: {
  data: PrintableTimetableData;
  isLast: boolean;
}) {
  const { timetable: info, days, periods, cells } = data;
  const cellMap = new Map(cells.map((c) => [`${c.day_id}:${c.period_id}`, c]));

  return (
    <div className={isLast ? "" : "print-page-break"}>
      <div className="mb-4 rounded-lg border-2 border-indigo-600 bg-gradient-to-r from-indigo-600 to-sky-500 p-4 text-center text-white">
        <h2 className="text-xl font-extrabold tracking-wide">City College (University Campus)</h2>
        <p className="text-sm font-semibold">
          Class Timetable — {info.class_name} ({info.session}) — Sem {info.semester_number}{" "}
          {info.term_type} — {info.shift} Shift
        </p>
        <p className="text-xs opacity-90">
          {info.department_name} · W.e.f {new Date(info.wef_date).toLocaleDateString()}
        </p>
      </div>

      <div className="overflow-x-auto rounded-none border-0">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-indigo-600 text-xs uppercase text-white">
            <tr>
              <th className="border border-indigo-400 px-3 py-2">Day</th>
              {periods.map((p) => (
                <th key={p.id} className="border border-indigo-400 px-3 py-2">
                  {formatTime(p.start_time)} – {formatTime(p.end_time)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day, idx) => (
              <tr key={day.id} className={idx % 2 === 0 ? "bg-indigo-50/60" : "bg-white"}>
                <td className="border border-indigo-200 px-3 py-2 font-semibold text-indigo-900">
                  {day.day_name}
                </td>
                {periods.map((p) => {
                  const cell = cellMap.get(`${day.id}:${p.id}`);
                  return (
                    <td key={p.id} className="border border-indigo-200 px-2 py-2 align-top">
                      {cell?.allocation_id ? (
                        <div className="rounded-lg border border-indigo-300 bg-indigo-50 p-2">
                          <div className="flex items-center gap-1 text-xs font-semibold text-indigo-800">
                            {cell.is_combined && <Layers size={11} />} {cell.course_title}
                          </div>
                          <div className="text-[11px] font-medium text-slate-700">
                            {cell.teacher_name}
                          </div>
                          {cell.is_combined &&
                            cell.combined_with &&
                            cell.combined_with.length > 0 && (
                              <div className="mt-0.5 text-[10px] italic text-sky-700">
                                Combined:{" "}
                                {cell.combined_with
                                  .map((c) => `${c.class_name} (${c.session})`)
                                  .join(",")}
                              </div>
                            )}
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
