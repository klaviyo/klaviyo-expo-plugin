#!/usr/bin/env node

/*
 * Computes the next build number for a store submission, so CI can stamp it
 * into the app before EAS builds with appVersionSource: local.
 *
 * iOS numbering is per marketing version: it restarts at 1 for each new
 * marketing version. Android uses the highest versionCode across every bundle
 * and track of the app, plus one, and never restarts.
 *
 * Usage:
 *   node scripts/ci/next-build-number.js ios --bundle-id ID --marketing-version V [--minimum N]
 *   node scripts/ci/next-build-number.js android --package NAME [--minimum N]
 *
 * Prints one JSON object to stdout and, when $GITHUB_OUTPUT is set, appends
 * `build_number=<n>` to it.
 *
 * Env (ios):
 *   APP_STORE_CONNECT_API_KEY_KEY_ID
 *   APP_STORE_CONNECT_API_KEY_ISSUER_ID
 *   APP_STORE_CONNECT_API_KEY_KEY        .p8 contents: raw PEM, PEM with
 *                                        literal \n escapes, or base64 PEM
 * Env (android):
 *   SERVICE_ACCOUNT_JSON   service account key JSON (contents, not a path)
 */

const fs = require("fs");

const { AscClient, normalizePrivateKey } = require("./asc-whats-new");
const { getAccessToken, request } = require("./play-release-notes");

const PLAY_API =
  "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";

// Highest integer in a list of version strings; non-integer values are ignored.
function maxBuildNumber(versions) {
  let best = 0;
  for (const v of versions) {
    if (typeof v === "string" && /^\d+$/.test(v.trim())) {
      best = Math.max(best, parseInt(v.trim(), 10));
    }
  }
  return best;
}

// One above the highest uploaded build, never below `minimum`.
function nextBuildNumber(latest, minimum = 1) {
  return Math.max(latest + 1, minimum);
}

function parseArgs(argv) {
  const args = argv.slice();
  const platform = args.shift();
  const opts = {
    platform,
    bundleId: "",
    marketingVersion: "",
    packageName: "",
    minimum: 1,
  };
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
      case "--package":
        opts.packageName = next();
        break;
      case "--minimum":
        opts.minimum = Number(next());
        break;
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }
  if (platform === "ios") {
    if (!opts.bundleId || !opts.marketingVersion) {
      throw new Error(
        "Usage: node scripts/ci/next-build-number.js ios --bundle-id ID --marketing-version V [--minimum N]",
      );
    }
  } else if (platform === "android") {
    if (!opts.packageName) {
      throw new Error(
        "Usage: node scripts/ci/next-build-number.js android --package NAME [--minimum N]",
      );
    }
  } else {
    throw new Error(`Unknown platform: ${platform || "(none)"} (expected ios or android)`);
  }
  if (!Number.isInteger(opts.minimum) || opts.minimum < 1) {
    throw new Error("--minimum must be a positive integer");
  }
  return opts;
}

function ascClientFromEnv(env, fetchImpl, now) {
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
    now || (() => Date.now()),
  );
}

async function recentBuildVersions(client, appId, marketingVersion) {
  const params = {
    "filter[app]": appId,
    sort: "-uploadedDate",
    limit: "200",
    "fields[builds]": "version,uploadedDate",
  };
  if (marketingVersion) {
    params["filter[preReleaseVersion.version]"] = marketingVersion;
  }
  const resp = await client.request("GET", "/v1/builds", params);
  return (resp.data || []).map((b) => (b.attributes || {}).version);
}

async function iosPreflight({ client, bundleId, marketingVersion, minimum = 1 }) {
  const app = await client.findApp(bundleId);
  const versions = await recentBuildVersions(client, app.id, marketingVersion);
  const latest = maxBuildNumber(versions);
  return {
    app_id: app.id,
    marketing_version: marketingVersion,
    latest_build_number: latest,
    build_number: nextBuildNumber(latest, minimum),
  };
}

function trackVersionCodes(tracks) {
  const codes = [];
  for (const track of tracks || []) {
    for (const release of track.releases || []) {
      codes.push(...(release.versionCodes || []));
    }
  }
  return codes;
}

async function androidPreflight({
  packageName,
  serviceAccount,
  minimum = 1,
  fetchImpl,
}) {
  const token = await getAccessToken(serviceAccount, fetchImpl);
  const appApi = `${PLAY_API}/${packageName}`;
  const edit = await request("POST", `${appApi}/edits`, {
    token,
    body: {},
    fetchImpl,
  });
  const editApi = `${appApi}/edits/${edit.id}`;
  let bundles = [];
  let tracks = [];
  try {
    const bundleResp = await request("GET", `${editApi}/bundles`, {
      token,
      fetchImpl,
    });
    bundles = bundleResp.bundles || [];
    const trackResp = await request("GET", `${editApi}/tracks`, {
      token,
      fetchImpl,
    });
    tracks = trackResp.tracks || [];
  } finally {
    // Edits expire on their own, but holding one open blocks other edits.
    await request("DELETE", editApi, { token, fetchImpl }).catch(() => {});
  }
  const bundleCodes = bundles
    .map((b) => b.versionCode)
    .filter((c) => Number.isInteger(c));
  const highest = Math.max(
    bundleCodes.length ? Math.max(...bundleCodes) : 0,
    maxBuildNumber(trackVersionCodes(tracks)),
  );
  return {
    package: packageName,
    highest_version_code: highest,
    build_number: Math.max(highest + 1, minimum),
  };
}

function writeGithubOutput(env, buildNumber) {
  const path = env.GITHUB_OUTPUT;
  if (!path) return;
  fs.appendFileSync(path, `build_number=${buildNumber}\n`);
}

async function run({ argv, env, fetchImpl, out, now }) {
  const opts = parseArgs(argv);
  const print = out || console.log;
  let result;
  if (opts.platform === "ios") {
    const client = ascClientFromEnv(env, fetchImpl, now);
    result = await iosPreflight({
      client,
      bundleId: opts.bundleId,
      marketingVersion: opts.marketingVersion,
      minimum: opts.minimum,
    });
  } else {
    if (!env.SERVICE_ACCOUNT_JSON) {
      throw new Error("SERVICE_ACCOUNT_JSON is not set");
    }
    result = await androidPreflight({
      packageName: opts.packageName,
      serviceAccount: JSON.parse(env.SERVICE_ACCOUNT_JSON),
      minimum: opts.minimum,
      fetchImpl,
    });
  }
  print(JSON.stringify(result));
  writeGithubOutput(env, result.build_number);
  return result;
}

if (require.main === module) {
  run({
    argv: process.argv.slice(2),
    env: process.env,
    fetchImpl: fetch,
  }).catch((err) => {
    console.error(`::error::${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  maxBuildNumber,
  nextBuildNumber,
  parseArgs,
  recentBuildVersions,
  trackVersionCodes,
  iosPreflight,
  androidPreflight,
  writeGithubOutput,
  run,
};
