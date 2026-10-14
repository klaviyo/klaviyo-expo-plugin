#!/usr/bin/env node

/*
 * Derives the iOS marketing version (CFBundleShortVersionString) from a
 * plugin version that may carry a prerelease suffix or build metadata.
 *
 * App Store Connect accepts only numeric versions, so `1.2.3-rc.1+meta`
 * becomes `1.2.3`. A prerelease and its final release then share one
 * marketing version, and with it one build number sequence.
 *
 * Usage: node scripts/ci/marketing-version.js <version>
 * Prints the numeric version. Exits 1 with ::error:: when the version does not
 * start with one to three dot-separated integers.
 */

const NUMERIC_VERSION = /^\d+(\.\d+){0,2}$/;

// Drops the `-prerelease` and `+metadata` parts, then checks what is left.
function marketingVersion(version) {
  if (typeof version !== "string") {
    throw new Error(`Version must be a string, got ${typeof version}`);
  }
  const numeric = version.trim().split(/[-+]/)[0];
  if (!NUMERIC_VERSION.test(numeric)) {
    throw new Error(
      `Cannot derive an iOS marketing version from '${version}': expected X, X.Y or X.Y.Z, optionally followed by -prerelease or +metadata`,
    );
  }
  return numeric;
}

module.exports = { marketingVersion };

if (require.main === module) {
  try {
    const input = process.argv[2];
    if (!input) {
      throw new Error("Usage: node scripts/ci/marketing-version.js <version>");
    }
    process.stdout.write(`${marketingVersion(input)}\n`);
  } catch (err) {
    process.stderr.write(`::error::${err.message}\n`);
    process.exit(1);
  }
}
