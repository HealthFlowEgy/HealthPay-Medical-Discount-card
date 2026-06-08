import { describe, it, expect } from "vitest";
import { validateFullName, isValidFullName } from "../name.js";

describe("validateFullName (quadruple name)", () => {
  it("accepts a 4-part Arabic name", () => {
    expect(validateFullName("أحمد محمد علي حسن").ok).toBe(true);
  });
  it("accepts a 4-part Latin name", () => {
    expect(isValidFullName("Ahmed Mohamed Ali Hassan")).toBe(true);
  });
  it("rejects fewer than 4 parts", () => {
    const r = validateFullName("أحمد محمد علي");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/four parts/i);
  });
  it("rejects names with digits/symbols", () => {
    expect(isValidFullName("Ahmed 123 Ali Hassan")).toBe(false);
  });
  it("collapses extra whitespace", () => {
    expect(isValidFullName("  أحمد   محمد  علي   حسن ")).toBe(true);
  });
});
