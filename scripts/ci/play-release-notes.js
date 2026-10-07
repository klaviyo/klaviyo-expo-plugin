#!/usr/bin/env node

/**
 * Sets en-US release notes on the Play track release that contains a given
 * versionCode. `eas submit` has no Android release-notes option, so this
 * calls the Play Developer API (edits.tracks) directly after the submission.
 *
 * Usage:
 *   node scripts/ci/play-release-notes.js <versionCode> <notes-file>
 *
 * Env:
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON  service account key JSON (contents, not a path)
 *   PLAY_PACKAGE_NAME                 defaults to com.klaviyo.expoexample
 *   PLAY_TRACK                        defaults to internal
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

async function request(method, url, { token, body, form } = {}) {
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
  const res = await fetch(url, { method, headers, body: payload });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `${method} ${url.split("?")[0]} failed: HTTP ${res.status} ${text}`,
    );
  }
  return text ? JSON.parse(text) : {};
}

async function getAccessToken(serviceAccount) {
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
      form: {
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      },
    },
  );
  return res.access_token;
}

async function main() {
  const [versionCode, notesFile] = process.argv.slice(2);
  if (!versionCode || !notesFile) {
    console.error(
      "Usage: node scripts/ci/play-release-notes.js <versionCode> <notes-file>",
    );
    process.exit(1);
  }
  const rawKey = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!rawKey) {
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not set");
  }
  const packageName =
    process.env.PLAY_PACKAGE_NAME || "com.klaviyo.expoexample";
  const track = process.env.PLAY_TRACK || "internal";
  // Array.from splits by code point so a multi-byte character at the cutoff stays whole.
  const notes = Array.from(fs.readFileSync(notesFile, "utf8").trim())
    .slice(0, MAX_NOTES_LENGTH)
    .join("");

  const token = await getAccessToken(JSON.parse(rawKey));
  const appApi = `${API}/${packageName}`;
  const edit = await request("POST", `${appApi}/edits`, { token, body: {} });
  const editApi = `${appApi}/edits/${edit.id}`;

  try {
    const current = await request("GET", `${editApi}/tracks/${track}`, {
      token,
    });
    const releases = current.releases || [];
    const target = releases.find((r) =>
      (r.versionCodes || []).includes(String(versionCode)),
    );
    if (!target) {
      throw new Error(
        `No release on the ${track} track contains versionCode ${versionCode}`,
      );
    }
    target.releaseNotes = [{ language: "en-US", text: notes }];
    await request("PUT", `${editApi}/tracks/${track}`, {
      token,
      body: { track, releases },
    });
    await request("POST", `${editApi}:commit`, { token });
  } catch (err) {
    await request("DELETE", editApi, { token }).catch(() => {});
    throw err;
  }
  console.log(
    `Set release notes on ${packageName} ${track} versionCode ${versionCode}.`,
  );
}

main().catch((err) => {
  console.error(`::error::${err.message}`);
  process.exit(1);
});
