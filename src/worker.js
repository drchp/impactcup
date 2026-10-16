import { StateValidationError, validateState } from "./state-validation.js";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

export default {
  /** @param {Request} request @param {Env} env */
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/state") {
      return handleStateApi(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};

/** @param {Request} request @param {Env} env */
async function handleStateApi(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  try {
    if (request.method === "GET") {
      const payload = await readCurrentState(env);
      return jsonResponse(payload, 200, request);
    }

    if (request.method === "PUT") {
      if (!isAuthorized(request, env)) {
        return jsonResponse({ error: "Unauthorized" }, 401, request);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400, request);
      }

      const { state, expectedVersion } = body ?? {};
      if (typeof expectedVersion !== "number" || !Number.isInteger(expectedVersion)) {
        return jsonResponse({ error: "expectedVersion must be an integer" }, 400, request);
      }

      try {
        validateState(state);
      } catch (e) {
        const msg = e instanceof StateValidationError ? e.message : "Invalid state";
        return jsonResponse({ error: msg }, 400, request);
      }

      const result = await writeState(env, state, expectedVersion);
      if (result.conflict) {
        return jsonResponse(
          {
            error: "Version conflict",
            currentVersion: result.currentVersion,
            state: result.state,
          },
          409,
          request,
        );
      }

      return jsonResponse({ version: result.version }, 200, request);
    }

    return jsonResponse({ error: "Method not allowed" }, 405, request);
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: "Internal server error" }, 500, request);
  }
}

/** @param {Env} env */
async function readCurrentState(env) {
  const row = await env.DB.prepare(
    "SELECT state_json, version FROM tournament_state WHERE id = ?",
  )
    .bind(env.TOURNAMENT_ID)
    .first();

  if (!row) {
    return { state: null, version: 0 };
  }

  return {
    state: JSON.parse(String(row.state_json)),
    version: Number(row.version),
  };
}

/**
 * @param {Env} env
 * @param {unknown} state
 * @param {number} expectedVersion
 */
async function writeState(env, state, expectedVersion) {
  const stateJson = JSON.stringify(state);
  const tournamentId = env.TOURNAMENT_ID;

  if (expectedVersion === 0) {
    const insert = await env.DB.prepare(
      `INSERT INTO tournament_state (id, state_json, version, updated_at)
       VALUES (?, ?, 1, datetime('now'))`,
    )
      .bind(tournamentId, stateJson)
      .run();

    if (insert.meta.changes === 1) {
      await appendHistory(env, tournamentId, stateJson, 1);
      return { version: 1, conflict: false };
    }

    const current = await readCurrentState(env);
    return {
      conflict: true,
      currentVersion: current.version,
      state: current.state,
    };
  }

  const update = await env.DB.prepare(
    `UPDATE tournament_state
     SET state_json = ?, version = version + 1, updated_at = datetime('now')
     WHERE id = ? AND version = ?`,
  )
    .bind(stateJson, tournamentId, expectedVersion)
    .run();

  if (update.meta.changes === 1) {
    const newVersion = expectedVersion + 1;
    await appendHistory(env, tournamentId, stateJson, newVersion);
    return { version: newVersion, conflict: false };
  }

  const current = await readCurrentState(env);
  return {
    conflict: true,
    currentVersion: current.version,
    state: current.state,
  };
}

/** @param {Env} env @param {string} tournamentId @param {string} stateJson @param {number} version */
async function appendHistory(env, tournamentId, stateJson, version) {
  await env.DB.prepare(
    `INSERT INTO state_history (tournament_id, state_json, version)
     VALUES (?, ?, ?)`,
  )
    .bind(tournamentId, stateJson, version)
    .run();
}

/** @param {Request} request @param {Env} env */
function isAuthorized(request, env) {
  const pin = env.SCORER_PIN;
  if (!pin) {
    return false;
  }
  const auth = request.headers.get("Authorization") ?? "";
  if (auth.startsWith("Bearer ")) {
    return auth.slice(7) === pin;
  }
  const headerPin = request.headers.get("X-Scorer-Pin");
  if (headerPin) {
    return headerPin === pin;
  }
  return false;
}

/** @param {unknown} data @param {number} status @param {Request} request */
function jsonResponse(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(request) },
  });
}

/** @param {Request} request */
function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  if (!origin) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Scorer-Pin",
    Vary: "Origin",
  };
}

/** @typedef {{ DB: D1Database; ASSETS: Fetcher; TOURNAMENT_ID: string; SCORER_PIN?: string }} Env */
