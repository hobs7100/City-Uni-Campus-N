import { escapePrintHtml } from "@/lib/printDocument";

type AttendanceMonth = { month: string; presents: number; absents: number; leaves: number };
type ResultMonth = { month: string; obtained: number; total: number; tests: number };

export type DitReportChartData = {
  from_date: string;
  to_date: string;
  attendance_months: AttendanceMonth[];
  result_months: ResultMonth[];
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

function axis(max: number, title: string, unit = "") {
  return `<svg viewBox="0 0 ${WIDTH} 182" role="img" aria-label="${escapePrintHtml(title)}" style="display:block;width:100%;height:auto;overflow:visible">
    ${(max === 1 ? [0, 1] : [0, 0.5, 1]).map((fraction) => {
      const y = BASE - fraction * HEIGHT;
      return `<line x1="${LEFT}" x2="${WIDTH - RIGHT}" y1="${y}" y2="${y}" stroke="#e2e8f0"/>
        <text x="${LEFT - 7}" y="${y + 4}" text-anchor="end" fill="#64748b" font-size="11">${Math.round(fraction * max)}${unit}</text>`;
    }).join("")}`;
}

function positions(count: number) {
  const labelEvery = Math.ceil(count / 8);
  return { x: (i: number) => LEFT + (count === 1 ? PLOT / 2 : i * PLOT / (count - 1)), labelEvery };
}

function monthLabel(month: string) {
  return escapePrintHtml(/^\d{4}-\d{2}$/.test(month) ? month : "");
}

function line(points: { x: number; y: number; label: string }[], color: string) {
  const path = points.map((point, i) => `${i ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const singlePointStroke = points.length === 1
    ? `<path d="M${points[0].x - 10},${points[0].y} L${points[0].x + 10},${points[0].y}" fill="none" stroke="${color}" stroke-width="3"/>`
    : "";
  return `<path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${singlePointStroke}
    ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4.5" fill="${color}" stroke="white" stroke-width="1.5"><title>${point.label}</title></circle>`).join("")}`;
}

function xLabels(months: { month: string }[], x: (i: number) => number, labelEvery: number) {
  return months.map((m, i) => i % labelEvery === 0 || i === months.length - 1
    ? `<text x="${x(i)}" y="${BASE + 20}" text-anchor="middle" fill="#475569" font-size="11">${monthLabel(m.month)}</text>` : "").join("");
}

function attendanceSvg(months: AttendanceMonth[]): string {
  if (!months.length) return `<p style="padding:28px 0;color:#64748b;text-align:center">No coordinator/admin attendance in this report period.</p>`;
  const max = Math.max(1, ...months.flatMap((m) => [safeNumber(m.presents), safeNumber(m.absents), safeNumber(m.leaves)]));
  const { x, labelEvery } = positions(months.length);
  const series = ([
    ["presents", "#61A9BD", "Present"],
    ["absents", "#E98E2E", "Absent"],
    ["leaves", "#9267C6", "Leave"],
  ] as const).map(([key, color, label]) => line(months.map((m, i) => ({
    x: x(i), y: BASE - safeNumber(m[key]) / max * HEIGHT,
    label: `${label}: ${safeNumber(m[key])} (${monthLabel(m.month)})`,
  })), color)).join("");
  return axis(max, "Monthly coordinator and admin attendance counts") + series + xLabels(months, x, labelEvery) + "</svg>";
}

function resultsSvg(months: ResultMonth[]): string {
  if (!months.length) return `<p style="padding:28px 0;color:#64748b;text-align:center">No test results in this report period.</p>`;
  const { x, labelEvery } = positions(months.length);
  const points = months.map((m, i) => {
    const pct = safeNumber(m.total) ? Math.min(100, safeNumber(m.obtained) / safeNumber(m.total) * 100) : 0;
    return { x: x(i), y: BASE - pct / 100 * HEIGHT, label: `${monthLabel(m.month)}: ${pct.toFixed(1)}% (${safeNumber(m.tests)} tests)` };
  });
  return axis(100, "Monthly weighted DIT test score percentages", "%") + line(points, "#1F74AD") + xLabels(months, x, labelEvery) + "</svg>";
}

function legend(items: [string, string][]) {
  return `<div style="display:flex;flex-wrap:wrap;gap:12px;font-size:11px;color:#475569;margin-top:4px">${items.map(([color, label]) =>
    `<span style="white-space:nowrap"><span style="display:inline-block;width:9px;height:9px;background:${color};margin-right:4px"></span>${label}</span>`
  ).join("")}</div>`;
}

export function reportChartsHtml(report: DitReportChartData): string {
  const attendance = report.attendance_months ?? [];
  const results = report.result_months ?? [];
  const present = attendance.reduce((sum, m) => sum + safeNumber(m.presents), 0);
  const absent = attendance.reduce((sum, m) => sum + safeNumber(m.absents), 0);
  const obtained = results.reduce((sum, m) => sum + safeNumber(m.obtained), 0);
  const total = results.reduce((sum, m) => sum + safeNumber(m.total), 0);
  const range = `${escapePrintHtml(report.from_date)} to ${escapePrintHtml(report.to_date)}`;
  return `<div class="report-charts" style="display:grid;grid-template-columns:repeat(2,minmax(420px,1fr));gap:12px;margin-top:18px;overflow-x:auto">
    <section class="report-chart" style="border:1px solid #cbd5e1;border-radius:9px;padding:12px;background:white">
      <h3 style="font-size:14px;font-weight:700;color:#312e81;margin:0">Attendance performance</h3>
      <p style="font-size:11px;color:#64748b;margin:5px 0">Coordinator/admin attendance · ${range} · ${present + absent ? (present / (present + absent) * 100).toFixed(1) + "% present" : "No evaluable days"}</p>
      ${attendanceSvg(attendance)}
      ${legend([["#61A9BD", "Present"], ["#E98E2E", "Absent"], ["#9267C6", "Leave"]])}
    </section>
    <section class="report-chart" style="border:1px solid #cbd5e1;border-radius:9px;padding:12px;background:white">
      <h3 style="font-size:14px;font-weight:700;color:#312e81;margin:0">Results performance</h3>
      <p style="font-size:11px;color:#64748b;margin:5px 0">Monthly weighted test score · ${range} · ${total ? (obtained / total * 100).toFixed(1) + "% overall" : "No test marks"}</p>
      ${resultsSvg(results)}
      ${legend([["#1F74AD", "Score (%)"]])}
    </section>
  </div>`;
}

export const reportSignaturesHtml = `<div class="report-signatures" style="display:flex;justify-content:space-between;gap:48px;margin-top:60px;font-size:12px;font-weight:600;color:#172033">
  <div style="flex:1;border-top:1px solid #334155;padding-top:8px">Incharge Signatures</div>
  <div style="flex:1;border-top:1px solid #334155;padding-top:8px">Hod Signatures</div>
</div>`;