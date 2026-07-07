import { NextResponse } from "next/server";
import { requireRole } from "@/lib/requireRole";
import * as XLSX from "xlsx";

export async function GET() {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const headers = [
    "name",
    "father_name",
    "cnic",
    "contact",
    "address",
    "email",
    "department_name",
    "session",
    "class_name",
    "status",
  ];

  const sampleRow = [
    "Muhammad Ali",
    "Muhammad Usman",
    "35201-1234567-1",
    "03001234567",
    "House 1, Street 2, Multan",
    "ali@example.com",
    "Computer Science",
    "2024-2028",
    "BS-CS",
    "active",
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
  ws["!cols"] = headers.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="students_sample.xlsx"',
    },
  });
}
