import { describe, it, expect } from "vitest";
import {
  SERVICE_TYPES,
  GOVERNORATES,
  REQUEST_STATUSES,
} from "@healthpay/shared";
import {
  serviceTypeEnum,
  governorateEnum,
  requestStatusEnum,
} from "../schema.js";

/**
 * The schema declares its enum value lists locally (so the migration toolchain
 * doesn't have to resolve the workspace package at runtime). These tests are the
 * safety net that guarantees those local lists never drift from the canonical
 * definitions in @healthpay/shared.
 */
describe("schema enums stay in sync with @healthpay/shared", () => {
  it("service_type matches", () => {
    expect(serviceTypeEnum.enumValues).toEqual([...SERVICE_TYPES]);
  });
  it("governorate matches (all 27)", () => {
    expect(governorateEnum.enumValues).toEqual([...GOVERNORATES]);
    expect(governorateEnum.enumValues).toHaveLength(27);
  });
  it("request_status matches", () => {
    expect(requestStatusEnum.enumValues).toEqual([...REQUEST_STATUSES]);
  });
});
