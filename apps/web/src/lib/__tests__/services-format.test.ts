import { describe, it, expect } from "vitest";
import { parseServices } from "@/lib/services-format";

describe("parseServices", () => {
  it("returns [] for empty/nullish input", () => {
    expect(parseServices(null)).toEqual([]);
    expect(parseServices(undefined)).toEqual([]);
    expect(parseServices("")).toEqual([]);
    expect(parseServices("  ")).toEqual([]);
  });

  it("splits on the Arabic comma the portal joins with", () => {
    expect(parseServices("CBC، Vitamin D، Creatinine")).toEqual([
      "CBC",
      "Vitamin D",
      "Creatinine",
    ]);
  });

  it("also splits Latin commas, semicolons and newlines, trimming each", () => {
    expect(parseServices("CBC, Vitamin D ; X-ray\nMRI")).toEqual([
      "CBC",
      "Vitamin D",
      "X-ray",
      "MRI",
    ]);
  });

  it("keeps a single service as a one-item list (back-compat)", () => {
    expect(parseServices("CBC")).toEqual(["CBC"]);
  });

  it("round-trips the join used by the ops services editor", () => {
    const services = ["CBC", "Vitamin D", "Lipid panel"];
    expect(parseServices(services.join("، "))).toEqual(services);
  });
});
