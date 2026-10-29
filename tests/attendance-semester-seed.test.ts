import { describe, expect, it } from "vitest";
import { getAttendancePercentage, getAttendanceFlag, ATTENDANCE_PROTECTION_DAYS } from "@/lib/attendance-policy";

describe("semester attendance starting percentage", () => {
  it("seeds an empty semester at 100%, with unchanged protection and policy thresholds", () => {
    expect(getAttendancePercentage(0, 0)).toBe(100);
    expect(getAttendanceFlag(getAttendancePercentage(0, 0), null)).toBe("ok");
    expect(getAttendanceFlag(getAttendancePercentage(0, 0), "partial")).toBe("ok");
    expect(ATTENDANCE_PROTECTION_DAYS).toBe(15);
  });

  it.each([
    [0, 1, 0, "struck_off"],
    [1, 1, 100, "ok"],
    [1, 2, 50, "struck_off"],
    [12, 20, 60, "warning"],
    [15, 20, 75, "ok"],
  ])("uses only real marks after attendance begins: %i/%i", (present, days, expected, flag) => {
    const percentage = getAttendancePercentage(present, days);
    expect(percentage).toBe(expected);
    expect(getAttendanceFlag(percentage, null)).toBe(flag);
  });

  it("retains the partial-leave thresholds without a synthetic attendance credit", () => {
    expect(getAttendanceFlag(getAttendancePercentage(5, 20), "partial")).toBe("struck_off");
    expect(getAttendanceFlag(getAttendancePercentage(6, 20), "partial")).toBe("warning");
    expect(getAttendanceFlag(getAttendancePercentage(8, 20), "partial")).toBe("ok");
  });
});
