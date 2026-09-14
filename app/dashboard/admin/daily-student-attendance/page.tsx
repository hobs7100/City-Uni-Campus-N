import StudentAttendanceManager from "@/components/studentAttendance/StudentAttendanceManager";

export default function AdminDailyStudentAttendancePage() {
  return (
    <StudentAttendanceManager
      role="admin"
      apiBasePath="/api/admin/daily-student-attendance"
    />
  );
}