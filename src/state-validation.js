/** @typedef {import('./state-validation.js').TournamentState} TournamentState */

export const STATE_MAX_BYTES = 256 * 1024;

/**
 * @param {unknown} state
 * @returns {state is Record<string, unknown>}
 */
export function validateState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new StateValidationError("state must be a JSON object");
  }
  const s = /** @type {Record<string, unknown>} */ (state);
  if (!s.hcp || typeof s.hcp !== "object" || Array.isArray(s.hcp)) {
    throw new StateValidationError("state.hcp must be an object");
  }
  validateMatchGroup(s.m1, "m1", 5, "scramble");
  validateMatchGroup(s.m2, "m2", 5, "scramble");
  validateSingles(s.m3);
  validateFinale(s.m4);
  if (s.teeOrder !== undefined) {
    if (!Array.isArray(s.teeOrder) || s.teeOrder.length !== 5) {
      throw new StateValidationError("state.teeOrder must be an array of length 5");
    }
    for (const n of s.teeOrder) {
      if (typeof n !== "number" || n < 0 || n > 4 || !Number.isInteger(n)) {
        throw new StateValidationError("state.teeOrder must be a permutation of 0–4");
      }
    }
  }
  const bytes = new TextEncoder().encode(JSON.stringify(state)).byteLength;
  if (bytes > STATE_MAX_BYTES) {
    throw new StateValidationError(`state exceeds ${STATE_MAX_BYTES} byte limit`);
  }
  return true;
}

/**
 * @param {unknown} rows
 * @param {string} key
 * @param {number} len
 * @param {"scramble"} kind
 */
function validateMatchGroup(rows, key, len, kind) {
  if (!Array.isArray(rows) || rows.length !== len) {
    throw new StateValidationError(`${key} must be an array of length ${len}`);
  }
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      throw new StateValidationError(`${key} rows must be objects`);
    }
    if (kind === "scramble") {
      for (const slot of ["mac1", "mac2", "wal1", "wal2", "result"]) {
        if (!(slot in row) || typeof row[slot] !== "string") {
          throw new StateValidationError(`${key} row missing string field ${slot}`);
        }
      }
    }
  }
}

/** @param {unknown} rows */
function validateSingles(rows) {
  if (!Array.isArray(rows) || rows.length !== 10) {
    throw new StateValidationError("m3 must be an array of length 10");
  }
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      throw new StateValidationError("m3 rows must be objects");
    }
    for (const slot of ["mac", "wal", "result"]) {
      if (!(slot in row) || typeof row[slot] !== "string") {
        throw new StateValidationError(`m3 row missing string field ${slot}`);
      }
    }
  }
}

/** @param {unknown} m4 */
function validateFinale(m4) {
  if (!Array.isArray(m4) || m4.length !== 3) {
    throw new StateValidationError("m4 must be an array of length 3");
  }
  for (const v of m4) {
    if (typeof v !== "string") {
      throw new StateValidationError("m4 entries must be strings");
    }
  }
}

export class StateValidationError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = "StateValidationError";
  }
}
