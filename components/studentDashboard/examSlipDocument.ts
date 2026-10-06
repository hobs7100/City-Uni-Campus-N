import type { ExamSlipKind, SlipCourseRow, SlipData } from "../../lib/exam-slip-types";
import { escapePrintHtml } from "../../lib/printDocument";

const escape = escapePrintHtml;

function formatIssueDate(date: Date) {
  return date.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatPaperDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isPracticalCourse(row: SlipCourseRow) {
  return (
    Number(row.credit_hours) === 1 &&
    !row.course_title.toLowerCase().includes("translation of holy quran")
  );
}

function comparePaperDate(a: SlipCourseRow, b: SlipCourseRow) {
  return (
    (a.paper_date ?? "9999-12-31").localeCompare(b.paper_date ?? "9999-12-31") ||
    a.course_title.localeCompare(b.course_title)
  );
}

function renderDateGroup(label: string, rows: SlipCourseRow[], headerBg: string) {
  if (rows.length === 0) return "";
  return `<section style="margin-bottom:10px;break-inside:avoid">
    <div style="background:${headerBg};color:white;padding:5px 9px;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">${escape(label)}</div>
    <table style="width:100%;border-collapse:collapse;font-size:9.5px;table-layout:fixed">
      <thead>
        <tr style="background:#f1f5f9">
          <th style="border:1px solid #cbd5e1;padding:5px 7px;text-align:left;color:#334155;font-weight:700;width:15%">Code</th>
          <th style="border:1px solid #cbd5e1;padding:5px 7px;text-align:left;color:#334155;font-weight:700;width:40%">Course Title</th>
          <th style="border:1px solid #cbd5e1;padding:5px 7px;text-align:center;color:#334155;font-weight:700;width:13%">Attendance</th>
          <th style="border:1px solid #cbd5e1;padding:5px 7px;text-align:left;color:#334155;font-weight:700;width:18%">Paper Date</th>
          <th style="border:1px solid #cbd5e1;padding:5px 7px;text-align:left;color:#334155;font-weight:700;width:14%">Time</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => {
            const percentage = Number(row.att_percentage);
            const attendanceColor = percentage >= 75 ? "#15803d" : "#b91c1c";
            const attendanceBg = percentage >= 75 ? "#dcfce7" : "#fee2e2";
            const attendanceText = `${percentage.toFixed(1)}%`;
            return `<tr>
              <td style="border:1px solid #cbd5e1;padding:5px 7px;font-weight:700">${escape(row.course_code)}</td>
              <td style="border:1px solid #cbd5e1;padding:5px 7px;overflow-wrap:anywhere">${escape(row.course_title)}${percentage < 75 ? `<div style="color:#b91c1c;font-size:7px;font-weight:800;margin-top:2px">NOT ALLOWED FOR MID EXAM</div>` : ""}</td>
              <td style="border:1px solid #cbd5e1;padding:5px 7px;text-align:center"><span style="display:inline-block;background:${attendanceBg};color:${attendanceColor};font-weight:800;font-size:9px;padding:2px 5px">${escape(attendanceText)}</span></td>
              <td style="border:1px solid #cbd5e1;padding:5px 7px;font-weight:600">${escape(row.paper_date ? formatPaperDate(row.paper_date) : "—")}</td>
              <td style="border:1px solid #cbd5e1;padding:5px 7px;font-weight:600">${escape(row.paper_time || "—")}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  </section>`;
}

function renderEnrolledCourses(rows: SlipCourseRow[]) {
  const sortedRows = [...rows].sort((a, b) => {
    const titleOrder = a.course_title.localeCompare(b.course_title);
    return titleOrder || a.course_code.localeCompare(b.course_code) || a.course_id.localeCompare(b.course_id);
  });
  return `<section style="padding:10px 14px 2px">
    <div style="margin-bottom:10px;break-inside:avoid">
      <div style="background:#3730a3;color:white;padding:5px 9px;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">Enrolled Courses List</div>
      <table style="width:100%;border-collapse:collapse;font-size:9.5px;table-layout:fixed">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="border:1px solid #cbd5e1;padding:5px 7px;text-align:center;color:#334155;font-weight:700;width:12%">Sr#</th>
            <th style="border:1px solid #cbd5e1;padding:5px 7px;text-align:left;color:#334155;font-weight:700;width:25%">Course code</th>
            <th style="border:1px solid #cbd5e1;padding:5px 7px;text-align:left;color:#334155;font-weight:700">Course title</th>
          </tr>
        </thead>
        <tbody>
          ${sortedRows
            .map(
              (row, index) => `<tr>
                <td style="border:1px solid #cbd5e1;padding:5px 7px;text-align:center">${index + 1}</td>
                <td style="border:1px solid #cbd5e1;padding:5px 7px;font-weight:700;overflow-wrap:anywhere">${escape(row.course_code)}</td>
                <td style="border:1px solid #cbd5e1;padding:5px 7px;overflow-wrap:anywhere">${escape(row.course_title)}</td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  </section>`;
}

export function buildExamSlipDocument(
  data: SlipData,
  kind: ExamSlipKind,
  origin: string,
  issuedAt: Date = new Date(),
): string {
  const isClearance = kind === "clearance";
  const documentName = isClearance ? "Clearance Slip" : "Roll Number Slip";
  const examinationName = isClearance ? "FINAL TERM EXAMINATION" : "MID TERM EXAMINATION";
  const issueDate = formatIssueDate(issuedAt);
  const overallAttendance = Number(data.overall_attendance);
  const attendanceColor = overallAttendance >= 75 ? "#15803d" : "#b91c1c";
  const logoSrc = `${origin.replace(/\/$/, "")}/images/logo.png`;
  const photoHtml = data.student.profile_image_url
    ? `<img crossorigin="anonymous" data-pdf-image-cover src="${escape(data.student.profile_image_url)}" alt="Photo" style="width:28mm;height:34mm;object-fit:cover;border:1px solid #94a3b8;display:block"/>`
    : `<div role="img" aria-label="Student photo unavailable" style="width:28mm;height:34mm;border:1px solid #94a3b8;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:8px;text-align:center">Photo unavailable</div>`;

  const examContent = isClearance
    ? renderEnrolledCourses(data.rows)
    : `<section style="padding:10px 14px 2px">
        ${renderDateGroup(
          "Date Sheet – Theory",
          data.rows.filter((row) => !isPracticalCourse(row)).sort(comparePaperDate),
          "#3730a3",
        )}
        ${renderDateGroup(
          "Date Sheet – Practical",
          data.rows.filter(isPracticalCourse).sort(comparePaperDate),
          "#047857",
        )}
      </section>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escape(documentName)}</title>
<style>
  @page{size:A4 portrait;margin:0}
  html{width:210mm;height:297mm;margin:0;padding:0;background:#fff}
  body{width:210mm;min-height:297mm;margin:0;padding:12mm;font-family:Arial,'Segoe UI',sans-serif;color:#172033;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  *{box-sizing:border-box}
  @media print{html,body{margin:0;width:210mm;height:297mm;overflow:hidden}}
</style></head><body>
<main data-fit-single-page data-print-width-mm="186" data-print-height-mm="273" style="width:186mm;max-width:186mm;border:1.5px solid #273783;overflow:hidden;background:#fff">
  <header style="padding:10px 14px;border-bottom:2px solid #273783;display:grid;grid-template-columns:42mm 1fr 42mm;align-items:center;gap:8px">
    <img src="${escape(logoSrc)}" alt="City College" style="max-height:18mm;max-width:42mm;width:auto;display:block"/>
    <div style="text-align:center;flex:1">
      <div style="color:#273783;font-size:18px;font-weight:800;letter-spacing:.05em;text-transform:uppercase">${escape(documentName)}</div>
      <div style="color:#475569;font-size:9.5px;font-weight:600;margin-top:3px">${escape(examinationName)}</div>
    </div>
    <div style="justify-self:end;border:1px solid #cbd5e1;padding:6px 8px;text-align:center;min-width:37mm">
      <div style="font-size:7.5px;color:#64748b;text-transform:uppercase;font-weight:700">Academic Term</div>
      <div style="font-size:10px;color:#273783;font-weight:800;margin-top:2px">${escape(data.semester.term_type)}</div>
      <div style="font-size:8px;color:#475569;margin-top:1px">${escape(data.student.session)}</div>
    </div>
  </header>
  <section style="background:#f8fafc;border-bottom:1px solid #cbd5e1;padding:9px 14px">
    <div style="display:grid;grid-template-columns:1fr 28mm;align-items:stretch;gap:12px">
      <table style="width:100%;border-collapse:collapse;font-size:10px">
        <tr>
           <td style="padding:4px 6px;color:#64748b;font-weight:700;text-transform:uppercase;font-size:8px;width:24mm">Student Name</td>
           <td style="padding:4px 6px;font-weight:800;border-bottom:1px solid #dbe2ea">${escape(data.student.name)}</td>
           <td style="padding:4px 6px;color:#64748b;font-weight:700;text-transform:uppercase;font-size:8px;width:17mm">Class</td>
           <td style="padding:4px 6px;font-weight:700;border-bottom:1px solid #dbe2ea">${escape(data.student.class_name)}</td>
        </tr>
        <tr>
           <td style="padding:4px 6px;color:#64748b;font-weight:700;text-transform:uppercase;font-size:8px">Father&rsquo;s Name</td>
           <td style="padding:4px 6px;border-bottom:1px solid #dbe2ea">${escape(data.student.father_name || "—")}</td>
           <td style="padding:4px 6px;color:#64748b;font-weight:700;text-transform:uppercase;font-size:8px">Session</td>
           <td style="padding:4px 6px;border-bottom:1px solid #dbe2ea">${escape(data.student.session)}</td>
        </tr>
        <tr>
           <td style="padding:4px 6px;color:#64748b;font-weight:700;text-transform:uppercase;font-size:8px">Department</td>
           <td style="padding:4px 6px;border-bottom:1px solid #dbe2ea">${escape(data.student.department)}</td>
           <td style="padding:4px 6px;color:#64748b;font-weight:700;text-transform:uppercase;font-size:8px">Semester</td>
           <td style="padding:4px 6px;border-bottom:1px solid #dbe2ea">Semester ${escape(data.semester.semester_number)}</td>
        </tr>
        <tr>
           <td style="padding:4px 6px;color:#64748b;font-weight:700;text-transform:uppercase;font-size:8px">Issue Date</td>
           <td style="padding:4px 6px">${escape(issueDate)}</td>
           <td style="padding:4px 6px;color:#64748b;font-weight:700;text-transform:uppercase;font-size:8px">Attendance</td>
           <td style="padding:4px 6px;font-weight:800;color:${attendanceColor}">${escape(`${overallAttendance.toFixed(1)}%`)}</td>
        </tr>
      </table>
      <div style="flex-shrink:0">${photoHtml}</div>
    </div>
  </section>
  ${examContent}
  <section style="margin:0 14px 9px;border:1px solid #cbd5e1;padding:8px 10px;break-inside:avoid">
    <div style="font-size:8.5px;font-weight:800;color:#273783;text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px">Important Instructions</div>
    <ol style="margin:0;padding-left:15px;font-size:8px;color:#334155;line-height:1.45;columns:2;column-gap:28px">
      <li>Students will not be allowed to enter the examination hall without a valid ${escape(documentName)} and Original Student ID Card.</li>
      <li>Report to the examination hall at least 30 minutes before the scheduled examination time.</li>
      <li>Students arriving more than 15 minutes late after the commencement of the examination will not be permitted to enter.</li>
      <li>Mobile phones, smart watches, earphones, programmable calculators, and all unauthorized electronic devices are strictly prohibited inside the examination hall.</li>
      <li>Any form of cheating, possession of unauthorized material, or misconduct will result in disciplinary action according to university rules.</li>
      <li>Maintain complete silence and follow all instructions given by the invigilators throughout the examination.</li>
    </ol>
  </section>
  <section style="margin:0 14px 9px;border:1.5px solid #273783;padding:8px 10px;break-inside:avoid">
    <div style="font-size:8.5px;font-weight:800;color:#273783;text-transform:uppercase;letter-spacing:.07em;margin-bottom:7px">Account Office Clearance</div>
    <div style="display:grid;grid-template-columns:1.6fr 1fr 1fr;gap:14px;align-items:end;font-size:8px;color:#475569">
      <div><div style="height:16px;border-bottom:1px solid #64748b"></div><div style="margin-top:3px">Remarks</div></div>
      <div style="text-align:center"><div style="height:16px;border-bottom:1px solid #64748b"></div><div style="margin-top:3px">Authorized Signature</div></div>
      <div style="text-align:center"><div style="height:16px;border-bottom:1px solid #64748b"></div><div style="margin-top:3px">Official Stamp</div></div>
    </div>
  </section>
  <footer style="background:#273783;padding:6px 14px;display:flex;justify-content:space-between;align-items:center">
    <span style="color:#e0e7ff;font-size:7.5px">Computer-generated examination slip</span>
    <span style="color:#ffffff;font-size:7.5px;font-weight:700">Deveploped By: Prof.M.Shahzad(HoD, Faculty of Computing)</span>
    <span style="color:#e0e7ff;font-size:7.5px;font-weight:700">City College &mdash; University Campus</span>
  </footer>
</main>
</body></html>`;
}
