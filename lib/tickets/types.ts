import { z } from "zod";

export const ticketStatuses = ["pending", "in_progress", "completed"] as const;
export type TicketStatus = (typeof ticketStatuses)[number];
export const ticketEmployeeRoles = ["assistant", "controller", "suprident", "accountant"] as const;
export type TicketEmployeeRole = (typeof ticketEmployeeRoles)[number];

export const uuidSchema = z.string().uuid();
export const ticketCategorySchema = z.object({
  title: z.string().trim().min(1, "Issue title is required.").max(120, "Issue title must be 120 characters or fewer."),
});
export const ticketStatusSchema = z.enum(ticketStatuses);
export const maxTicketFiles = 2;
export const maxTicketFileBytes = 2 * 1024 * 1024;
export const maxTicketWords = 1000;

export function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function validateTicketDescription(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "Description is required.";
  if (wordCount(value) > maxTicketWords) return "Description must not exceed 1000 words.";
  return null;
}

export class TicketInputError extends Error {}