import { describe, expect, it } from "vitest";
import { accountEmailSchema } from "@/lib/account-email";

describe("Shared email rules for login, creation, editing and import", () => {
  it.each([" PERSON@EXAMPLE.TEST ", "\tPerson@Example.Test\n", "person@example.test"])(
    "normalizes an email before validating it: %j", (value) => {
      expect(accountEmailSchema.parse(value)).toBe("person@example.test");
    },
  );
  it.each(["", " ", "not-an-email", "person @example.test", "person@example", null])(
    "rejects invalid addresses rather than provisioning an unusable login: %j", (value) => {
      expect(accountEmailSchema.safeParse(value).success).toBe(false);
    },
  );
  it("allows unrelated student edits without an email change", () => {
    expect(accountEmailSchema.optional().parse(undefined)).toBeUndefined();
  });
});
