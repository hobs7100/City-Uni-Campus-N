import { beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ExamSlipsPanel from "../components/studentDashboard/ExamSlipsPanel";
import FinePaymentDialog from "../app/dashboard/admin/fines/FinePaymentDialog";

beforeAll(() => { vi.stubGlobal("React", React); });

describe("student slip controls", () => {
  it("renders only Mid Term and Clearance sections with one print button each", () => {
    const html = renderToStaticMarkup(React.createElement(ExamSlipsPanel, { busy: null, onGenerate: () => {} }));
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html.match(/Generate \/ Print/g)).toHaveLength(2);
    expect(html).toContain(">Mid Term</h3>");
    expect(html).toContain(">Clearance</h3>");
    expect(html).not.toContain("PDF");
    expect(html).not.toMatch(/<p(?:\s|>)/);
    expect(html).not.toContain("eligibility");
  });
  it("disables both controls while one slip is preparing", () => {
    const html = renderToStaticMarkup(React.createElement(ExamSlipsPanel, { busy: "rollno", onGenerate: () => {} }));
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).toContain("Preparing print");
  });
});

it("shows the exact remaining payment balance without subtracting paid amounts twice", () => {
  const html = renderToStaticMarkup(React.createElement(FinePaymentDialog, {
    fine: { name: "Test Student", class_name: "Test Class", semester_number: 1,
      gross_amount: 1000, discount_amount: 0, paid_amount: 500, net_amount: 500 },
    submitting: false, onClose: () => {}, onSubmit: async () => {},
  }));
  expect(html).toMatch(/text-teal-900">PKR 500<\/p>/);
});
