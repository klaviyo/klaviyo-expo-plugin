#!/usr/bin/env bash
# Writes the store release notes for an example app deploy to the file given
# as $1 and prints them. Every deploy's notes start with the plugin and SDK
# versions, the commit, and the build date so testers can tell builds apart.
# On `release: published` the GitHub release body follows that line; on other
# triggers the notes are synthesized from git metadata alone.
#
# Reads: GITHUB_EVENT_NAME, GITHUB_REF_NAME, GITHUB_SHA, RELEASE_BODY (optional)
set -euo pipefail

OUT_FILE="${1:?usage: release-notes.sh <output-file>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

PLUGIN_VERSION=$(node -p "require('${ROOT}/package.json').version")
# Resolved version from the lockfile, falling back to the declared range.
RN_SDK_VERSION=$(node -p "
  const lock = require('${ROOT}/example/package-lock.json');
  const pkg = require('${ROOT}/example/package.json');
  (lock.packages['node_modules/klaviyo-react-native-sdk'] || {}).version
    || pkg.dependencies['klaviyo-react-native-sdk']
")
SHA="${GITHUB_SHA:-$(git -C "$ROOT" rev-parse HEAD)}"
SHORT_SHA="${SHA:0:7}"
REF="${GITHUB_REF_NAME:-$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)}"
BUILD_DATE=$(date -u +'%Y-%m-%d %H:%M UTC')

META="klaviyo-expo-plugin ${PLUGIN_VERSION}, klaviyo-react-native-sdk ${RN_SDK_VERSION}. Commit ${SHORT_SHA}, built ${BUILD_DATE}."

if [[ "${GITHUB_EVENT_NAME:-}" == "release" && -n "${RELEASE_BODY:-}" ]]; then
  printf '%s\n\n%s\n' "$META" "$RELEASE_BODY" > "$OUT_FILE"
else
  printf 'Automatic build from %s @ %s, built %s.\nklaviyo-expo-plugin %s, klaviyo-react-native-sdk %s.\n' \
    "$REF" "$SHORT_SHA" "$BUILD_DATE" "$PLUGIN_VERSION" "$RN_SDK_VERSION" > "$OUT_FILE"
fi

cat "$OUT_FILE"
