"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MISSING,
  SDK_NAMES,
  SHORT_NAMES,
  formatRef,
  sdkLine,
  buildInfoRows,
  notesHeader,
  notesText,
  slackFields,
  sha7,
} = require("../../../example/lib/build-info");

const len = (text) => Array.from(text).length;

test("MISSING is the em dash", () => {
  assert.equal(MISSING, "—");
});

test("SDK_NAMES and SHORT_NAMES cover the four SDK keys", () => {
  assert.equal(SDK_NAMES["expo-plugin"], "Klaviyo Expo Plugin");
  assert.equal(SDK_NAMES.rn, "Klaviyo RN SDK");
  assert.equal(SDK_NAMES.ios, "Klaviyo iOS SDK");
  assert.equal(SDK_NAMES.android, "Klaviyo Android SDK");
  assert.equal(SHORT_NAMES["expo-plugin"], "Expo");
  assert.equal(SHORT_NAMES.rn, "RN");
  assert.equal(SHORT_NAMES.ios, "iOS");
  assert.equal(SHORT_NAMES.android, "Android");
});

test("formatRef returns the ref as given", () => {
  assert.equal(formatRef("5.4.0", "main@abc1234"), "main@abc1234");
  assert.equal(formatRef("5.4.0", "5.4.0"), "5.4.0");
});

test("formatRef renders a missing ref as the missing marker", () => {
  assert.equal(formatRef("5.4.0", undefined), "—");
  assert.equal(formatRef("5.4.0", "  "), "—");
});

test("sha7 keeps the first 7 characters", () => {
  assert.equal(sha7("abc1234deadbeef"), "abc1234");
  assert.equal(sha7("abc1234"), "abc1234");
  assert.equal(sha7("abc"), "abc");
});

test("sha7 renders a missing sha as the missing marker", () => {
  assert.equal(sha7(undefined), "—");
  assert.equal(sha7(null), "—");
  assert.equal(sha7("   "), "—");
});

test("sdkLine omits the ref for a release (ref equals version)", () => {
  assert.equal(
    sdkLine({ key: "ios", version: "5.4.0", ref: "5.4.0" }),
    "Klaviyo iOS SDK 5.4.0",
  );
});

test("sdkLine shows branch@sha7 refs", () => {
  assert.equal(
    sdkLine({ key: "ios", version: "5.4.0", ref: "main@abc1234" }),
    "Klaviyo iOS SDK 5.4.0 · main@abc1234",
  );
});

test("sdkLine shows local dirty refs", () => {
  assert.equal(
    sdkLine({ key: "rn", version: "2.5.0", ref: "local:main@abc1234-dirty" }),
    "Klaviyo RN SDK 2.5.0 · local:main@abc1234-dirty",
  );
});

test("sdkLine omits a missing ref", () => {
  assert.equal(sdkLine({ key: "ios", version: "5.4.0" }), "Klaviyo iOS SDK 5.4.0");
  assert.equal(
    sdkLine({ key: "ios", version: "5.4.0", ref: "" }),
    "Klaviyo iOS SDK 5.4.0",
  );
});

test("sdkLine renders a missing version as the missing marker", () => {
  assert.equal(
    sdkLine({ key: "ios", ref: "main@abc1234" }),
    "Klaviyo iOS SDK — · main@abc1234",
  );
});

test("sdkLine keeps prerelease versions in full", () => {
  assert.equal(
    sdkLine({ key: "expo-plugin", version: "0.3.2-alpha.1", ref: "0.3.2-alpha.1" }),
    "Klaviyo Expo Plugin 0.3.2-alpha.1",
  );
});

test("sdkLine short form uses short names", () => {
  assert.equal(
    sdkLine({ key: "ios", version: "5.4.0", ref: "main@abc1234" }, { short: true }),
    "iOS 5.4.0 · main@abc1234",
  );
  assert.equal(
    sdkLine({ key: "ios", version: "5.4.0", ref: "5.4.0" }, { short: true }),
    "iOS 5.4.0",
  );
});

const FULL_INPUT = {
  appName: "KlaviyoExample",
  appVersion: "1.2.0",
  buildNumber: "1042",
  builtAt: "2026-10-13 14:05 UTC",
  commitSha: "abc1234deadbeef",
  branch: "main",
  sourceLabel: "push",
  event: "push",
  runUrl: "https://github.com/klaviyo/klaviyo-expo-plugin/actions/runs/123",
  releaseName: "v1.2.0",
  releaseBody: "Adds push support and fixes badges.",
  sdks: [
    { key: "expo-plugin", version: "0.3.2", ref: "0.3.2" },
    { key: "rn", version: "2.5.0", ref: "main@abc1234" },
    { key: "ios", version: "5.4.0", ref: "5.4.0" },
    { key: "android", version: "4.1.0", ref: "4.1.0" },
  ],
};

test("buildInfoRows renders a full example in order", () => {
  assert.deepEqual(buildInfoRows(FULL_INPUT), [
    { label: "App", value: "1.2.0 (1042)" },
    { label: "Klaviyo Expo Plugin", value: "0.3.2" },
    { label: "Klaviyo RN SDK", value: "2.5.0 · main@abc1234" },
    { label: "Klaviyo iOS SDK", value: "5.4.0" },
    { label: "Klaviyo Android SDK", value: "4.1.0" },
    { label: "App commit", value: "abc1234 on main" },
    { label: "Built", value: "2026-10-13 14:05 UTC" },
  ]);
});

test("buildInfoRows renders every value as the missing marker", () => {
  assert.deepEqual(buildInfoRows({}), [
    { label: "App", value: "— (—)" },
    { label: "App commit", value: "— on —" },
    { label: "Built", value: "—" },
  ]);
});

test("buildInfoRows keeps sdks in the given order", () => {
  const rows = buildInfoRows({
    sdks: [
      { key: "android", version: "4.1.0", ref: "4.1.0" },
      { key: "rn", version: "2.5.0", ref: "2.5.0" },
    ],
  });
  assert.equal(rows[1].label, "Klaviyo Android SDK");
  assert.equal(rows[2].label, "Klaviyo RN SDK");
});

test("buildInfoRows fills missing parts of composite values", () => {
  const rows = buildInfoRows({ appVersion: "1.0.0" });
  assert.equal(rows[0].value, "1.0.0 (—)");
});

test("the App row matches the header app line minus the app name", () => {
  const appRow = buildInfoRows(FULL_INPUT)[0].value;
  const firstLine = notesHeader(FULL_INPUT).split("\n")[0];
  assert.equal(firstLine, `${FULL_INPUT.appName} ${appRow}`);
});

test("notesHeader renders the full block with a CI run line", () => {
  assert.equal(
    notesHeader(FULL_INPUT),
    [
      "KlaviyoExample 1.2.0 (1042)",
      "Klaviyo Expo Plugin 0.3.2",
      "Klaviyo RN SDK 2.5.0 · main@abc1234",
      "Klaviyo iOS SDK 5.4.0",
      "Klaviyo Android SDK 4.1.0",
      "Commit: abc1234 on push (push)",
      "Built: 2026-10-13 14:05 UTC",
      "CI run: https://github.com/klaviyo/klaviyo-expo-plugin/actions/runs/123",
    ].join("\n"),
  );
});

test("notesHeader omits the CI run line when runUrl is missing", () => {
  const { runUrl, ...input } = FULL_INPUT;
  const header = notesHeader(input);
  assert.ok(!header.includes("CI run:"));
  assert.equal(header.split("\n").length, 7);
});

test("notesHeader renders a missing app name as the missing marker", () => {
  const header = notesHeader({});
  assert.ok(header.startsWith("— — (—)\n"));
});

test("notesText returns text that already fits unchanged", () => {
  const text = notesText(FULL_INPUT, 4000);
  assert.equal(text, `${notesHeader(FULL_INPUT)}\n\nRelease notes (v1.2.0):\nAdds push support and fixes badges.`);
  assert.ok(!text.includes("[truncated]"));
});

test("notesText uses a bare heading when releaseName is missing", () => {
  const { releaseName, ...input } = FULL_INPUT;
  const text = notesText(input, 4000);
  assert.ok(text.includes("\n\nRelease notes:\n"));
});

test("notesText omits the release block when the body is blank", () => {
  const text = notesText({ ...FULL_INPUT, releaseBody: "   " }, 4000);
  assert.equal(text, notesHeader(FULL_INPUT));
});

test("notesText cuts the release body first with the marker", () => {
  const input = { ...FULL_INPUT, releaseBody: "x".repeat(3000) };
  const cap = 600;
  const text = notesText(input, cap);
  assert.ok(len(text) <= cap);
  assert.ok(text.endsWith("…[truncated]"));
  assert.ok(text.startsWith(notesHeader(input)));
  assert.ok(text.includes("Release notes (v1.2.0):"));
  const body = text.split("Release notes (v1.2.0):\n")[1];
  assert.equal(body.length > 0, true);
});

test("notesText drops the CI run line before any other header line", () => {
  const input = { ...FULL_INPUT, releaseBody: undefined };
  const header = notesHeader(input);
  const cap = len(header) - 1;
  const text = notesText(input, cap);
  assert.ok(!text.includes("CI run:"));
  assert.ok(text.endsWith("…[truncated]"));
  assert.ok(text.includes("Commit: abc1234 on push (push)"));
  assert.ok(text.includes("Built: 2026-10-13 14:05 UTC"));
  assert.ok(len(text) <= cap);
});

test("notesText never cuts the app, sdk, Commit or Built lines", () => {
  const input = { ...FULL_INPUT, releaseBody: undefined };
  const text = notesText(input, 10);
  assert.ok(text.includes("KlaviyoExample 1.2.0 (1042)"));
  assert.ok(text.includes("Klaviyo iOS SDK 5.4.0"));
  assert.ok(text.includes("Commit: abc1234 on push (push)"));
  assert.ok(text.includes("Built: 2026-10-13 14:05 UTC"));
});

test("notesText fits a long release body under a 4000-char cap", () => {
  const input = { ...FULL_INPUT, releaseBody: "line\n".repeat(2000) };
  const text = notesText(input, 4000);
  assert.ok(len(text) <= 4000);
  assert.ok(text.endsWith("…[truncated]"));
});

test("notesText fits a long release body under a 500-char cap", () => {
  const input = { ...FULL_INPUT, releaseBody: "y".repeat(3000) };
  const text = notesText(input, 500);
  assert.ok(len(text) <= 500);
  assert.ok(text.endsWith("…[truncated]"));
});

test("notesText drops the whole release block when the body is cut to nothing", () => {
  const input = { ...FULL_INPUT, releaseBody: "z".repeat(5000) };
  const header = notesHeader(input);
  const cap = len(header) + 1 + len("…[truncated]");
  const text = notesText(input, cap);
  assert.ok(!text.includes("Release notes"));
  assert.equal(text, `${header}\n…[truncated]`);
  assert.ok(len(text) <= cap);
});

test("notesText counts code points, not bytes, and never splits emoji", () => {
  const emojiBody = "🚀✨🎉".repeat(500);
  const input = { ...FULL_INPUT, releaseBody: emojiBody };
  const cap = 500;
  const text = notesText(input, cap);
  assert.ok(len(text) <= cap);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    assert.ok(
      !(code >= 0xd800 && code <= 0xdbff) ||
        (text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff),
      `unpaired high surrogate at ${i}`,
    );
    assert.ok(
      !(code >= 0xdc00 && code <= 0xdfff) ||
        (text.charCodeAt(i - 1) >= 0xd800 && text.charCodeAt(i - 1) <= 0xdbff),
      `unpaired low surrogate at ${i}`,
    );
  }
});

test("slackFields renders the Slack field map", () => {
  assert.deepEqual(slackFields(FULL_INPUT, { platform: "iOS" }), {
    build: "1.2.0 (1042)",
    sdks: "Expo 0.3.2 | RN 2.5.0 · main@abc1234 | iOS 5.4.0 | Android 4.1.0",
    source: "push (push)",
    commit: "abc1234",
  });
});

test("slackFields only renders the sdks it is given", () => {
  const fields = slackFields(
    { ...FULL_INPUT, sdks: [{ key: "rn", version: "2.5.0", ref: "2.5.0" }] },
    { platform: "Android" },
  );
  assert.equal(fields.sdks, "RN 2.5.0");
});

test("slackFields renders missing values as the missing marker", () => {
  const fields = slackFields({}, { platform: "iOS" });
  assert.equal(fields.build, "— (—)");
  assert.equal(fields.sdks, "");
  assert.equal(fields.source, "— (—)");
  assert.equal(fields.commit, "—");
});

const cutBase = {
  appName: "Expo Example",
  appVersion: "1.0.0",
  buildNumber: "7",
  builtAt: "2026-01-02 03:04 UTC",
  commitSha: "abc1234def",
  sourceLabel: "main",
  event: "push",
  runUrl: "https://example.test/run/1",
  sdks: [
    { key: "expo-plugin", version: "1.0.0", ref: "main@abc1234" },
    { key: "ios", version: "5.4.0" },
  ],
  releaseName: "v1",
  releaseBody: "B".repeat(300),
};

test("notesText marks a release body that was cut away entirely", () => {
  const lib = require("../../../example/lib/build-info.js");
  const header = lib.notesHeader(cutBase);
  const headerLength = Array.from(header).length;
  for (const cap of [headerLength + 5, headerLength]) {
    const text = lib.notesText(cutBase, cap);
    assert.ok(text.includes("…[truncated]"), `cap ${cap}`);
    assert.ok(!text.includes("Release notes"), `cap ${cap}`);
  }
});

test("notesText never cuts the app, SDK, Commit or Built lines", () => {
  const lib = require("../../../example/lib/build-info.js");
  const text = lib.notesText(cutBase, 50);
  for (const needle of [
    "Expo Example 1.0.0 (7)",
    "Klaviyo Expo Plugin 1.0.0 · main@abc1234",
    "Klaviyo iOS SDK 5.4.0",
    "Commit: abc1234 on main (push)",
    "Built: 2026-01-02 03:04 UTC",
  ]) {
    assert.ok(text.includes(needle), needle);
  }
  assert.ok(text.includes("…[truncated]"));
});

test("notesText drops the CI run line before any other header line", () => {
  const lib = require("../../../example/lib/build-info.js");
  const noBody = { ...cutBase, releaseBody: undefined };
  const header = lib.notesHeader(noBody);
  const text = lib.notesText(noBody, Array.from(header).length - 3);
  assert.ok(!text.includes("CI run:"));
  assert.ok(text.includes("Built:"));
  assert.ok(text.includes("…[truncated]"));
});

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { run: renderRun, withBuildInfo } = require("../render-build-info.js");

function writeInfo(info) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "build-info-")), "build-info.json");
  fs.writeFileSync(file, JSON.stringify(info));
  return file;
}

const renderEnv = {
  SDK_DIR: "/nonexistent",
  APP_VERSION: "9.9.9",
  BUILD_NUMBER: "1",
  BUILD_DATE: "1999-01-01 00:00 UTC",
  COMMIT_SHA: "0000000aaaa",
  BRANCH: "wrong-branch",
  SOURCE_LABEL: "feat/x",
  GITHUB_EVENT_NAME: "push",
  RUN_URL: "https://example.test/run/1",
};

test("notes read the stamped values from the build info file, not the environment", () => {
  const file = writeInfo({
    commitSha: "abc1234",
    branch: "feat/x",
    builtAt: "2026-01-02 03:04 UTC",
    releaseTag: "",
    buildNumber: "21",
    appVersion: "1.0.0",
  });
  const text = renderRun(["notes", "--platform", "ios", "--max-chars", "4000"], {
    ...renderEnv,
    BUILD_INFO_FILE: file,
  });
  assert.match(text, /^Expo Example 1\.0\.0 \(21\)\n/);
  assert.ok(text.includes("Commit: abc1234 on feat/x (push)"));
  assert.ok(text.includes("Built: 2026-01-02 03:04 UTC"));
  assert.ok(text.includes("Klaviyo Expo Plugin 1.0.0 · feat/x@abc1234"));
  assert.ok(!text.includes("9.9.9") && !text.includes("1999") && !text.includes("wrong-branch"));
});

test("a retry that changes the number shows the new number in the notes and Slack fields", () => {
  const first = writeInfo({ commitSha: "abc1234", branch: "main", builtAt: "2026-01-02 03:04 UTC", buildNumber: "10", appVersion: "1.0.0" });
  const final = writeInfo({ commitSha: "abc1234", branch: "main", builtAt: "2026-01-02 03:09 UTC", buildNumber: "21", appVersion: "1.0.0" });
  const args = ["notes", "--platform", "ios", "--max-chars", "4000"];
  assert.match(renderRun(args, { ...renderEnv, BUILD_INFO_FILE: first }), /\(10\)/);
  const notes = renderRun(args, { ...renderEnv, BUILD_INFO_FILE: final });
  assert.match(notes, /\(21\)/);
  assert.ok(!notes.includes("(10)"));
  const slack = JSON.parse(renderRun(["slack", "--platform", "ios"], { ...renderEnv, BUILD_INFO_FILE: final }));
  assert.equal(slack.build, "1.0.0 (21)");
});

test("without a build info file the environment is used", () => {
  const env = { ...renderEnv };
  assert.equal(withBuildInfo(env), env);
});

test("a release tag in the build info makes the plugin ref the bare version", () => {
  const file = writeInfo({ commitSha: "abc1234", branch: "main", builtAt: "2026-01-02 03:04 UTC", releaseTag: "v1.0.0", buildNumber: "3", appVersion: "1.0.0" });
  const text = renderRun(["notes", "--platform", "android", "--max-chars", "500"], { ...renderEnv, BUILD_INFO_FILE: file });
  assert.ok(text.includes("Klaviyo Expo Plugin 1.0.0\n"));
});

test("the in-app Copy text is the notes header without the CI run line", () => {
  const lib = require("../../../example/lib/build-info.js");
  const input = {
    appName: "Expo Example",
    appVersion: "1.0.0",
    buildNumber: "21",
    builtAt: "2026-01-02 03:04 UTC",
    commitSha: "abc1234def",
    sourceLabel: "feat/x",
    event: "push",
    runUrl: "https://example.test/run/1",
    sdks: [
      { key: "expo-plugin", version: "1.0.0", ref: "feat/x@abc1234" },
      { key: "rn", version: "2.5.0" },
      { key: "ios", version: "5.4.0" },
    ],
  };
  const notes = lib.notesHeader(input);
  const copied = lib.copyText({ ...input, runUrl: undefined });
  assert.equal(copied, notes.split("\n").filter((line) => !line.startsWith("CI run: ")).join("\n"));
  assert.ok(!copied.includes("CI run:"));
});
