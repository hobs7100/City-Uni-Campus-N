export interface StudentCountRow {
  department_id: string;
  department_name: string;
  class_id: string;
  class_name: string;
  session: string;
  active_semester_number: number | null;
  total_students: number;
}

export interface StudentCountDepartment {
  department_id: string;
  department_name: string;
  total_students: number;
  classes: StudentCountRow[];
}

export interface StudentCountSummary {
  total_sessions: number;
  sessions: string[];
  total_classes: number;
  total_students: number;
  departments: StudentCountDepartment[];
}

export function buildStudentCountSummary(rows: StudentCountRow[]): StudentCountSummary {
  const departments = new Map<string, StudentCountDepartment>();
  for (const row of rows) {
    let department = departments.get(row.department_id);
    if (!department) {
      department = {
        department_id: row.department_id,
        department_name: row.department_name,
        total_students: 0,
        classes: [],
      };
      departments.set(row.department_id, department);
    }
    department.classes.push(row);
    department.total_students += row.total_students;
  }
  const sessions = [...new Set(rows.map(row => row.session))].sort();
  return {
    total_sessions: sessions.length,
    sessions,
    total_classes: rows.length,
    total_students: rows.reduce((sum, row) => sum + row.total_students, 0),
    departments: [...departments.values()],
  };
}
