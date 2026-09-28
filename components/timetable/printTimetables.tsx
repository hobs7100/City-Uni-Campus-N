"use client";

import { renderToStaticMarkup } from "react-dom/server";
import { printHtmlDocument } from "@/lib/printDocument";
import PrintableTimetable, { type PrintableTimetableData } from "./PrintableTimetable";

// Isolated print markup: the dashboard, profile panel, and interactive grid
// never enter the print frame or the printer's spool job.
export function printTimetables(timetables: PrintableTimetableData[]) {
  if (!timetables.length) return Promise.reject(new Error("No timetables selected."));
  const pages = timetables.map((data, index) =>
    renderToStaticMarkup(<PrintableTimetable data={data} isLast={index === timetables.length - 1} />)
  ).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Class Timetable</title>
  <style>
    @page{size:A4 landscape;margin:0}
    html,body{margin:0;background:white;color:#000}
    body{box-sizing:content-box;width:281mm;padding:8mm;font:11px/1.25 Arial,sans-serif}
    .tt-page{box-sizing:border-box;width:281mm;color:#000}
    .tt-page:not(:first-child){padding-top:8mm}
    .tt-page-break{break-after:page;page-break-after:always}
    .tt-heading{border:1px solid #333;text-align:center;padding:7px;margin-bottom:9px}
    .tt-heading h2{font-size:16px;margin:0 0 3px}
    .tt-heading p{margin:2px 0;font-size:11px}
    .tt-grid{width:100%;table-layout:fixed;border-collapse:collapse;color:#000}
    .tt-grid th,.tt-grid td{border:1px solid #555;vertical-align:top;text-align:left;padding:4px;overflow-wrap:anywhere;word-break:normal;color:#000}
    .tt-grid th{font-size:10px;font-weight:bold}
    .tt-grid th:first-child,.tt-grid td:first-child{width:17mm;font-weight:bold}
    .tt-grid td{font-size:10px}
    .tt-lesson{padding:2px;color:#000}
    .tt-lesson div{margin:1px 0;color:#000}
    .tt-lesson svg{width:10px;height:10px;stroke:#000}
  </style></head><body>${pages}</body></html>`;
  return printHtmlDocument(html, "Class Timetable", {
    waitForFrameLoad: true, frameWidthMm: 297, frameHeightMm: 210,
  });
}