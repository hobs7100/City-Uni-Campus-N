/* eslint-disable @typescript-eslint/no-explicit-any */
import { escapePrintHtml, printHtmlDocument } from "@/lib/printDocument";
import { reportChartsHtml, reportSignaturesHtml, type DitReportChartData } from "./ReportCharts";
import { formatReportDate, localReportDate } from "./reportDate";

type RecordValue = Record<string, any>; // Responses share the individual student-report shape.
const columns = ["Test #", "Date", "Subject", "Obtained Marks", "Total Marks", "Percentage", "Grade"];
const cell = (value: unknown) => escapePrintHtml(String(value ?? "—"));

// The same content renderer is used for one report or an entire class.
export function resultReportContent(report: RecordValue): string {
  const student = report.student ?? {};
  const cls = report.class ?? {};
  const totals = report.grand_totals ?? {};
  const rows: RecordValue[] = report.test_rows ?? [];
  const photo = student.profile_image_url
    ? `<img src="${cell(student.profile_image_url)}" style="height:64px;width:64px;border-radius:50%;object-fit:cover" />`
    : "";
  const header = `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px"><img src="/images/logo.png" style="height:64px" /><div style="flex:1"><h2>Result Report</h2><p><b>Student:</b> ${cell(student.name ?? "")} · <b>Roll No:</b> ${cell(student.roll_no ?? "")}</p><p><b>Class:</b> ${cell(cls.name ?? "")} · <b>Session:</b> ${cell(cls.session ?? "")} · <b>Section:</b> ${cell(cls.section ?? "")}</p><p><b>Date:</b> ${cell(formatReportDate(report.from_date ?? report.effective_filters?.from_date))} to ${cell(formatReportDate(report.to_date ?? report.effective_filters?.to_date))} · <b>Report date:</b> ${cell(localReportDate(new Date()))}</p></div>${photo}</div>`;
  const tableRows = rows.map((t) => [
    t.test_number ?? "—", formatReportDate(t.date ?? t.test_date),
    `${t.course_code ?? ""} ${t.course_title ?? ""}`,
    t.is_absent ? "Absent (0)" : t.obtained_marks ?? t.obtained ?? 0,
    t.total_marks ?? t.total ?? 0, `${Number(t.percentage ?? 0).toFixed(1)}%`,
    t.grade ?? (t.is_absent ? "Absent" : "F"),
  ]);
  const detail = tableRows.length
    ? tableRows.map((row) => `<tr>${row.map((value) => `<td>${cell(value)}</td>`).join("")}</tr>`).join("")
    : `<tr><td>—</td><td>—</td><td>No test results in the selected period.</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`;
  const overall = `<tr class="overall-result"><td></td><td>Overall</td><td></td><td>${cell(totals.obtained ?? totals.obtained_marks ?? 0)}</td><td>${cell(totals.total ?? totals.total_marks ?? 0)}</td><td>${report.no_results ? "—" : `${Number(totals.percentage ?? 0).toFixed(1)}%`}</td><td>${cell(totals.grade ?? "F")}</td></tr>`;
  return `${header}<h1>Result Report</h1><table><thead><tr>${columns.map((c) => `<th>${cell(c)}</th>`).join("")}</tr></thead><tbody>${detail}${overall}</tbody></table>${reportChartsHtml(report as DitReportChartData)}${reportSignaturesHtml}`;
}

export function printResultReports(reports: RecordValue[]) {
  if (!reports.length) throw new Error("No reports to print.");
  const pages = reports.map((report, index) =>
    `<main class="result-page${index < reports.length - 1 ? " next-page" : ""}" data-fit-single-page data-print-width-mm="279" data-print-height-mm="180" style="width:279mm">${resultReportContent(report)}</main>`
  ).join("");
  return printHtmlDocument(`<html><head><title>Result Report</title><style>
    @page{size:A4 landscape;margin:0}
    body{font:11px Arial;color:#172033;width:279mm;padding:8mm;margin:0;box-sizing:content-box}
    h1{color:#3730a3;margin:8px 0}h2,p{margin:4px 0}
    table{border-collapse:collapse;width:100%;margin-top:8px}
    th{background:#3730a3;color:#fff}th,td{border:1px solid #cbd5e1;padding:1px 5px;text-align:left}
    th:nth-child(n+4),td:nth-child(n+4){text-align:center}
    .overall-result{font-weight:700;background:#eef2ff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .report-chart,.report-signatures{break-inside:avoid;page-break-inside:avoid}
    .report-charts{grid-template-columns:repeat(2,minmax(0,1fr))!important;overflow:visible!important;margin-top:10px!important}
    .report-chart{min-width:0;padding:8px!important}
    .report-signatures{margin-top:18px!important}
    .report-signatures>div{flex:0 0 125px!important;max-width:125px}
    .result-page:not(:first-child){padding-top:8mm;box-sizing:border-box}
    .next-page{break-after:page;page-break-after:always}
  </style></head><body>${pages}</body></html>`,
  "Result Report", { waitForFrameLoad: true, frameWidthMm: 297, frameHeightMm: 210 });
}