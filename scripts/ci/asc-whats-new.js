#!/usr/bin/env node

/*
 * Waits for an uploaded build to finish processing in App Store Connect and
 * sets its TestFlight "What to Test" text via betaBuildLocalizations.
 * `eas submit` has no what-to-test option, so this calls the App Store
 * Connect API directly after the submission.
 *
 * Usage:
 *   node scripts/ci/asc-whats-new.js --bundle-id X --marketing-version V \
 *     --build-number N --notes-file F [--timeout SECONDS] [--poll-interval SECONDS] [--dry-run]
 *
 * Env:
 *   APP_STORE_CONNECT_API_KEY_KEY_ID
 *   APP_STORE_CONNECT_API_KEY_ISSUER_ID
 *   APP_STORE_CONNECT_API_KEY_KEY        .p8 contents: raw PEM, PEM with
 *                                        literal \n escapes, or base64 PEM
 */

const crypto = require("crypto");
const fs = require("fs");

const { marketingVersion: stripToMarketingVersion } = require("./marketing-version");

const API_BASE = "https://api.appstoreconnect.apple.com";
// Apple caps tokens at 20 minutes.
const TOKEN_LIFETIME_SECONDS = 15 * 60;
// Apple's limit for the whatsNew attribute.
const WHAT_TO_TEST_MAX_CHARS = 4000;
const DEFAULT_LOCALE = "en-US";

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function normalizePrivateKey(raw) {
  let key = String(raw).trim();
  if (key.includes("\\n") && !key.includes("\n")) {
    key = key.replace(/\\n/g, "\n");
  }
  if (!key.includes("BEGIN")) {
    try {
      key = Buffer.from(key, "base64").toString("utf8").trim();
    } catch (err) {
      throw new Error(
        "APP_STORE_CONNECT_API_KEY_KEY is neither PEM nor base64 PEM",
      );
    }
  }
  if (!key.includes("BEGIN")) {
    throw new Error(
      "APP_STORE_CONNECT_API_KEY_KEY does not look like a PEM private key",
    );
  }
  return key + "\n";
}

function makeToken(keyId, issuerId, privateKey, now) {
  const issuedAt = Math.floor(now === undefined ? Date.now() / 1000 : now);
  const header = base64url(
    JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }),
  );
  const payload = base64url(
    JSON.stringify({
      iss: issuerId,
      iat: issuedAt,
      exp: issuedAt + TOKEN_LIFETIME_SECONDS,
      aud: "appstoreconnect-v1",
    }),
  );
  const signature = crypto.sign("sha256", `${header}.${payload}`, {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });
  return `${header}.${payload}.${base64url(signature)}`;
}

function truncate(text, max) {
  return Array.from(text).slice(0, max).join("");
}

function parseArgs(argv) {
  const opts = {
    bundleId: "",
    marketingVersion: "",
    buildNumber: "",
    notesFile: "",
    timeout: 2700,
    pollInterval: 30,
    dryRun: false,
  };
  const args = argv.slice();
  while (args.length) {
    const flag = args.shift();
    const next = () => {
      if (!args.length) throw new Error(`${flag} requires a value`);
      return args.shift();
    };
    switch (flag) {
      case "--bundle-id":
        opts.bundleId = next();
        break;
      case "--marketing-version":
        opts.marketingVersion = next();
        break;
      case "--build-number":
        opts.buildNumber = next();
        break;
      case "--notes-file":
        opts.notesFile = next();
        break;
      case "--timeout":
        opts.timeout = Number(next());
        break;
      case "--poll-interval":
        opts.pollInterval = Number(next());
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }
  if (!opts.bundleId || !opts.marketingVersion || !opts.buildNumber || !opts.notesFile) {
    throw new Error(
      "Usage: node scripts/ci/asc-whats-new.js --bundle-id X --marketing-version V " +
        "--build-number N --notes-file F [--timeout SECONDS] [--poll-interval SECONDS] [--dry-run]",
    );
  }
  opts.marketingVersion = stripToMarketingVersion(opts.marketingVersion);
  return opts;
}

class AscClient {
  constructor(keyId, issuerId, privateKey, fetchImpl, now) {
    this.keyId = keyId;
    this.issuerId = issuerId;
    this.privateKey = privateKey;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.token = null;
    this.tokenExpiresAt = 0;
  }

  authHeader() {
    // Refresh a minute before expiry; polling can outlive a token.
    const nowSeconds = Math.floor(this.now() / 1000);
    if (this.token === null || nowSeconds > this.tokenExpiresAt - 60) {
      this.token = makeToken(
        this.keyId,
        this.issuerId,
        this.privateKey,
        nowSeconds,
      );
      this.tokenExpiresAt = nowSeconds + TOKEN_LIFETIME_SECONDS;
    }
    return `Bearer ${this.token}`;
  }

  async request(method, path, params, body) {
    let url = API_BASE + path;
    if (params) url += "?" + new URLSearchParams(params).toString();
    const headers = {
      Authorization: this.authHeader(),
      Accept: "application/json",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await this.fetchImpl(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      let detail = "";
      try {
        const parsed = JSON.parse(text);
        detail = (parsed.errors || [])
          .map((e) => e.detail)
          .filter(Boolean)
          .join("; ");
      } catch (err) {
        detail = "";
      }
      throw new Error(
        `${method} ${path} failed with HTTP ${res.status}${detail ? ": " + detail : ""}`,
      );
    }
    return text ? JSON.parse(text) : {};
  }

  async findApp(bundleId) {
    const resp = await this.request("GET", "/v1/apps", {
      "filter[bundleId]": bundleId,
      "fields[apps]": "name,bundleId",
    });
    // filter[bundleId] can also match bundle IDs that share a prefix, so match exactly.
    for (const app of resp.data || []) {
      if ((app.attributes || {}).bundleId === bundleId) return app;
    }
    throw new Error(`No App Store Connect app found for bundle ID ${bundleId}`);
  }

  // marketingVersion is required: the lookup is by app, marketing version and build number.
  async findBuild(appId, marketingVersion, buildNumber) {
    if (!marketingVersion) {
      throw new Error("findBuild needs a marketing version; a build number alone can match an older version");
    }
    const params = {
      "filter[app]": appId,
      "filter[version]": buildNumber,
      "fields[builds]": "version,processingState,uploadedDate",
      "filter[preReleaseVersion.version]": marketingVersion,
      limit: "1",
    };
    const resp = await this.request("GET", "/v1/builds", params);
    const data = resp.data || [];
    return data.length ? data[0] : null;
  }

  async listLocalizations(buildId) {
    const resp = await this.request(
      "GET",
      `/v1/builds/${buildId}/betaBuildLocalizations`,
      { "fields[betaBuildLocalizations]": "locale" },
    );
    return resp.data || [];
  }

  async setWhatToTest(buildId, text, locale = DEFAULT_LOCALE) {
    const existing = await this.listLocalizations(buildId);
    const updated = [];
    for (const loc of existing) {
      await this.request("PATCH", `/v1/betaBuildLocalizations/${loc.id}`, undefined, {
        data: {
          type: "betaBuildLocalizations",
          id: loc.id,
          attributes: { whatsNew: text },
        },
      });
      updated.push((loc.attributes || {}).locale || loc.id);
    }
    if (!existing.length) {
      await this.request("POST", "/v1/betaBuildLocalizations", undefined, {
        data: {
          type: "betaBuildLocalizations",
          attributes: { locale, whatsNew: text },
          relationships: { build: { data: { type: "builds", id: buildId } } },
        },
      });
      updated.push(locale);
    }
    return updated;
  }
}

function clientFromEnv(env, fetchImpl, now) {
  const names = [
    "APP_STORE_CONNECT_API_KEY_KEY_ID",
    "APP_STORE_CONNECT_API_KEY_ISSUER_ID",
    "APP_STORE_CONNECT_API_KEY_KEY",
  ];
  const missing = names.filter((n) => !env[n]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
  return new AscClient(
    env.APP_STORE_CONNECT_API_KEY_KEY_ID.trim(),
    env.APP_STORE_CONNECT_API_KEY_ISSUER_ID.trim(),
    normalizePrivateKey(env.APP_STORE_CONNECT_API_KEY_KEY),
    fetchImpl,
    now,
  );
}

async function run({ argv, env, fetchImpl, sleep, now }) {
  const opts = parseArgs(argv);
  const text = truncate(
    fs.readFileSync(opts.notesFile, "utf8").trim(),
    WHAT_TO_TEST_MAX_CHARS,
  );
  const client = clientFromEnv(env, fetchImpl, now);
  const app = await client.findApp(opts.bundleId);

  const deadline = now() + opts.timeout * 1000;
  let build = null;
  while (true) {
    build = await client.findBuild(
      app.id,
      opts.marketingVersion,
      opts.buildNumber,
    );
    const state = build ? (build.attributes || {}).processingState : null;
    console.log(
      `Build ${opts.marketingVersion} (${opts.buildNumber}): ${state || "not visible yet"}`,
    );
    if (state === "VALID" || (opts.dryRun && build)) break;
    if (state === "FAILED" || state === "INVALID") {
      throw new Error(`Build processing ended in state ${state}`);
    }
    if (now() > deadline) {
      throw new Error(
        `Timed out after ${opts.timeout}s waiting for the build to finish processing`,
      );
    }
    await sleep(opts.pollInterval * 1000);
  }

  if (opts.dryRun) {
    const existing = await client.listLocalizations(build.id);
    console.log(
      `Dry run: would set What to Test on build ${build.id} (${existing.length} existing localizations):`,
    );
    console.log(text);
    return;
  }

  const locales = await client.setWhatToTest(build.id, text);
  console.log(`Set What to Test for locales: ${locales.join(", ")}`);
}

if (require.main === module) {
  run({
    argv: process.argv.slice(2),
    env: process.env,
    fetchImpl: fetch,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
  }).catch((err) => {
    console.error(`::error::${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  normalizePrivateKey,
  makeToken,
  truncate,
  parseArgs,
  run,
  AscClient,
};
