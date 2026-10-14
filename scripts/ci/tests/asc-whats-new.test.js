const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const asc = require("../asc-whats-new.js");

const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
const PEM = privateKey.export({ type: "pkcs8", format: "pem" });

function b64urlDecode(segment) {
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf8");
}

test("normalizePrivateKey accepts raw PEM, escaped PEM, and base64 PEM", () => {
  const escaped = PEM.trim().replace(/\n/g, "\\n");
  const b64 = Buffer.from(PEM, "utf8").toString("base64");
  for (const raw of [PEM, escaped, b64]) {
    assert.equal(asc.normalizePrivateKey(raw).trim(), PEM.trim());
  }
});

test("normalizePrivateKey rejects junk", () => {
  assert.throws(() => asc.normalizePrivateKey("not a key"), /PEM/);
  // base64-decodes fine but still is not a key
  assert.throws(
    () => asc.normalizePrivateKey(Buffer.from("hello").toString("base64")),
    /PEM/,
  );
});

test("makeToken header, payload, and ES256 signature", () => {
  const token = asc.makeToken("KEYID", "ISSUER", PEM, 1000);
  const [h, p, s] = token.split(".");
  assert.deepEqual(JSON.parse(b64urlDecode(h)), {
    alg: "ES256",
    kid: "KEYID",
    typ: "JWT",
  });
  assert.deepEqual(JSON.parse(b64urlDecode(p)), {
    iss: "ISSUER",
    iat: 1000,
    exp: 1900,
    aud: "appstoreconnect-v1",
  });
  const signature = Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  assert.ok(
    crypto.verify(
      "sha256",
      `${h}.${p}`,
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      signature,
    ),
  );
});

test("truncate counts code points so an emoji at the boundary stays whole", () => {
  const text = "a".repeat(3999) + "\u{1F600}" + "tail";
  const out = asc.truncate(text, 4000);
  assert.equal([...out].length, 4000);
  assert.ok(out.endsWith("\u{1F600}"));
});

test("parseArgs parses flags and defaults", () => {
  const opts = asc.parseArgs([
    "--bundle-id", "com.example",
    "--marketing-version", "1.0",
    "--build-number", "42",
    "--notes-file", "notes.txt",
  ]);
  assert.equal(opts.bundleId, "com.example");
  assert.equal(opts.timeout, 2700);
  assert.equal(opts.pollInterval, 30);
  assert.equal(opts.dryRun, false);
});

test("parseArgs rejects unknown flags and missing required values", () => {
  assert.throws(() => asc.parseArgs(["--nope"]));
  assert.throws(() => asc.parseArgs(["--bundle-id", "x"]));
});

const ENV = {
  APP_STORE_CONNECT_API_KEY_KEY_ID: "KEYID",
  APP_STORE_CONNECT_API_KEY_ISSUER_ID: "ISSUER",
  APP_STORE_CONNECT_API_KEY_KEY: PEM,
};

const ARGV = [
  "--bundle-id", "com.example",
  "--marketing-version", "1.2.0",
  "--build-number", "7",
  "--notes-file", "NOTES",
];

function withNotesFile(t, contents = "Some release notes") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "asc-notes-"));
  const file = path.join(dir, "notes.txt");
  fs.writeFileSync(file, contents);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return file;
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  };
}

function makeFakeFetch(calls, { buildStates = ["VALID"], localizations = [] } = {}) {
  let polls = 0;
  return async (url, options = {}) => {
    const method = options.method || "GET";
    calls.push({ method, url, headers: options.headers, body: options.body });
    if (url.startsWith("https://api.appstoreconnect.apple.com/v1/apps")) {
      return jsonResponse(200, {
        data: [{ id: "APP1", attributes: { bundleId: "com.example" } }],
      });
    }
    if (url.startsWith("https://api.appstoreconnect.apple.com/v1/builds?")) {
      const state = buildStates[Math.min(polls, buildStates.length - 1)];
      polls++;
      return jsonResponse(200, {
        data: [{ id: "BUILD1", attributes: { processingState: state } }],
      });
    }
    if (url.includes("/betaBuildLocalizations") && method === "GET") {
      return jsonResponse(200, { data: localizations });
    }
    if (method === "PATCH" || method === "POST") {
      return jsonResponse(200, {});
    }
    throw new Error(`unexpected fetch: ${method} ${url}`);
  };
}

function runArgs(notesFile, extraArgv = []) {
  return {
    argv: ARGV.map((a) => (a === "NOTES" ? notesFile : a)).concat(extraArgv),
    env: ENV,
    sleep: async () => {},
    now: () => 1_000_000,
  };
}

test("run patches every existing localization once the build is VALID", async (t) => {
  const calls = [];
  const fetchImpl = makeFakeFetch(calls, {
    buildStates: ["PROCESSING", "VALID"],
    localizations: [
      { id: "L1", attributes: { locale: "en-US" } },
      { id: "L2", attributes: { locale: "fr-FR" } },
    ],
  });
  await asc.run({
    ...runArgs(withNotesFile(t)),
    fetchImpl,
  });
  const patches = calls.filter((c) => c.method === "PATCH");
  assert.equal(patches.length, 2);
  assert.ok(patches[0].url.endsWith("/v1/betaBuildLocalizations/L1"));
  assert.deepEqual(JSON.parse(patches[0].body).data.attributes, {
    whatsNew: "Some release notes",
  });
  assert.ok(patches[1].url.endsWith("/v1/betaBuildLocalizations/L2"));
  assert.equal(calls.filter((c) => c.method === "POST").length, 0);
});

test("run posts an en-US localization when none exist", async (t) => {
  const calls = [];
  const fetchImpl = makeFakeFetch(calls, { localizations: [] });
  await asc.run({ ...runArgs(withNotesFile(t)), fetchImpl });
  const posts = calls.filter((c) => c.method === "POST");
  assert.equal(posts.length, 1);
  assert.ok(posts[0].url.endsWith("/v1/betaBuildLocalizations"));
  const body = JSON.parse(posts[0].body);
  assert.equal(body.data.attributes.locale, "en-US");
  assert.equal(body.data.attributes.whatsNew, "Some release notes");
  assert.deepEqual(body.data.relationships.build.data, {
    type: "builds",
    id: "BUILD1",
  });
});

test("run throws when the build is still PROCESSING at the timeout", async (t) => {
  const calls = [];
  const fetchImpl = makeFakeFetch(calls, {
    buildStates: ["PROCESSING"],
  });
  let clock = 0;
  await assert.rejects(
    asc.run({
      argv: ARGV.map((a) => (a === "NOTES" ? withNotesFile(t) : a)).concat([
        "--timeout", "60",
      ]),
      env: ENV,
      fetchImpl,
      sleep: async () => {
        clock += 30_000;
      },
      now: () => clock,
    }),
    /Timed out after 60s/,
  );
});

test("run throws when the build processing fails", async (t) => {
  const calls = [];
  const fetchImpl = makeFakeFetch(calls, { buildStates: ["INVALID"] });
  await assert.rejects(
    asc.run({ ...runArgs(withNotesFile(t)), fetchImpl }),
    /INVALID/,
  );
});

test("dry run reads localizations but writes nothing", async (t) => {
  const calls = [];
  const fetchImpl = makeFakeFetch(calls, {
    localizations: [{ id: "L1", attributes: { locale: "en-US" } }],
  });
  await asc.run({
    ...runArgs(withNotesFile(t), ["--dry-run"]),
    fetchImpl,
  });
  assert.equal(calls.filter((c) => c.method === "PATCH").length, 0);
  assert.equal(calls.filter((c) => c.method === "POST").length, 0);
});

test("run fails with a clear error when an env var is missing", async (t) => {
  const env = { ...ENV };
  delete env.APP_STORE_CONNECT_API_KEY_KEY_ID;
  await assert.rejects(
    asc.run({ ...runArgs(withNotesFile(t)), env, fetchImpl: async () => {
      throw new Error("should not fetch");
    } }),
    /APP_STORE_CONNECT_API_KEY_KEY_ID/,
  );
});

test("no request body or header leaks the private key", async (t) => {
  const calls = [];
  const fetchImpl = makeFakeFetch(calls, {
    localizations: [{ id: "L1", attributes: { locale: "en-US" } }],
  });
  await asc.run({ ...runArgs(withNotesFile(t)), fetchImpl });
  for (const call of calls) {
    const headerValues = Object.values(call.headers || {}).join(" ");
    assert.ok(!headerValues.includes("PRIVATE KEY"), `header leak in ${call.url}`);
    assert.ok(!(call.body || "").includes("PRIVATE KEY"), `body leak in ${call.url}`);
    assert.ok(!call.url.includes("PRIVATE KEY"));
  }
});

// A fake App Store Connect that holds builds from several marketing versions and applies whichever
// filters the query carries, newest build last, as the real API lists older builds first here.
function makeVersionedFetch(calls, builds) {
  return async (url, options = {}) => {
    const method = options.method || "GET";
    calls.push({ method, url, body: options.body });
    if (url.startsWith("https://api.appstoreconnect.apple.com/v1/apps")) {
      return jsonResponse(200, { data: [{ id: "APP1", attributes: { bundleId: "com.example" } }] });
    }
    if (url.startsWith("https://api.appstoreconnect.apple.com/v1/builds?")) {
      const query = new URL(url).searchParams;
      const matches = builds.filter(
        (b) =>
          (!query.get("filter[app]") || query.get("filter[app]") === "APP1") &&
          (!query.get("filter[version]") || query.get("filter[version]") === b.number) &&
          (!query.get("filter[preReleaseVersion.version]") ||
            query.get("filter[preReleaseVersion.version]") === b.marketing),
      );
      const limit = Number(query.get("limit") || matches.length);
      return jsonResponse(200, {
        data: matches.slice(0, limit).map((b) => ({ id: b.id, attributes: { processingState: "VALID" } })),
      });
    }
    if (url.includes("/betaBuildLocalizations") && method === "GET") {
      return jsonResponse(200, { data: [] });
    }
    if (method === "PATCH" || method === "POST") {
      return jsonResponse(200, {});
    }
    throw new Error(`unexpected fetch: ${method} ${url}`);
  };
}

const SHARED_NUMBER_BUILDS = [
  { id: "OLD-0.3.1-b7", marketing: "0.3.1", number: "7" },
  { id: "NEW-0.3.2-b7", marketing: "0.3.2", number: "7" },
];

test("notes go to the build of the right marketing version when two versions share a build number", async (t) => {
  const calls = [];
  const fetchImpl = makeVersionedFetch(calls, SHARED_NUMBER_BUILDS);
  const notes = withNotesFile(t);
  const argv = ARGV.map((a) => (a === "NOTES" ? notes : a === "1.2.0" ? "0.3.2" : a));
  await asc.run({ argv, env: ENV, fetchImpl, sleep: async () => {}, now: () => 1_000_000 });
  const writes = calls.filter((c) => c.method === "POST" || c.method === "PATCH");
  assert.equal(writes.length, 1);
  assert.match(writes[0].body, /NEW-0\.3\.2-b7/);
  assert.ok(!calls.some((c) => c.url.includes("OLD-0.3.1-b7")));
});

test("the fake lists the older build first when the version filter is dropped", async () => {
  const calls = [];
  const fetchImpl = makeVersionedFetch(calls, SHARED_NUMBER_BUILDS);
  const resp = await fetchImpl("https://api.appstoreconnect.apple.com/v1/builds?filter[app]=APP1&filter[version]=7&limit=1");
  const body = JSON.parse(await resp.text());
  assert.equal(body.data[0].id, "OLD-0.3.1-b7");
});

test("the build lookup sends the app, the marketing version and the build number", async (t) => {
  const calls = [];
  const fetchImpl = makeVersionedFetch(calls, SHARED_NUMBER_BUILDS);
  const notes = withNotesFile(t);
  const argv = ARGV.map((a) => (a === "NOTES" ? notes : a === "1.2.0" ? "0.3.2" : a));
  await asc.run({ argv, env: ENV, fetchImpl, sleep: async () => {}, now: () => 1_000_000 });
  const lookup = new URL(calls.find((c) => c.url.includes("/v1/builds?")).url).searchParams;
  assert.equal(lookup.get("filter[app]"), "APP1");
  assert.equal(lookup.get("filter[preReleaseVersion.version]"), "0.3.2");
  assert.equal(lookup.get("filter[version]"), "7");
});

test("a prerelease marketing version is stripped before the lookup", async (t) => {
  const calls = [];
  const fetchImpl = makeVersionedFetch(calls, SHARED_NUMBER_BUILDS);
  const notes = withNotesFile(t);
  const argv = ARGV.map((a) => (a === "NOTES" ? notes : a === "1.2.0" ? "0.3.2-alpha.1" : a));
  await asc.run({ argv, env: ENV, fetchImpl, sleep: async () => {}, now: () => 1_000_000 });
  const lookup = new URL(calls.find((c) => c.url.includes("/v1/builds?")).url).searchParams;
  assert.equal(lookup.get("filter[preReleaseVersion.version]"), "0.3.2");
});

test("a missing or malformed marketing version is an error, never a lookup by build number alone", async (t) => {
  const notes = withNotesFile(t);
  assert.throws(
    () => asc.parseArgs(["--bundle-id", "com.example", "--build-number", "7", "--notes-file", notes]),
    /Usage/,
  );
  assert.throws(
    () => asc.parseArgs(["--bundle-id", "com.example", "--marketing-version", "latest", "--build-number", "7", "--notes-file", notes]),
    /Cannot derive an iOS marketing version/,
  );
  const client = new asc.AscClient("K", "I", "KEY", async () => jsonResponse(200, { data: [] }), () => 0);
  await assert.rejects(() => client.findBuild("APP1", "", "7"), /needs a marketing version/);
});
