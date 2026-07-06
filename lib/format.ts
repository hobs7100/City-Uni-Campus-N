export function formatDateOnly(value: string | Date | null | undefined): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}
