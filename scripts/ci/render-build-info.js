#!/usr/bin/env node

/*
 * Renders the build info shown in the store release notes and in Slack from
 * the same formatter the app uses (example/lib/build-info.js).
 *
 * Usage:
 *   node scripts/ci/render-build-info.js notes --platform ios|android --max-chars N
 *   node scripts/ci/render-build-info.js slack --platform ios|android
 *
 * `notes` prints the notes text. `slack` prints one JSON object with the
 * fields the Slack message needs: build, sdks, source, commit.
 *
 * Env (all optional; a missing value renders as a dash):
 *   APP_NAME, APP_VERSION, BUILD_NUMBER, BUILD_DATE
 *   COMMIT_SHA, BRANCH, SOURCE_LABEL, GITHUB_EVENT_NAME, RUN_URL
 *   RELEASE_NAME, RELEASE_BODY
 *   RELEASE_TAG          set on `release: published`; the plugin ref is then the bare version
 *   SDK_DIR              klaviyo-react-native-sdk location (defaults to the example's install)
 *   BUILD_INFO_FILE      JSON the build was stamped with (see eas-deploy.sh). When it exists its
 *                        commitSha, branch, builtAt, releaseTag, buildNumber and appVersion win over
 *                        the matching variables above, so the notes match the app.
 *
 * The SDKs listed are the ones compiled into that platform's binary: the
 * plugin, the React Native SDK, and the native SDK for the platform.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const format = require("../../example/lib/build-info.js");

const ROOT = path.resolve(__dirname, "..", "..");
const NATIVE_KEY = { ios: "ios", android: "android" };

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = { command, platform: "", maxChars: undefined };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const value = () => {
      i += 1;
      if (rest[i] === undefined) throw new Error(`${arg} needs a value`);
      return rest[i];
    };
    if (arg === "--platform") opts.platform = value();
    else if (arg === "--max-chars") opts.maxChars = parseInt(value(), 10);
    else throw new Error(`Unknown argument ${arg}`);
  }
  if (command !== "notes" && command !== "slack") {
    throw new Error("Usage: render-build-info.js notes|slack --platform ios|android [--max-chars N]");
  }
  if (!NATIVE_KEY[opts.platform]) {
    throw new Error("--platform must be ios or android");
  }
  if (command === "notes" && !(opts.maxChars > 0)) {
    throw new Error("notes needs --max-chars with a positive number");
  }
  return opts;
}

function readFileOrUndefined(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

function matchOrUndefined(text, pattern) {
  const match = text === undefined ? null : text.match(pattern);
  return match ? match[1] : undefined;
}

// Version of the klaviyo-react-native-sdk the example installed, from its lockfile entry.
function readRnSdkVersion() {
  try {
    const lock = JSON.parse(readFileOrUndefined(path.join(ROOT, "example", "package-lock.json")));
    return (lock.packages["node_modules/klaviyo-react-native-sdk"] || {}).version;
  } catch {
    return undefined;
  }
}

function sdkEntries(platform, env) {
  const sdkDir = env.SDK_DIR || path.join(ROOT, "example", "node_modules", "klaviyo-react-native-sdk");
  const pluginVersion = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
  const sha = (env.COMMIT_SHA || "").slice(0, 7);
  const branch = env.BRANCH || "";
  const pluginRef = env.RELEASE_TAG ? pluginVersion : sha ? `${branch || "—"}@${sha}` : undefined;

  const native =
    platform === "ios"
      ? matchOrUndefined(
          readFileOrUndefined(path.join(sdkDir, "klaviyo-react-native-sdk.podspec")),
          /s\.dependency\s+"KlaviyoSwift",\s*"([^"]+)"/,
        )
      : matchOrUndefined(
          readFileOrUndefined(path.join(sdkDir, "android", "gradle.properties")),
          /klaviyoAndroidSdkVersion=(\S+)/,
        );

  return [
    { key: "expo-plugin", version: pluginVersion, ref: pluginRef },
    { key: "rn", version: readRnSdkVersion() },
    { key: NATIVE_KEY[platform], version: native },
  ];
}

// Overlays the values the build was stamped with, so notes cannot drift from the app.
function withBuildInfo(env) {
  const file = env.BUILD_INFO_FILE;
  const text = file ? readFileOrUndefined(file) : undefined;
  if (text === undefined) return env;
  const info = JSON.parse(text);
  const pick = (value, fallback) => (value === undefined || value === "" ? fallback : value);
  return {
    ...env,
    COMMIT_SHA: pick(info.commitSha, env.COMMIT_SHA),
    BRANCH: pick(info.branch, env.BRANCH),
    BUILD_DATE: pick(info.builtAt, env.BUILD_DATE),
    RELEASE_TAG: pick(info.releaseTag, env.RELEASE_TAG),
    BUILD_NUMBER: pick(info.buildNumber, env.BUILD_NUMBER),
    APP_VERSION: pick(info.appVersion, env.APP_VERSION),
    SOURCE_LABEL: pick(info.sourceLabel, env.SOURCE_LABEL),
    GITHUB_EVENT_NAME: pick(info.event, env.GITHUB_EVENT_NAME),
  };
}

function buildInput(platform, env) {
  return {
    appName: env.APP_NAME || "Expo Example",
    appVersion: env.APP_VERSION,
    buildNumber: env.BUILD_NUMBER,
    builtAt: env.BUILD_DATE,
    commitSha: env.COMMIT_SHA,
    branch: env.BRANCH,
    sourceLabel: env.SOURCE_LABEL,
    event: env.GITHUB_EVENT_NAME,
    runUrl: env.RUN_URL,
    releaseName: env.RELEASE_NAME,
    releaseBody: env.GITHUB_EVENT_NAME === "release" ? env.RELEASE_BODY : undefined,
    sdks: sdkEntries(platform, env),
  };
}

function run(argv, rawEnv) {
  const opts = parseArgs(argv);
  const env = withBuildInfo(rawEnv);
  const input = buildInput(opts.platform, env);
  if (opts.command === "notes") {
    return format.notesText(input, opts.maxChars);
  }
  return JSON.stringify(format.slackFields(input, { platform: opts.platform }));
}

module.exports = { parseArgs, buildInput, sdkEntries, withBuildInfo, run };

if (require.main === module) {
  try {
    process.stdout.write(`${run(process.argv.slice(2), process.env)}\n`);
  } catch (err) {
    process.stderr.write(`::error::${err.message}\n`);
    process.exit(1);
  }
}
