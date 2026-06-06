import { describe, it, expect } from "vitest";
import {
  assertTransition,
  canTransition,
  isTerminal,
  eventForTransition,
  REQUEST_STATUSES,
  TRANSITIONS,
  type RequestStatus,
} from "../state-machine.js";
import { InvalidTransitionError } from "../errors.js";

const LEGAL: Array<[RequestStatus, RequestStatus]> = [
  ["pending_quote", "quoted"],
  ["pending_quote", "cancelled"],
  ["quoted", "confirmed"],
  ["quoted", "expired"],
  ["quoted", "cancelled"],
];

describe("state machine — legal transitions", () => {
  it.each(LEGAL)("allows %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    const res = assertTransition(from, to);
    expect(res).toMatchObject({ from, to });
  });

  it("attaches the right webhook event names", () => {
    expect(eventForTransition("pending_quote", "quoted")).toBe("request.quoted");
    expect(eventForTransition("quoted", "confirmed")).toBe("request.confirmed");
    expect(eventForTransition("quoted", "expired")).toBe("request.expired");
    expect(eventForTransition("quoted", "cancelled")).toBe("request.cancelled");
    expect(eventForTransition("pending_quote", "cancelled")).toBe("request.cancelled");
  });
});

describe("state machine — illegal transitions", () => {
  // Every ordered pair NOT in LEGAL (and not a no-op same-state) must throw.
  const all = REQUEST_STATUSES;
  const legalSet = new Set(LEGAL.map(([f, t]) => `${f}->${t}`));

  for (const from of all) {
    for (const to of all) {
      if (from === to) continue;
      if (legalSet.has(`${from}->${to}`)) continue;
      it(`rejects ${from} -> ${to}`, () => {
        expect(() => assertTransition(from, to)).toThrow(InvalidTransitionError);
      });
    }
  }

  it("rejects a no-op same-state transition", () => {
    expect(() => assertTransition("quoted", "quoted")).toThrow(InvalidTransitionError);
  });

  it("rejects transitions out of terminal states", () => {
    for (const terminal of ["confirmed", "expired", "cancelled"] as const) {
      expect(isTerminal(terminal)).toBe(true);
      for (const to of REQUEST_STATUSES) {
        if (to === terminal) continue;
        expect(() => assertTransition(terminal, to)).toThrow(InvalidTransitionError);
      }
    }
  });

  it("rejects unknown statuses", () => {
    expect(() =>
      assertTransition("bogus" as RequestStatus, "quoted"),
    ).toThrow(InvalidTransitionError);
  });
});

describe("state machine — structure", () => {
  it("only pending_quote and quoted are non-terminal", () => {
    expect(isTerminal("pending_quote")).toBe(false);
    expect(isTerminal("quoted")).toBe(false);
    expect(TRANSITIONS.confirmed).toHaveLength(0);
    expect(TRANSITIONS.expired).toHaveLength(0);
    expect(TRANSITIONS.cancelled).toHaveLength(0);
  });
});
