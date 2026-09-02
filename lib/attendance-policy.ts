export type StudentLeaveType = "permanent" | "partial" | null;
export type AttendanceFlag = "ok" | "warning" | "struck_off";

export interface AttendancePolicy {
  struckOffBelow: number;
  warningBelow: number;
}

export const REGULAR_ATTENDANCE_POLICY: AttendancePolicy = {
  struckOffBelow: 60,
  warningBelow: 75,
};

export const PARTIAL_LEAVE_ATTENDANCE_POLICY: AttendancePolicy = {
  struckOffBelow: 40,
  warningBelow: 50,
};

export function getAttendancePolicy(leaveType: StudentLeaveType): AttendancePolicy {
  return leaveType === "partial"
    ? PARTIAL_LEAVE_ATTENDANCE_POLICY
    : REGULAR_ATTENDANCE_POLICY;
}

export function getAttendanceFlag(
  percentage: number,
  leaveType: StudentLeaveType,
): AttendanceFlag {
  const policy = getAttendancePolicy(leaveType);
  if (percentage < policy.struckOffBelow) return "struck_off";
  if (percentage < policy.warningBelow) return "warning";
  return "ok";
}