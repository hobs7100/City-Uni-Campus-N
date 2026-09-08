import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireExactRole } from "@/lib/requireRole";

type FineRow = {
  id: string;
  student_id: string;
  department_id: string;
  class_id: string;
  semester_id: string;
  amount: string;
  fid: string;
  paid_date: string | null;
  reactivated_on: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  transaction_date: string;
  student_name: string;
  father_name: string | null;
  department_name: string;
  class_name: string;
  session: string;
  semester_number: number;
  faculty: string | null;
};

function integerParam(value: string | null, name: string) {
  if (value === null || value === "") return { value: null, error: null };
  if (!/^\d+$/.test(value)) return { value: null, error: `${name} must be a whole number.` };
  return { value: Number(value), error: null };
}

export async function GET(request: NextRequest) {
  const { response } = await requireExactRole("admin", "coordinator", "finance_manager");
  if (response) return response;

  const params = request.nextUrl.searchParams;
  const departmentId = params.get("department_id");
  const classId = params.get("class_id");
  const session = params.get("session");
  const semesterNumberParam = integerParam(params.get("semester_number"), "semester_number");
  const yearParam = integerParam(params.get("year"), "year");
  const monthParam = integerParam(params.get("month"), "month");
  const fid = params.get("fid");
  const search = params.get("search")?.trim();

  const parameterError = semesterNumberParam.error || yearParam.error || monthParam.error;
  if (parameterError) {
    return NextResponse.json({ error: parameterError }, { status: 400 });
  }
  if (monthParam.value !== null && (monthParam.value < 1 || monthParam.value > 12)) {
    return NextResponse.json({ error: "month must be between 1 and 12." }, { status: 400 });
  }

  const conditions: string[] = [];
  const values: unknown[] = [];
  let index = 1;
  const add = (condition: string, value: unknown) => {
    conditions.push(condition.replace("?", `$${index++}`));
    values.push(value);
  };

  if (departmentId) add("f.department_id = ?", departmentId);
  if (classId) add("f.class_id = ?", classId);
  if (session) add("c.session = ?", session);
  if (semesterNumberParam.value !== null) add("sem.semester_number = ?", semesterNumberParam.value);
  if (yearParam.value !== null) add("extract(year from coalesce(f.paid_date, f.created_at::date)) = ?", yearParam.value);
  if (monthParam.value !== null) add("extract(month from coalesce(f.paid_date, f.created_at::date)) = ?", monthParam.value);
  if (fid) add("f.fid = ?", fid);
  if (search) {
    conditions.push(
      `(st.name ilike '%' || $${index} || '%'
        or coalesce(st.father_name, '') ilike '%' || $${index + 1} || '%'
        or f.fid ilike '%' || $${index + 2} || '%')`,
    );
    values.push(search, search, search);
    index += 3;
  }

  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
  const from = `from student_fines f
    join students st on st.id = f.student_id
    join departments d on d.id = f.department_id
    join classes c on c.id = f.class_id
    join semesters sem on sem.id = f.semester_id
    left join affiliations af on af.id = c.affiliation_id`;

  const organizationConditions: string[] = ["st.deleted_at is null", "st.status = 'struck_off'"];
  const organizationValues: unknown[] = [];
  let organizationIndex = 1;
  const addOrganization = (condition: string, value: unknown) => {
    organizationConditions.push(condition.replace("?", `$${organizationIndex++}`));
    organizationValues.push(value);
  };
  if (departmentId) addOrganization("st.department_id = ?", departmentId);
  if (classId) addOrganization("st.class_id = ?", classId);
  if (session) addOrganization("c.session = ?", session);
  if (semesterNumberParam.value !== null) addOrganization("sem.semester_number = ?", semesterNumberParam.value);

  const [transactions, statsRows, struckOffRows, monthlyTotals, yearlyTotals] = await Promise.all([
    query<FineRow>(
      `select f.id, f.student_id, f.department_id, f.class_id, f.semester_id,
              f.amount, f.fid, f.paid_date, f.reactivated_on, f.created_by_name,
              f.created_at, f.updated_at,
              to_char(coalesce(f.paid_date, f.created_at::date), 'YYYY-MM-DD') as transaction_date,
              st.name as student_name, st.father_name,
              d.name as department_name, c.class_name, c.session, sem.semester_number,
              af.university_name as faculty
       ${from}
       ${where}
       order by coalesce(f.paid_date, f.created_at::date) desc, f.created_at desc`,
      values,
    ),
    query<{ total_fine_amount: string; current_month_fine_amount: string }>(
      `select coalesce(sum(f.amount), 0)::text as total_fine_amount,
              coalesce(sum(f.amount) filter (
                where date_trunc('month', coalesce(f.paid_date, f.created_at::date))
                    = date_trunc('month', current_date)
              ), 0)::text as current_month_fine_amount
       ${from}
       ${where}`,
      values,
    ),
    query<{ current_struck_off_students: string }>(
      `select count(distinct st.id)::text as current_struck_off_students
       from students st
       join classes c on c.id = st.class_id
       left join semesters sem on sem.class_id = st.class_id
       where ${organizationConditions.join(" and ")}`,
      organizationValues,
    ),
    query<{ year: number; month: number; total_amount: string }>(
      `select extract(year from coalesce(f.paid_date, f.created_at::date))::int as year,
              extract(month from coalesce(f.paid_date, f.created_at::date))::int as month,
              coalesce(sum(f.amount), 0)::text as total_amount
       ${from}
       ${where}
       group by 1, 2
       order by 1 desc, 2 desc`,
      values,
    ),
    query<{ year: number; total_amount: string }>(
      `select extract(year from coalesce(f.paid_date, f.created_at::date))::int as year,
              coalesce(sum(f.amount), 0)::text as total_amount
       ${from}
       ${where}
       group by 1
       order by 1 desc`,
      values,
    ),
  ]);

  const filterOptions = {
    departments: [...new Map(transactions.map((fine) => [fine.department_id, {
      id: fine.department_id,
      name: fine.department_name,
    }])).values()],
    classes: [...new Map(transactions.map((fine) => [fine.class_id, {
      id: fine.class_id,
      name: fine.class_name,
      session: fine.session,
      department_id: fine.department_id,
    }])).values()],
    sessions: [...new Set(transactions.map((fine) => fine.session))].sort(),
    semester_numbers: [...new Set(transactions.map((fine) => fine.semester_number))].sort((a, b) => a - b),
    years: [...new Set(transactions.map((fine) => Number(fine.transaction_date.slice(0, 4))))].sort((a, b) => b - a),
    months: [...new Set(transactions.map((fine) => Number(fine.transaction_date.slice(5, 7))))].sort((a, b) => a - b),
    fids: [...new Set(transactions.map((fine) => fine.fid))].sort(),
  };

  return NextResponse.json({
    transactions,
    filter_options: filterOptions,
    stats: {
      total_fine_amount: statsRows[0]?.total_fine_amount ?? "0",
      current_month_fine_amount: statsRows[0]?.current_month_fine_amount ?? "0",
      current_struck_off_students: Number(struckOffRows[0]?.current_struck_off_students ?? 0),
    },
    monthly_totals: monthlyTotals,
    yearly_totals: yearlyTotals,
  });
}