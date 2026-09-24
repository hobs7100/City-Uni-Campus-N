import { escapePrintHtml } from "@/lib/printDocument";

type AttendanceWeek = { month: string; week: number; presents: number; absents: number; leaves: number };
type SubjectResult = { course_title: string; course_code: string; obtained_marks: number; total_marks: number };

export type DitReportChartData = {
  from_date: string;
  to_date: string;
  attendance_weeks: AttendanceWeek[];
  courses: SubjectResult[];
};

const WIDTH = 680;
const LEFT = 45;
const RIGHT = 45;
const TOP = 14;
const BASE = 140;
const HEIGHT = BASE - TOP;
const PLOT = WIDTH - LEFT - RIGHT;

function safeNumber(value: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function axis(max: number, title: string, unit = "", viewHeight = 182) {
  return `<svg viewBox="0 0 ${WIDTH} ${viewHeight}" role="img" aria-label="${escapePrintHtml(title)}" style="display:block;width:100%;height:auto;overflow:visible">
    ${(max === 1 ? [0, 1] : [0, 0.5, 1]).map((fraction) => {
      const y = BASE - fraction * HEIGHT;
      return `<line x1="${LEFT}" x2="${WIDTH - RIGHT}" y1="${y}" y2="${y}" stroke="#e2e8f0"/>
        <text x="${LEFT - 7}" y="${y + 4}" text-anchor="end" fill="#64748b" font-size="11">${Math.round(fraction * max)}${unit}</text>`;
    }).join("")}`;
}

function weekLabel(month: string, week: number) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isInteger(week) || week < 1 || week > 5) return ["", ""];
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return [`${names[Number(month.slice(5)) - 1]} '${month.slice(2, 4)}`, `W${week}`];
}

function selectedWeeks(report: DitReportChartData): AttendanceWeek[] {
  const recorded = report.attendance_weeks ?? [];
  const from = report.from_date;
  const to = report.to_date;
  // Unbounded filters can span thousands of years. Otherwise include zero-count
  // weeks so the selected date range, not just recorded attendance, defines the x-axis.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
      from === "1900-01-01" || to === "9999-12-31") return recorded;
  const start = Number(from.slice(0, 4)) * 12 + Number(from.slice(5, 7)) - 1;
  const end = Number(to.slice(0, 4)) * 12 + Number(to.slice(5, 7)) - 1;
  if (start > end || end - start > 24) return recorded;
  const byWeek = new Map(recorded.map((row) => [`${row.month}-${row.week}`, row]));
  const weeks: AttendanceWeek[] = [];
  for (let index = start; index <= end; index++) {
    const year = Math.floor(index / 12);
    const monthNumber = index % 12 + 1;
    const month = `${year}-${String(monthNumber).padStart(2, "0")}`;
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const firstDay = index === start ? Number(from.slice(8, 10)) : 1;
    const finalDay = index === end ? Number(to.slice(8, 10)) : lastDay;
    for (let week = Math.floor((firstDay - 1) / 7) + 1; week <= Math.floor((finalDay - 1) / 7) + 1; week++) {
      weeks.push(byWeek.get(`${month}-${week}`) ?? {month, week, presents: 0, absents: 0, leaves: 0});
    }
  }
  return weeks;
}

function line(points: { x: number; y: number; label: string }[], color: string) {
  const path = points.map((point, i) => `${i ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const singlePointStroke = points.length === 1
    ? `<path d="M${points[0].x - 10},${points[0].y} L${points[0].x + 10},${points[0].y}" fill="none" stroke="${color}" stroke-width="3"/>`
    : "";
  return `<path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${singlePointStroke}
    ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4.5" fill="${color}" stroke="white" stroke-width="1.5"><title>${escapePrintHtml(point.label)}</title></circle>`).join("")}`;
}

function attendanceSvg(weeks: AttendanceWeek[]): string {
  if (!weeks.length) return `<p style="padding:28px 0;color:#64748b;text-align:center">No coordinator/admin attendance in this report period.</p>`;
  const max = Math.max(1, ...weeks.flatMap((m) => [safeNumber(m.presents), safeNumber(m.absents), safeNumber(m.leaves)]));
  const slot = PLOT / weeks.length;
  const barWidth = Math.min(18, slot * 0.25);
  const labelEvery = Math.ceil(weeks.length / 8);
  const series = ([
    ["presents", "#61A9BD", "Present"],
    ["absents", "#E98E2E", "Absent"],
    ["leaves", "#9267C6", "Leave"],
  ] as const).map(([key, color, label], seriesIndex) => weeks.map((m, i) => {
    const count = safeNumber(m[key]);
    const height = count / max * HEIGHT;
    const x = LEFT + (i + 0.5) * slot + (seriesIndex - 1.5) * barWidth;
    const [month, week] = weekLabel(m.month, m.week);
    return `<rect x="${x}" y="${BASE - height}" width="${barWidth}" height="${height}" fill="${color}"><title>${label}: ${count} (${month} ${week})</title></rect>`;
  }).join("")).join("");
  const labels = weeks.map((m, i) => {
    if (i % labelEvery !== 0 && i !== weeks.length - 1) return "";
    const [month, week] = weekLabel(m.month, m.week);
    const x = LEFT + (i + 0.5) * slot;
    return `<text x="${x}" y="${BASE + 15}" text-anchor="middle" fill="#475569" font-size="10"><tspan x="${x}">${month}</tspan><tspan x="${x}" dy="12">${week}</tspan></text>`;
  }).join("");
  return axis(max, "Weekly coordinator and admin attendance counts") + series + labels + "</svg>";
}

function resultsSvg(subjects: SubjectResult[]): string {
  if (!subjects.length) return `<p style="padding:28px 0;color:#64748b;text-align:center">No test results in this report period.</p>`;
  const slot = PLOT / subjects.length;
  const points = subjects.map((subject, i) => {
    const obtained = safeNumber(subject.obtained_marks);
    const total = safeNumber(subject.total_marks);
    const pct = total ? Math.min(100, obtained / total * 100) : 0;
    return { x: LEFT + (i + 0.5) * slot, y: BASE - pct / 100 * HEIGHT, label: `${subject.course_title}: ${obtained}/${total} marks (${pct.toFixed(1)}%)`, obtained, total };
  });
  const marks = points.map((point) => `<text x="${point.x}" y="${point.y < TOP + 18 ? point.y + 17 : point.y - 8}" text-anchor="middle" fill="#154C75" font-size="10" font-weight="bold">${point.obtained}/${point.total}</text>`).join("");
  const names = `<div style="box-sizing:border-box;display:grid;grid-template-columns:repeat(${subjects.length},minmax(0,1fr));padding-left:${LEFT / WIDTH * 100}%;padding-right:${RIGHT / WIDTH * 100}%;gap:0;line-height:1.2">${subjects.map((subject) =>
    `<div style="min-width:0;text-align:center;font-size:10px;color:#475569;overflow-wrap:anywhere" title="${escapePrintHtml(subject.course_title)}">${escapePrintHtml(subject.course_title)}</div>`
  ).join("")}</div>`;
  return axis(100, "DIT subject marks percentage", "%", 148) + line(points, "#1F74AD") + marks + "</svg>" + names;
}

function legend(items: [string, string][]) {
  return `<div style="display:flex;flex-wrap:wrap;gap:12px;font-size:11px;color:#475569;margin-top:4px">${items.map(([color, label]) =>
    `<span style="white-space:nowrap"><span style="display:inline-block;width:9px;height:9px;background:${color};margin-right:4px"></span>${label}</span>`
  ).join("")}</div>`;
}

export function reportChartsHtml(report: DitReportChartData): string {
  const attendance = selectedWeeks(report);
  const results = report.courses ?? [];
  const present = attendance.reduce((sum, m) => sum + safeNumber(m.presents), 0);
  const absent = attendance.reduce((sum, m) => sum + safeNumber(m.absents), 0);
  const obtained = results.reduce((sum, m) => sum + safeNumber(m.obtained_marks), 0);
  const total = results.reduce((sum, m) => sum + safeNumber(m.total_marks), 0);
  const range = `${escapePrintHtml(report.from_date)} to ${escapePrintHtml(report.to_date)}`;
  return `<div class="report-charts" style="display:grid;grid-template-columns:repeat(2,minmax(420px,1fr));gap:12px;margin-top:18px;overflow-x:auto">
    <section class="report-chart" style="border:1px solid #cbd5e1;border-radius:9px;padding:12px;background:white">
      <h3 style="font-size:14px;font-weight:700;color:#312e81;margin:0">Attendance performance</h3>
      <p style="font-size:11px;color:#64748b;margin:5px 0">Weeks of each month (days 1–7, 8–14, 15–21, 22–28, 29–31) · ${range} · ${present + absent ? (present / (present + absent) * 100).toFixed(1) + "% present" : "No evaluable days"}</p>
      ${attendanceSvg(attendance)}
      ${legend([["#61A9BD", "Present"], ["#E98E2E", "Absent"], ["#9267C6", "Leave"]])}
    </section>
    <section class="report-chart" style="border:1px solid #cbd5e1;border-radius:9px;padding:12px;background:white">
      <h3 style="font-size:14px;font-weight:700;color:#312e81;margin:0">Results performance</h3>
      <p style="font-size:11px;color:#64748b;margin:5px 0">Subject score (%) · point labels show obtained/total marks · ${range} · ${total ? (obtained / total * 100).toFixed(1) + "% overall" : "No test marks"}</p>
      ${resultsSvg(results)}
      ${legend([["#1F74AD", "Score (%)"]])}
    </section>
  </div>`;
}

export const reportSignaturesHtml = `<div class="report-signatures" style="display:flex;justify-content:space-between;gap:48px;margin-top:60px;font-size:12px;font-weight:600;color:#172033">
  <div style="flex:1;border-top:1px solid #334155;padding-top:8px">Incharge Signatures</div>
  <div style="flex:1;border-top:1px solid #334155;padding-top:8px">Hod Signatures</div>
</div>`;