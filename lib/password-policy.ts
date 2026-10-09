import { z } from "zod";

export const DEFAULT_STUDENT_PASSWORD = "City123*";
export const DEFAULT_USER_PASSWORD = "City1234*";

export function isDefaultPassword(password: string) {
  return password === DEFAULT_STUDENT_PASSWORD || password === DEFAULT_USER_PASSWORD;
}

export const personalPasswordSchema = z.string()
  .min(8, "Use at least 8 characters for your new password.")
  .refine((password) => new TextEncoder().encode(password).length <= 72, "Use no more than 72 bytes for your password.")
  .refine((password) => password.trim().length > 0, "Your password cannot be blank.")
  .refine((password) => !isDefaultPassword(password), "Choose your own password, not a default password.");
