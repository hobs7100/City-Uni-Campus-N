import type { StudentCountSummary } from "@/lib/student-count-summary";

/** A text-based PDF: searchable, with an overview page and paginated detail. */
export async function createStudentCountSummaryPdf(summary: StudentCountSummary) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 16;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const bottom = doc.internal.pageSize.getHeight() - 20;
  let y = 23;
  doc.setProperties({ title: "Student Count Summary", subject: "Active classes: active and struck-off students" });

  const title = (text: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    doc.setTextColor(30, 41, 59);
    doc.text(text, margin, y);
    y += 11;
    doc.setFontSize(10);
  };
  const newPage = () => {
    doc.addPage();
    y = 23;
  };
  const line = (text: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(11);
    const lines: string[] = doc.splitTextToSize(text, width);
    for (const part of lines) {
      if (y + 6 > bottom) {
        newPage();
        title("Overall Statistics - continued");
      }
      doc.text(part, margin, y);
      y += 6;
    }
  };

  title("Student Count Summary");
  line("Overall Statistics", true);
  y += 5;
  line(`Total Sessions: ${summary.total_sessions}`, true);
  y += 2;
  line(`Sessions: ${summary.sessions.length ? summary.sessions.join(", ") : "None"}`);
  y += 6;
  line(`Total Classes: ${summary.total_classes}`, true);
  y += 6;
  line(`Total Students: ${summary.total_students}`, true);
  y += 12;
  line("Scope: Active classes only.");
  line("Student totals include active and struck-off students.");
  line("Deleted students and other student statuses are excluded.");
  line("Classes without an active semester remain included.");

  const columnWidths = [64, 42, 44, width - 150];
  const starts = columnWidths.map((_, index) =>
    margin + columnWidths.slice(0, index).reduce((sum, value) => sum + value, 0));

  const tableHeader = () => {
    doc.setFillColor(235, 239, 247);
    doc.rect(margin, y - 4, width, 15, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    ["Class Name", "Session", "Current Active\nSemester", "Total\nStudents"].forEach((text, i) =>
      doc.text(text, starts[i] + 2, y + 1));
    y += 17;
    doc.setFont("helvetica", "normal");
  };

  if (summary.departments.length) {
    newPage();
    title("Department Details");
    for (const department of summary.departments) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      const heading: string[] = doc.splitTextToSize(department.department_name, width);
      if (y + heading.length * 6 + 30 > bottom) {
        newPage();
        title("Department Details");
      }
      doc.text(heading, margin, y);
      y += heading.length * 6 + 3;
      tableHeader();
      for (const row of department.classes) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const cells = [
          row.class_name,
          row.session,
          row.active_semester_number === null ? "No active semester" : `Semester ${row.active_semester_number}`,
          String(row.total_students),
        ].map((text, i) => doc.splitTextToSize(text, columnWidths[i] - 4) as string[]);
        const height = Math.max(...cells.map(cell => cell.length)) * 5 + 5;
        if (y + height > bottom) {
          newPage();
          title("Department Details - continued");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          const continued: string[] = doc.splitTextToSize(`${department.department_name} (continued)`, width);
          doc.text(continued, margin, y);
          y += continued.length * 5 + 4;
          tableHeader();
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        cells.forEach((text, i) => doc.text(text, starts[i] + 2, y));
        doc.setDrawColor(220, 225, 232);
        doc.line(margin, y + height - 5, margin + width, y + height - 5);
        y += height;
      }
      if (y + 12 > bottom) {
        newPage();
        title("Department Details - continued");
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`Department Total Students: ${department.total_students}`, margin + 2, y + 2);
      y += 19;
    }
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Active classes | Active + struck-off students", margin, bottom + 10);
    doc.text(`Page ${page} of ${pages}`, margin + width, bottom + 10, { align: "right" });
  }
  return doc;
}
