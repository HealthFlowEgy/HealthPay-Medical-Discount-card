import { describe, it, expect } from "vitest";
import {
  normalizeEgyptianMobile,
  isValidEgyptianMobile,
  maskMobile,
} from "../mobile.js";

describe("normalizeEgyptianMobile", () => {
  it("normalizes local 0-prefixed form to E.164", () => {
    const res = normalizeEgyptianMobile("01001234567");
    expect(res.ok && res.e164).toBe("+201001234567");
    expect(res.ok && res.national).toBe("01001234567");
  });

  it("accepts already-E.164 numbers", () => {
    expect(normalizeEgyptianMobile("+201001234567")).toMatchObject({
      ok: true,
      e164: "+201001234567",
    });
  });

  it("accepts 0020 and bare 20 country-code forms", () => {
    expect(normalizeEgyptianMobile("00201001234567")).toMatchObject({
      ok: true,
      e164: "+201001234567",
    });
    expect(normalizeEgyptianMobile("201001234567")).toMatchObject({
      ok: true,
      e164: "+201001234567",
    });
  });

  it("strips spaces, dashes and parentheses", () => {
    expect(normalizeEgyptianMobile("010 0123-4567")).toMatchObject({
      ok: true,
      e164: "+201001234567",
    });
  });

  it.each(["010", "011", "012", "015"])(
    "accepts operator prefix %s",
    (prefix) => {
      const res = normalizeEgyptianMobile(`${prefix}12345678`);
      expect(res.ok).toBe(true);
    },
  );

  it("rejects unknown operator prefix 013", () => {
    expect(normalizeEgyptianMobile("01312345678").ok).toBe(false);
  });

  it("rejects wrong-length numbers", () => {
    expect(normalizeEgyptianMobile("0100123456").ok).toBe(false); // too short
    expect(normalizeEgyptianMobile("010012345678").ok).toBe(false); // too long
  });

  it("rejects non-Egyptian numbers", () => {
    expect(normalizeEgyptianMobile("+14155552671").ok).toBe(false);
  });

  it("isValidEgyptianMobile is a boolean wrapper", () => {
    expect(isValidEgyptianMobile("01001234567")).toBe(true);
    expect(isValidEgyptianMobile("nope")).toBe(false);
  });
});

describe("maskMobile", () => {
  it("masks the middle of an E.164 number", () => {
    expect(maskMobile("+201001234567")).toBe("+2010••••4567");
  });
});
