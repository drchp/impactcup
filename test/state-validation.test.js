import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { StateValidationError, validateState } from "../src/state-validation.js";

function minimalState() {
  return {
    hcp: { "Player A": 10 },
    m1: Array.from({ length: 5 }, () => ({
      mac1: "",
      mac2: "",
      wal1: "",
      wal2: "",
      result: "",
    })),
    m2: Array.from({ length: 5 }, () => ({
      mac1: "",
      mac2: "",
      wal1: "",
      wal2: "",
      result: "",
    })),
    m3: Array.from({ length: 10 }, () => ({ mac: "", wal: "", result: "" })),
    m4: ["", "", ""],
    teeOrder: [0, 1, 2, 3, 4],
  };
}

describe("validateState", () => {
  it("accepts a minimal valid tournament blob", () => {
    assert.equal(validateState(minimalState()), true);
  });

  it("rejects wrong m3 length", () => {
    const s = minimalState();
    s.m3.pop();
    assert.throws(() => validateState(s), StateValidationError);
  });

  it("rejects missing hcp", () => {
    const s = minimalState();
    delete s.hcp;
    assert.throws(() => validateState(s), StateValidationError);
  });
});
