export function formatReportDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
  return date ? `${date[3]}:${date[2]}:${date[1]}` : value;
}

export function localReportDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}:${String(date.getMonth() + 1).padStart(2, "0")}:${date.getFullYear()}`;
}