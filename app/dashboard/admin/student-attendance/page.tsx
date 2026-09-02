"use client";

import { useEffect, useState } from "react";
import StudentAttendanceLookup, {
  StudentAttendanceStudent,
} from "@/components/studentAttendance/StudentAttendanceLookup";

export default function AdminStudentAttendancePage() {
  const [students, setStudents] = useState<StudentAttendanceStudent[]>([]);

  useEffect(() => {
    fetch("/api/admin/students")
      .then((response) => response.json())
      .then((data) => setStudents(data.students ?? []))
      .catch(() => setStudents([]));
  }, []);

  return <StudentAttendanceLookup students={students} />;
}
