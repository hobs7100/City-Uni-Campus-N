import { z } from "zod";

/** Apply the same email rules before validating sign-in and student records. */
export const accountEmailSchema = z.string().trim().toLowerCase().email();
