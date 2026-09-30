import { beforeEach, describe, expect, it, vi } from "vitest";
import cloudinary from "@/lib/cloudinary";
import {
  maxTicketFileBytes,
  maxTicketFiles,
  validateTicketDescription,
} from "../lib/tickets/types";
import {
  filesFromForm,
  formDataFromBoundedRequest,
  uploadTicketFiles,
} from "../lib/tickets/uploads";

vi.mock("@/lib/cloudinary", () => ({
  default: {
    uploader: {
      upload: vi.fn(),
      destroy: vi.fn(),
    },
    url: vi.fn(),
  },
}));

function formWithFiles(files: File[]) {
  const form = new FormData();
  for (const file of files) form.append("files", file);
  return form;
}

describe("ticket description validation", () => {
  it("accepts exactly 1000 words and rejects 1001", () => {
    expect(validateTicketDescription(Array(1000).fill("word").join(" "))).toBeNull();
    expect(validateTicketDescription(Array(1001).fill("word").join(" "))).toBe(
      "Description must not exceed 1000 words.",
    );
  });

  it("rejects empty, whitespace-only, and non-string descriptions", () => {
    expect(validateTicketDescription("")).toBe("Description is required.");
    expect(validateTicketDescription(" \n\t ")).toBe("Description is required.");
    expect(validateTicketDescription(null)).toBe("Description is required.");
    expect(validateTicketDescription(42)).toBe("Description is required.");
  });
});

describe("ticket file validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows at most two files", () => {
    const accepted = [new File(["a"], "a.pdf", { type: "application/pdf" }),
      new File(["b"], "b.jpg", { type: "image/jpeg" })];
    expect(filesFromForm(formWithFiles(accepted))).toHaveLength(maxTicketFiles);

    const tooMany = [...accepted, new File(["c"], "c.jpg", { type: "image/jpeg" })];
    expect(() => filesFromForm(formWithFiles(tooMany))).toThrow(
      "Upload no more than two files at a time.",
    );
  });

  it("rejects empty files and files larger than 2 MiB", () => {
    expect(() => filesFromForm(formWithFiles([
      new File([], "empty.pdf", { type: "application/pdf" }),
    ]))).toThrow("Uploaded files cannot be empty.");

    expect(filesFromForm(formWithFiles([
      new File([new Uint8Array(maxTicketFileBytes)], "boundary.pdf", {
        type: "application/pdf",
      }),
    ]))).toHaveLength(1);
    expect(() => filesFromForm(formWithFiles([
      new File([new Uint8Array(maxTicketFileBytes + 1)], "large.pdf", {
        type: "application/pdf",
      }),
    ]))).toThrow("Each file must be 2 MB or smaller.");
  });

  it("rejects unsupported MIME types", () => {
    expect(() => filesFromForm(formWithFiles([
      new File(["content"], "script.txt", { type: "text/plain" }),
    ]))).toThrow("Only PDF, JPG, and MPEG files are allowed.");
  });

  it.each([
    ["application/pdf", "spoofed.pdf"],
    ["image/jpeg", "spoofed.jpg"],
    ["audio/mpeg", "spoofed.mp3"],
    ["video/mpeg", "spoofed.mpeg"],
  ])("rejects spoofed %s contents before contacting Cloudinary", async (mimeType, name) => {
    const file = new File(["not a matching media signature"], name, { type: mimeType });

    await expect(uploadTicketFiles([file])).rejects.toThrow(
      "The file content does not match its supported file type.",
    );
    expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });

  it("rejects a multipart request larger than 5 MiB when Content-Length is absent", async () => {
    const request = new Request("http://localhost/tickets", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=test" },
      body: new Uint8Array(5 * 1024 * 1024 + 1),
    });
    expect(request.headers.has("content-length")).toBe(false);

    await expect(formDataFromBoundedRequest(request)).rejects.toThrow(
      "The complete upload request must be 5 MB or smaller.",
    );
  });
});