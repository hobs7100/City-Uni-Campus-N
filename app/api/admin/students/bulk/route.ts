import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { generateRandomPassword, hashPassword } from "@/lib/auth";
import { requireRole } from "@/lib/requireRole";
import { sendWelcomeEmail } from "@/lib/email";
import * as XLSX from "xlsx";

export async function POST(request: NextRequest) {
  const { response } = await requireRole("admin", "coordinator");
  if (response) return response;

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid form data." }, { status: 400 });

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

  if (rows.length === 0) {
    return NextResponse.json({ error: "The spreadsheet has no data rows." }, { status: 400 });
  }

  const departments = await query<{ id: string; name: string }>(
    `select id, name from departments where deleted_at is null`
  );
  const classes = await query<{ id: string; department_id: string; class_name: string; session: string }>(
    `select id, department_id, class_name, session from classes`
  );

  const deptMap = new Map(departments.map((d) => [d.name.toLowerCase().trim(), d.id]));
  const classMap = new Map(
    classes.map((c) => [`${c.department_id}|${c.class_name.toLowerCase().trim()}|${c.session.trim()}`, c.id])
  );

  let created = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const name = String(row["name"] || "").trim();
    const email = String(row["email"] || "").toLowerCase().trim();
    const cnic = String(row["cnic"] || "").trim();
    const deptName = String(row["department_name"] || "").trim();
    const session = String(row["session"] || "").trim();
    const className = String(row["class_name"] || "").trim();

    if (!name) { errors.push(`Row ${rowNum}: name is required`); continue; }
    if (!email) { errors.push(`Row ${rowNum}: email is required`); continue; }
    if (!cnic) { errors.push(`Row ${rowNum}: cnic is required`); continue; }
    if (!deptName) { errors.push(`Row ${rowNum}: department_name is required`); continue; }
    if (!session) { errors.push(`Row ${rowNum}: session is required`); continue; }
    if (!className) { errors.push(`Row ${rowNum}: class_name is required`); continue; }

    const deptId = deptMap.get(deptName.toLowerCase());
    if (!deptId) { errors.push(`Row ${rowNum}: Department "${deptName}" not found`); continue; }

    const classKey = `${deptId}|${className.toLowerCase()}|${session}`;
    const classId = classMap.get(classKey);
    if (!classId) { errors.push(`Row ${rowNum}: Class "${className}" (${session}) not found in "${deptName}"`); continue; }

    const emailExists = await queryOne(`select id from students where email = $1`, [email]);
    if (emailExists) { errors.push(`Row ${rowNum}: Email ${email} already exists`); continue; }

    const cnicExists = await queryOne(`select id from students where cnic = $1`, [cnic]);
    if (cnicExists) { errors.push(`Row ${rowNum}: CNIC ${cnic} already exists`); continue; }

    const password = generateRandomPassword();
    const hash = await hashPassword(password);
    const status = (["active", "struck_off", "left", "dropped", "freezed"].includes(row["status"])
      ? row["status"]
      : "active") as string;

    try {
      await query(
        `insert into students
           (name, father_name, cnic, contact, address, email, password_hash,
            department_id, session, class_id, status)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          name,
          String(row["father_name"] || "").trim() || null,
          cnic,
          String(row["contact"] || "").trim() || null,
          String(row["address"] || "").trim() || null,
          email,
          hash,
          deptId,
          session,
          classId,
          status,
        ]
      );
      created++;
      sendWelcomeEmail({ to: email, name, password }).catch(() => {});
    } catch (e) {
      errors.push(`Row ${rowNum}: DB error — ${(e as Error).message}`);
    }
  }

  const failed = rows.length - created;
  return NextResponse.json({ created, failed, errors });
}
