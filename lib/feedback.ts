import { z } from "zod";
export const feedbackCategories = ["Administration","Teaching Faculty","Non-Teaching Faculty","Coordinators","Hygiene Issue","Other"] as const;
export const feedbackStatuses = ["submitted","open","in_progress","resolved","rejected"] as const;
export const feedbackSchema = z.object({
  category: z.enum(feedbackCategories), other_issue: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1).refine(v => v.split(/\s+/).filter(Boolean).length <= 1000, "Body must not exceed 1000 words"),
  attachments: z.array(z.object({ url: z.string().url(), public_id: z.string().min(1) })).max(2).optional().default([]),
}).superRefine((v, ctx) => {
  if (v.category === "Other" && !v.other_issue) ctx.addIssue({ code: "custom", path: ["other_issue"], message: "Required for Other category" });
  if (v.category !== "Other" && v.other_issue) ctx.addIssue({ code: "custom", path: ["other_issue"], message: "Only valid for Other category" });
});
export const commentSchema = z.object({ body: z.string().trim().min(1).max(1000) });