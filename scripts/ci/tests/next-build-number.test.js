const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const nbn = require("../next-build-number.js");

const { privateKey: ascKey } = crypto.generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
const ASC_PEM = ascKey.export({ type: "pkcs8", format: "pem" });

const { privateKey: rsaKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const RSA_PEM = rsaKey.export({ type: "pkcs8", format: "pem" });

const ASC_ENV = {
  APP_STORE_CONNECT_API_KEY_KEY_ID: "KEYID",
  APP_STORE_CONNECT_API_KEY_ISSUER_ID: "ISSUER",
  APP_STORE_CONNECT_API_KEY_KEY: ASC_PEM,
};

const PLAY_ENV = {
  SERVICE_ACCOUNT_JSON: JSON.stringify({
    client_email: "ci@example.iam.gserviceaccount.com",
    private_key: RSA_PEM,
    token_uri: "https://oauth2.googleapis.com/token",
  }),
};

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  };
}

// --- pure helpers ---

test("maxBuildNumber returns 0 for an empty list", () => {
  assert.equal(nbn.maxBuildNumber([]), 0);
});

test("maxBuildNumber ignores non-integer strings", () => {
  assert.equal(nbn.maxBuildNumber(["abc", "1.5", " 7 ", "3"]), 7);
  assert.equal(nbn.maxBuildNumber(["abc"]), 0);
});

test("nextBuildNumber is latest plus one, floored at minimum", () => {
  assert.equal(nbn.nextBuildNumber(0), 1);
  assert.equal(nbn.nextBuildNumber(7), 8);
  assert.equal(nbn.nextBuildNumber(7, 10), 10);
});

// --- ios preflight ---

function makeIosFetch(calls, { apps, builds } = {}) {
  return async (url, options = {}) => {
    calls.push({ method: options.method || "GET", url, headers: options.headers, body: options.body });
    if (url.startsWith("https://api.appstoreconnect.apple.com/v1/apps")) {
      return jsonResponse(200, { data: apps });
    }
    if (url.startsWith("https://api.appstoreconnect.apple.com/v1/builds?")) {
      return jsonResponse(200, { data: builds });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
}

const IOS_ARGV = ["ios", "--bundle-id", "com.example", "--marketing-version", "1.2.0"];

test("ios: no builds for the marketing version -> build number 1", async () => {
  const calls = [];
  const fetchImpl = makeIosFetch(calls, {
    apps: [{ id: "APP1", attributes: { bundleId: "com.example" } }],
    builds: [],
  });
  const printed = [];
  await nbn.run({ argv: IOS_ARGV, env: ASC_ENV, fetchImpl, out: (s) => printed.push(s) });
  assert.deepEqual(JSON.parse(printed[0]), {
    app_id: "APP1",
    marketing_version: "1.2.0",
    latest_build_number: 0,
    build_number: 1,
  });
});

test("ios: builds 3, 7, 5 -> next build 8", async () => {
  const calls = [];
  const fetchImpl = makeIosFetch(calls, {
    apps: [{ id: "APP1", attributes: { bundleId: "com.example" } }],
    builds: ["3", "7", "5"].map((v) => ({ id: v, attributes: { version: v } })),
  });
  const printed = [];
  await nbn.run({ argv: IOS_ARGV, env: ASC_ENV, fetchImpl, out: (s) => printed.push(s) });
  assert.equal(JSON.parse(printed[0]).build_number, 8);
});

test("ios: builds request filters by app and marketing version", async () => {
  const calls = [];
  const fetchImpl = makeIosFetch(calls, {
    apps: [{ id: "APP1", attributes: { bundleId: "com.example" } }],
    builds: [],
  });
  await nbn.run({ argv: IOS_ARGV, env: ASC_ENV, fetchImpl, out: () => {} });
  const buildsCall = calls.find((c) => c.url.includes("/v1/builds?"));
  const params = new URLSearchParams(buildsCall.url.split("?")[1]);
  assert.equal(params.get("filter[app]"), "APP1");
  assert.equal(params.get("filter[preReleaseVersion.version]"), "1.2.0");
});

test("ios: exact bundleId match wins over a prefix match", async () => {
  const calls = [];
  const fetchImpl = makeIosFetch(calls, {
    apps: [
      { id: "WRONG", attributes: { bundleId: "com.example.extra" } },
      { id: "RIGHT", attributes: { bundleId: "com.example" } },
    ],
    builds: [{ id: "b", attributes: { version: "4" } }],
  });
  const printed = [];
  await nbn.run({ argv: IOS_ARGV, env: ASC_ENV, fetchImpl, out: (s) => printed.push(s) });
  const result = JSON.parse(printed[0]);
  assert.equal(result.app_id, "RIGHT");
  assert.equal(result.build_number, 5);
});

test("ios: minimum raises the build number above latest plus one", async () => {
  const calls = [];
  const fetchImpl = makeIosFetch(calls, {
    apps: [{ id: "APP1", attributes: { bundleId: "com.example" } }],
    builds: [{ id: "b", attributes: { version: "2" } }],
  });
  const printed = [];
  await nbn.run({
    argv: [...IOS_ARGV, "--minimum", "50"],
    env: ASC_ENV,
    fetchImpl,
    out: (s) => printed.push(s),
  });
  assert.equal(JSON.parse(printed[0]).build_number, 50);
});

test("ios: error when the marketing version has no matching app", async () => {
  const calls = [];
  const fetchImpl = makeIosFetch(calls, { apps: [], builds: [] });
  await assert.rejects(
    nbn.run({ argv: IOS_ARGV, env: ASC_ENV, fetchImpl, out: () => {} }),
    /No App Store Connect app found/,
  );
});

// --- android preflight ---

function makePlayFetch(calls, { bundles = [], tracks = [], failBundles = false } = {}) {
  return async (url, options = {}) => {
    const method = options.method || "GET";
    calls.push({ method, url, headers: options.headers, body: options.body });
    if (url === "https://oauth2.googleapis.com/token") {
      return jsonResponse(200, { access_token: "TOKEN" });
    }
    if (url.endsWith("/edits") && method === "POST") {
      return jsonResponse(200, { id: "EDIT1" });
    }
    if (url.endsWith("/edits/EDIT1/bundles")) {
      if (failBundles) {
        return jsonResponse(500, { error: { message: "backend exploded" } });
      }
      return jsonResponse(200, { bundles });
    }
    if (url.endsWith("/edits/EDIT1/tracks")) {
      return jsonResponse(200, { tracks });
    }
    if (url.endsWith("/edits/EDIT1") && method === "DELETE") {
      return jsonResponse(200, {});
    }
    throw new Error(`unexpected fetch: ${method} ${url}`);
  };
}

const ANDROID_ARGV = ["android", "--package", "com.example.app"];

test("android: highest versionCode across bundles and tracks, plus one", async () => {
  const calls = [];
  const fetchImpl = makePlayFetch(calls, {
    bundles: [{ versionCode: 10 }, { versionCode: 42 }],
    tracks: [
      { track: "internal", releases: [{ versionCodes: ["50", "9"] }] },
      { track: "production", releases: [{ versionCodes: ["30"] }] },
    ],
  });
  const printed = [];
  await nbn.run({ argv: ANDROID_ARGV, env: PLAY_ENV, fetchImpl, out: (s) => printed.push(s) });
  assert.deepEqual(JSON.parse(printed[0]), {
    package: "com.example.app",
    highest_version_code: 50,
    build_number: 51,
  });
});

test("android: track-only code counts when missing from the bundle list", async () => {
  const calls = [];
  const fetchImpl = makePlayFetch(calls, {
    bundles: [{ versionCode: 7 }],
    tracks: [{ track: "internal", releases: [{ versionCodes: ["99"] }] }],
  });
  const printed = [];
  await nbn.run({ argv: ANDROID_ARGV, env: PLAY_ENV, fetchImpl, out: (s) => printed.push(s) });
  assert.equal(JSON.parse(printed[0]).build_number, 100);
});

test("android: empty app starts at 1", async () => {
  const calls = [];
  const fetchImpl = makePlayFetch(calls, { bundles: [], tracks: [] });
  const printed = [];
  await nbn.run({ argv: ANDROID_ARGV, env: PLAY_ENV, fetchImpl, out: (s) => printed.push(s) });
  assert.deepEqual(JSON.parse(printed[0]), {
    package: "com.example.app",
    highest_version_code: 0,
    build_number: 1,
  });
});

test("android: minimum is respected", async () => {
  const calls = [];
  const fetchImpl = makePlayFetch(calls, { bundles: [{ versionCode: 3 }], tracks: [] });
  const printed = [];
  await nbn.run({
    argv: [...ANDROID_ARGV, "--minimum", "20"],
    env: PLAY_ENV,
    fetchImpl,
    out: (s) => printed.push(s),
  });
  assert.equal(JSON.parse(printed[0]).build_number, 20);
});

test("android: edit is deleted even when listing bundles fails", async () => {
  const calls = [];
  const fetchImpl = makePlayFetch(calls, { failBundles: true });
  await assert.rejects(
    nbn.run({ argv: ANDROID_ARGV, env: PLAY_ENV, fetchImpl, out: () => {} }),
    /HTTP 500/,
  );
  assert.equal(calls.at(-1).method, "DELETE");
  assert.ok(calls.at(-1).url.endsWith("/edits/EDIT1"));
});

test("android: error when SERVICE_ACCOUNT_JSON is missing", async () => {
  await assert.rejects(
    nbn.run({ argv: ANDROID_ARGV, env: {}, fetchImpl: async () => {}, out: () => {} }),
    /SERVICE_ACCOUNT_JSON/,
  );
});

// --- CLI parsing and output ---

test("parseArgs rejects a missing platform and an unknown platform", () => {
  assert.throws(() => nbn.parseArgs([]), /Unknown platform/);
  assert.throws(() => nbn.parseArgs(["windows"]), /Unknown platform/);
});

test("parseArgs names each missing ios flag separately", () => {
  assert.throws(() => nbn.parseArgs(["ios", "--bundle-id", "x"]), /Missing --marketing-version\./);
  assert.throws(() => nbn.parseArgs(["ios", "--marketing-version", "1.0.0"]), /Missing --bundle-id\./);
  assert.throws(() => nbn.parseArgs(["ios"]), /Missing --bundle-id, --marketing-version\./);
  assert.doesNotThrow(() => nbn.parseArgs(["ios", "--bundle-id", "x", "--marketing-version", "1.0.0"]));
});

test("parseArgs requires --package for android", () => {
  assert.throws(() => nbn.parseArgs(["android"]), /--package/);
});

test("parseArgs rejects unknown flags and bad minimums", () => {
  assert.throws(() => nbn.parseArgs(["android", "--package", "x", "--nope"]), /Unknown argument/);
  assert.throws(
    () => nbn.parseArgs(["android", "--package", "x", "--minimum", "abc"]),
    /--minimum/,
  );
  assert.throws(
    () => nbn.parseArgs(["android", "--package", "x", "--minimum", "0"]),
    /--minimum/,
  );
});

test("run appends build_number to $GITHUB_OUTPUT when set", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nbn-output-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const outputFile = path.join(dir, "github_output");
  const calls = [];
  const fetchImpl = makeIosFetch(calls, {
    apps: [{ id: "APP1", attributes: { bundleId: "com.example" } }],
    builds: [{ id: "b", attributes: { version: "6" } }],
  });
  await nbn.run({
    argv: IOS_ARGV,
    env: { ...ASC_ENV, GITHUB_OUTPUT: outputFile },
    fetchImpl,
    out: () => {},
  });
  assert.equal(fs.readFileSync(outputFile, "utf8"), "build_number=7\n");
});

test("run skips $GITHUB_OUTPUT when unset", async () => {
  const calls = [];
  const fetchImpl = makeIosFetch(calls, {
    apps: [{ id: "APP1", attributes: { bundleId: "com.example" } }],
    builds: [],
  });
  const printed = [];
  await nbn.run({ argv: IOS_ARGV, env: ASC_ENV, fetchImpl, out: (s) => printed.push(s) });
  assert.equal(printed.length, 1);
});

// --- secret hygiene ---

test("no request URL, header, or body leaks key material", async () => {
  const calls = [];
  const iosFetch = makeIosFetch(calls, {
    apps: [{ id: "APP1", attributes: { bundleId: "com.example" } }],
    builds: [],
  });
  await nbn.run({ argv: IOS_ARGV, env: ASC_ENV, fetchImpl: iosFetch, out: () => {} });

  const playFetch = makePlayFetch(calls, {
    bundles: [{ versionCode: 1 }],
    tracks: [],
  });
  await nbn.run({ argv: ANDROID_ARGV, env: PLAY_ENV, fetchImpl: playFetch, out: () => {} });

  for (const call of calls) {
    const headers = Object.entries(call.headers || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(" ");
    for (const haystack of [call.url, headers, call.body || ""]) {
      assert.ok(!haystack.includes("PRIVATE KEY"), `leak: ${call.url}`);
      assert.ok(!haystack.includes(ASC_PEM.trim()), `leak: ${call.url}`);
      assert.ok(!haystack.includes(RSA_PEM.trim()), `leak: ${call.url}`);
    }
    // JWT assertions and bearer tokens are signed credentials, not raw keys,
    // but the PEM body itself must never appear anywhere.
  }
});

// A fake App Store Connect that holds builds from several marketing versions and applies the
// preReleaseVersion filter the way the real API does, so results depend on the query.
function makeVersionedIosFetch(calls, builds) {
  return async (url, options = {}) => {
    calls.push({ method: options.method || "GET", url });
    if (url.startsWith("https://api.appstoreconnect.apple.com/v1/apps")) {
      return jsonResponse(200, { data: [{ id: "APP1", attributes: { bundleId: "com.example" } }] });
    }
    if (url.startsWith("https://api.appstoreconnect.apple.com/v1/builds?")) {
      const wanted = new URL(url).searchParams.get("filter[preReleaseVersion.version]");
      const matches = builds.filter((b) => !wanted || b.marketing === wanted);
      return jsonResponse(200, { data: matches.map((b) => ({ attributes: { version: b.number } })) });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
}

const TWO_VERSION_BUILDS = [
  { marketing: "0.3.1", number: "9" },
  { marketing: "0.3.1", number: "8" },
  { marketing: "0.3.2", number: "2" },
  { marketing: "0.3.2", number: "1" },
];

function iosArgv(version) {
  return ["ios", "--bundle-id", "com.example", "--marketing-version", version];
}

async function nextFor(version, builds = TWO_VERSION_BUILDS) {
  const calls = [];
  const lines = [];
  await nbn.run({
    argv: iosArgv(version),
    env: ASC_ENV,
    fetchImpl: makeVersionedIosFetch(calls, builds),
    out: (line) => lines.push(line),
  });
  return { result: JSON.parse(lines[0]), calls };
}

test("ios: a new marketing version restarts at 1 even when an older version reached build 9", async () => {
  const { result } = await nextFor("0.4.0");
  assert.equal(result.build_number, 1);
});

test("ios: the sequence follows the requested marketing version, not the highest build of any version", async () => {
  assert.equal((await nextFor("0.3.2")).result.build_number, 3);
  assert.equal((await nextFor("0.3.1")).result.build_number, 10);
});

test("ios: a prerelease and its final release share one sequence", async () => {
  const alpha = await nextFor("0.3.2-alpha.1");
  const final = await nextFor("0.3.2");
  assert.equal(alpha.result.build_number, 3);
  assert.equal(alpha.result.marketing_version, "0.3.2");
  assert.equal(final.result.build_number, 3);
  const sent = new URL(alpha.calls.find((c) => c.url.includes("/v1/builds?")).url).searchParams;
  assert.equal(sent.get("filter[preReleaseVersion.version]"), "0.3.2");
});

test("ios: a malformed marketing version is an error, not an unfiltered lookup", async () => {
  await assert.rejects(() => nextFor("latest"), /Cannot derive an iOS marketing version/);
  const client = { findApp: async () => ({ id: "APP1" }), request: async () => ({ data: [] }) };
  await assert.rejects(
    () => nbn.iosPreflight({ client, bundleId: "com.example", marketingVersion: "" }),
    /Cannot derive an iOS marketing version/,
  );
});

test("a missing --marketing-version stops the preflight before any request, with no fallback to the global max", async () => {
  const calls = [];
  const fetchImpl = makeVersionedIosFetch(calls, TWO_VERSION_BUILDS);
  await assert.rejects(
    () => nbn.run({ argv: ["ios", "--bundle-id", "com.example"], env: ASC_ENV, fetchImpl, out: () => {} }),
    /Missing --marketing-version\./,
  );
  assert.equal(calls.length, 0);
});

test("recentBuildVersions refuses a blank marketing version without sending a request", async () => {
  const calls = [];
  const client = { request: async (...args) => { calls.push(args); return { data: [] }; } };
  for (const blank of ["", undefined, null]) {
    await assert.rejects(() => nbn.recentBuildVersions(client, "APP1", blank), /recentBuildVersions needs a marketing version/);
  }
  assert.equal(calls.length, 0);
});

test("a malformed marketing version is rejected for that reason before the app is looked up", async () => {
  const calls = [];
  const fetchImpl = makeVersionedIosFetch(calls, TWO_VERSION_BUILDS);
  await assert.rejects(
    () => nbn.run({ argv: iosArgv("latest"), env: ASC_ENV, fetchImpl, out: () => {} }),
    /Cannot derive an iOS marketing version from 'latest'/,
  );
  assert.equal(calls.length, 0);
});

test("parseArgs strips a prerelease marketing version and rejects a malformed one for that reason", () => {
  const stripped = nbn.parseArgs(["ios", "--bundle-id", "x", "--marketing-version", "2.1.0-rc.1+meta"]);
  assert.equal(stripped.marketingVersion, "2.1.0");
  assert.throws(
    () => nbn.parseArgs(["ios", "--bundle-id", "x", "--marketing-version", "latest"]),
    /Cannot derive an iOS marketing version from 'latest'/,
  );
});

// A fake Play Developer API that keeps bundles and tracks per package and answers only for the package in
// the URL, so a lookup that asks about the wrong package gets the wrong (or no) data.
function makeStatefulPlayFetch(calls, apps) {
  const edits = new Map();
  return async (url, options = {}) => {
    const method = options.method || "GET";
    calls.push({ method, url });
    if (url === "https://oauth2.googleapis.com/token") {
      return jsonResponse(200, { access_token: "TOKEN" });
    }
    const match = url.match(/\/applications\/([^/]+)\/edits(?:\/([^/]+?))?(?:\/(bundles|tracks))?$/);
    if (!match) throw new Error(`unexpected fetch: ${method} ${url}`);
    const [, pkg, editId, resource] = match;
    if (!apps[pkg]) return jsonResponse(404, { error: { message: `no such package ${pkg}` } });
    if (!editId && method === "POST") {
      const id = `EDIT-${pkg}`;
      edits.set(id, pkg);
      return jsonResponse(200, { id });
    }
    if (edits.get(editId) !== pkg) return jsonResponse(404, { error: { message: "edit not found for this package" } });
    if (resource === "bundles") return jsonResponse(200, { bundles: apps[pkg].bundles });
    if (resource === "tracks") return jsonResponse(200, { tracks: apps[pkg].tracks });
    if (method === "DELETE") {
      edits.delete(editId);
      return jsonResponse(200, {});
    }
    throw new Error(`unexpected fetch: ${method} ${url}`);
  };
}

const PLAY_APPS = {
  "com.klaviyo.expoexample": {
    bundles: [{ versionCode: 41 }, { versionCode: 12 }],
    tracks: [{ track: "internal", releases: [{ versionCodes: ["40", "58"] }] }],
  },
  "com.example.decoy": {
    bundles: [{ versionCode: 900 }],
    tracks: [{ track: "internal", releases: [{ versionCodes: ["901"] }] }],
  },
};

async function androidNext(pkg, apps = PLAY_APPS) {
  const calls = [];
  const lines = [];
  await nbn.run({
    argv: ["android", "--package", pkg],
    env: PLAY_ENV,
    fetchImpl: makeStatefulPlayFetch(calls, apps),
    out: (line) => lines.push(line),
  });
  return { result: JSON.parse(lines[0]), calls };
}

test("android: the versionCode comes from the requested package, not another app's", async () => {
  const { result, calls } = await androidNext("com.klaviyo.expoexample");
  assert.equal(result.highest_version_code, 58);
  assert.equal(result.build_number, 59);
  assert.ok(calls.filter((c) => c.url.includes("/applications/")).every((c) => c.url.includes("/applications/com.klaviyo.expoexample/")));
  assert.ok(!calls.some((c) => c.url.includes("com.example.decoy")));
});

test("android: the highest versionCode is global across bundles and every track", async () => {
  const apps = { p: { bundles: [{ versionCode: 5 }], tracks: [{ track: "production", releases: [{ versionCodes: ["9"] }] }, { track: "beta", releases: [{ versionCodes: ["7"] }] }] } };
  assert.equal((await androidNext("p", apps)).result.build_number, 10);
});

test("android: an unknown package fails for that reason and the edit is not left open", async () => {
  await assert.rejects(() => androidNext("com.not.there"), /no such package com\.not\.there/);
});
