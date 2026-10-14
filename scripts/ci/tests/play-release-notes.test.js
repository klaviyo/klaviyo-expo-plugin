const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const play = require("../play-release-notes.js");

const { privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const RSA_PEM = privateKey.export({ type: "pkcs8", format: "pem" });

test("truncateNotes caps at 500 code points, emoji at boundary stays whole", () => {
  const text = "a".repeat(499) + "\u{1F600}" + "tail";
  const out = play.truncateNotes(text, 500);
  assert.equal([...out].length, 500);
  assert.ok(out.endsWith("\u{1F600}"));
  assert.equal(play.truncateNotes("short", 500), "short");
});

test("applyReleaseNotes sets notes on the matching release", () => {
  const releases = [
    { versionCodes: ["1"], status: "completed" },
    { versionCodes: ["2", "3"], status: "completed" },
  ];
  const updated = play.applyReleaseNotes(releases, "3", "notes");
  assert.equal(updated.length, 2);
  assert.deepEqual(updated[0], releases[0]);
  assert.deepEqual(updated[1].releaseNotes, [
    { language: "en-US", text: "notes" },
  ]);
});

test("applyReleaseNotes throws a clear error when no release matches", () => {
  assert.throws(
    () => play.applyReleaseNotes([{ versionCodes: ["1"] }], "99", "n"),
    /versionCode 99/,
  );
});

test("applyReleaseNotes does not mutate the input", () => {
  const releases = [{ versionCodes: ["7"], status: "inProgress" }];
  const snapshot = JSON.parse(JSON.stringify(releases));
  play.applyReleaseNotes(releases, "7", "n", "v1");
  assert.deepEqual(releases, snapshot);
});

test("applyReleaseNotes sets the release name only when provided", () => {
  const releases = [{ versionCodes: ["7"] }];
  const withName = play.applyReleaseNotes(releases, "7", "n", "October");
  assert.equal(withName[0].name, "October");
  const withoutName = play.applyReleaseNotes(releases, "7", "n", "");
  assert.ok(!("name" in withoutName[0]));
});

const ENV = {
  SERVICE_ACCOUNT_JSON: JSON.stringify({
    client_email: "ci@example.iam.gserviceaccount.com",
    private_key: RSA_PEM,
    token_uri: "https://oauth2.googleapis.com/token",
  }),
};

function withNotesFile(t, contents = "New stuff in this build") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "play-notes-"));
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

function makeFakeFetch(calls, { failPut = false } = {}) {
  return async (url, options = {}) => {
    const method = options.method || "GET";
    calls.push({ method, url, body: options.body, signal: options.signal });
    if (url === "https://oauth2.googleapis.com/token") {
      return jsonResponse(200, { access_token: "TOKEN" });
    }
    if (url.endsWith("/edits") && method === "POST") {
      return jsonResponse(200, { id: "EDIT1" });
    }
    if (url.endsWith("/tracks/internal") && method === "GET") {
      return jsonResponse(200, {
        track: "internal",
        releases: [{ versionCodes: ["41", "42"], status: "completed" }],
      });
    }
    if (url.endsWith("/tracks/internal") && method === "PUT") {
      if (failPut) return jsonResponse(400, { error: { message: "bad track" } });
      return jsonResponse(200, {});
    }
    if (url.endsWith(":commit") && method === "POST") {
      return jsonResponse(200, {});
    }
    if (url.endsWith("/edits/EDIT1") && method === "DELETE") {
      return jsonResponse(200, {});
    }
    throw new Error(`unexpected fetch: ${method} ${url}`);
  };
}

test("run calls token, create edit, GET track, PUT track, commit in order", async (t) => {
  const calls = [];
  await play.run({
    argv: ["42", withNotesFile(t)],
    env: ENV,
    fetchImpl: makeFakeFetch(calls),
  });
  assert.equal(calls.length, 5);
  assert.match(calls[0].url, /oauth2\.googleapis\.com\/token/);
  assert.deepEqual(
    calls.slice(1).map((c) => `${c.method} ${c.url.split("/edits/")[1] || c.url.split("/").pop()}`),
    [
      "POST edits",
      "GET EDIT1/tracks/internal",
      "PUT EDIT1/tracks/internal",
      "POST EDIT1:commit",
    ],
  );
  const putBody = JSON.parse(calls[3].body);
  assert.equal(putBody.releases[0].releaseNotes[0].text, "New stuff in this build");
  assert.equal(putBody.releases[0].releaseNotes[0].language, "en-US");
  assert.ok(!("name" in putBody.releases[0]));
});

test("run writes PLAY_RELEASE_NAME to the release when set", async (t) => {
  const calls = [];
  await play.run({
    argv: ["42", withNotesFile(t)],
    env: { ...ENV, PLAY_RELEASE_NAME: "October 2026" },
    fetchImpl: makeFakeFetch(calls),
  });
  const putBody = JSON.parse(calls[3].body);
  assert.equal(putBody.releases[0].name, "October 2026");
});

test("run deletes the edit when the PUT fails", async (t) => {
  const calls = [];
  await assert.rejects(
    play.run({
      argv: ["42", withNotesFile(t)],
      env: ENV,
      fetchImpl: makeFakeFetch(calls, { failPut: true }),
    }),
    /HTTP 400/,
  );
  assert.equal(calls.at(-1).method, "DELETE");
  assert.ok(calls.at(-1).url.endsWith("/edits/EDIT1"));
  assert.ok(!calls.some((c) => c.url.endsWith(":commit")));
});

test("run errors when SERVICE_ACCOUNT_JSON is missing", async (t) => {
  await assert.rejects(
    play.run({ argv: ["42", withNotesFile(t)], env: {}, fetchImpl: async () => {} }),
    /SERVICE_ACCOUNT_JSON/,
  );
});

test("every Google request carries a timeout signal", async (t) => {
  const calls = [];
  await play.run({ argv: ["42", withNotesFile(t)], env: ENV, fetchImpl: makeFakeFetch(calls) });
  assert.ok(calls.length > 0);
  for (const call of calls) {
    assert.ok(call.signal instanceof AbortSignal, `${call.method} ${call.url} has no timeout signal`);
  }
});
