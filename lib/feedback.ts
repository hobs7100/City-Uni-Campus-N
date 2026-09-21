import { z } from "zod";
export const feedbackCategories = ["Administration","Teaching Faculty","Non-Teaching Faculty","Coordinators","Hygiene Issue","Other"] as const;
export const feedbackStatuses = ["submitted","open","in_progress","resolved","rejected"] as const;
export const feedbackSchema = z.object({
  category: z.enum(feedbackCategories), other_issue: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1).refine(v => v.split(/\s+/).filter(Boolean).length <= 1000, "Body must not exceed 1000 words"),
  attachments: z.array(z.object({
    url: z.string().url().refine(
      (value) => {
        const hostname = new URL(value).hostname;
        return hostname === "res.cloudinary.com" || hostname.endsWith(".res.cloudinary.com");
      },
      "Attachment must be an uploaded Cloudinary image",
    ),
    public_id: z.string().regex(
      /^campus-management\/feedback\/[A-Za-z0-9_-]+$/,
      "Invalid feedback attachment reference",
    ),
  })).max(2).optional().default([]),
}).superRefine((v, ctx) => {
  if (v.category === "Other" && !v.other_issue) ctx.addIssue({ code: "custom", path: ["other_issue"], message: "Required for Other category" });
  if (v.category !== "Other" && v.other_issue) ctx.addIssue({ code: "custom", path: ["other_issue"], message: "Only valid for Other category" });
});
export const commentSchema = z.object({ body: z.string().trim().min(1).max(1000) });