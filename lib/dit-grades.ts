export type DitGrade = "A+" | "A" | "B" | "C" | "D" | "E" | "F";

export function ditGradeFromPercentage(percentage: number): DitGrade {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  if (percentage >= 40) return "E";
  return "F";
}

export function calculateDitGrade(
  obtainedMarks: number,
  totalMarks: number,
  isAbsent = false,
): DitGrade | "Absent" {
  if (isAbsent) return "Absent";
  const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
  return ditGradeFromPercentage(percentage);
}