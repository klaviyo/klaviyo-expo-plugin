#!/usr/bin/env node

/*
 * Sets en-US release notes on the Play track release that contains a given
 * versionCode. `eas submit` has no Android release-notes option, so this
 * calls the Play Developer API (edits.tracks) directly after the submission.
 *
 * Usage:
 *   node scripts/ci/play-release-notes.js <versionCode> <notes-file>
 *
 * Env:
 *   SERVICE_ACCOUNT_JSON   service account key JSON (contents, not a path)
 *   PLAY_PACKAGE_NAME      defaults to com.klaviyo.expoexample
 *   PLAY_TRACK             defaults to internal
 *   PLAY_RELEASE_NAME      when set, written to the release's name field; a full
 *                          40-char commit SHA in it is shortened to 7 chars and
 *                          the result is capped at Play's 50-char limit
 */

const crypto = require("crypto");
const fs = require("fs");

// Play caps release notes at 500 characters per locale.
const MAX_NOTES_LENGTH = 500;
const API =
  "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function truncateNotes(text, max) {
  // Array.from splits by code point so a multi-byte character at the cutoff stays whole.
  return Array.from(text).slice(0, max).join("");
}

const MAX_RELEASE_NAME_LENGTH = 50;

function playReleaseName(name) {
  const short = (name || "").replace(/\b([0-9a-f]{7})[0-9a-f]{33}\b/g, "$1").trim();
  return short.length > MAX_RELEASE_NAME_LENGTH ? short.slice(0, MAX_RELEASE_NAME_LENGTH) : short;
}

function applyReleaseNotes(releases, versionCode, notes, releaseName) {
  const target = (releases || []).find((r) =>
    (r.versionCodes || []).includes(String(versionCode)),
  );
  if (!target) {
    throw new Error(`No release contains versionCode ${versionCode}`);
  }
  return releases.map((r) => {
    if (r !== target) return r;
    const updated = { ...r, releaseNotes: [{ language: "en-US", text: notes }] };
    if (releaseName) updated.name = releaseName;
    return updated;
  });
}

const REQUEST_TIMEOUT_MS = 30 * 1000;

async function request(method, url, { token, body, form, fetchImpl } = {}) {
  const doFetch = fetchImpl || fetch;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await doFetch(url, {
    method,
    headers,
    body: payload,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.parse(text).error?.message || "";
    } catch (err) {
      detail = "";
    }
    throw new Error(
      `${method} ${url.split("?")[0]} failed: HTTP ${res.status}${detail ? " " + detail : ""}`,
    );
  }
  return text ? JSON.parse(text) : {};
}

async function getAccessToken(serviceAccount, fetchImpl) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 600,
    }),
  );
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(`${header}.${claims}`)
    .sign(serviceAccount.private_key);
  const assertion = `${header}.${claims}.${base64url(signature)}`;
  const res = await request(
    "POST",
    serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
    {
      fetchImpl,
      form: {
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      },
    },
  );
  return res.access_token;
}

async function run({ argv, env, fetchImpl } = {}) {
  const [versionCode, notesFile] = argv;
  if (!versionCode || !notesFile) {
    throw new Error(
      "Usage: node scripts/ci/play-release-notes.js <versionCode> <notes-file>",
    );
  }
  const rawKey = env.SERVICE_ACCOUNT_JSON;
  if (!rawKey) {
    throw new Error("SERVICE_ACCOUNT_JSON is not set");
  }
  const packageName = env.PLAY_PACKAGE_NAME || "com.klaviyo.expoexample";
  const track = env.PLAY_TRACK || "internal";
  const releaseName = playReleaseName(env.PLAY_RELEASE_NAME);
  const notes = truncateNotes(
    fs.readFileSync(notesFile, "utf8").trim(),
    MAX_NOTES_LENGTH,
  );

  const token = await getAccessToken(JSON.parse(rawKey), fetchImpl);
  const appApi = `${API}/${packageName}`;
  const edit = await request("POST", `${appApi}/edits`, {
    token,
    body: {},
    fetchImpl,
  });
  const editApi = `${appApi}/edits/${edit.id}`;

  try {
    const current = await request("GET", `${editApi}/tracks/${track}`, {
      token,
      fetchImpl,
    });
    const releases = applyReleaseNotes(
      current.releases || [],
      versionCode,
      notes,
      releaseName,
    );
    await request("PUT", `${editApi}/tracks/${track}`, {
      token,
      body: { track, releases },
      fetchImpl,
    });
    await request("POST", `${editApi}:commit`, { token, fetchImpl });
  } catch (err) {
    await request("DELETE", editApi, { token, fetchImpl }).catch(() => {});
    throw err;
  }
  console.log(
    `Set release notes on ${packageName} ${track} versionCode ${versionCode}.`,
  );
}

if (require.main === module) {
  run({ argv: process.argv.slice(2), env: process.env }).catch((err) => {
    console.error(`::error::${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  playReleaseName,
  truncateNotes,
  applyReleaseNotes,
  getAccessToken,
  request,
  run,
};
