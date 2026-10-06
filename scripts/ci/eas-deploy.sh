#!/usr/bin/env bash
# Builds the example app on EAS and submits it to the store for one platform.
#
# Usage: eas-deploy.sh <android|ios> <release-notes-file>
# Run from example/. Requires EXPO_TOKEN and the `eas` CLI on PATH.
#
# Build numbers come from EAS's remote auto-increment (eas.json:
# cli.appVersionSource = remote, build.production.autoIncrement = true), so
# each build gets the next number from EAS's server-side counter. If the
# store still rejects the upload as a duplicate (the remote counter fell
# behind builds uploaded outside EAS), `eas submit` fails without retrying:
# the number is baked into the binary. So this script rebuilds, which bumps
# the remote counter again, and resubmits, up to EAS_DEPLOY_MAX_ATTEMPTS.
#
# Writes build_id, app_version, build_number and build_url to $GITHUB_OUTPUT.
set -euo pipefail

PLATFORM="${1:?usage: eas-deploy.sh <android|ios> <release-notes-file>}"
NOTES_FILE="${2:?usage: eas-deploy.sh <android|ios> <release-notes-file>}"
PROFILE="${EAS_PROFILE:-production}"
MAX_ATTEMPTS="${EAS_DEPLOY_MAX_ATTEMPTS:-3}"
# Duplicate-build-number rejections from App Store Connect and Google Play as
# surfaced in `eas submit` output.
DUPLICATE_PATTERN='VERSION_DUPLICATE|has already been used|already been uploaded|bundle version must be higher|version code [0-9]+ has already|versionCode .*already'

case "$PLATFORM" in
  android | ios) ;;
  *)
    echo "::error::Unknown platform '$PLATFORM' (expected android or ios)"
    exit 1
    ;;
esac

set_output() {
  echo "$1=$2"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "$1=$2" >> "$GITHUB_OUTPUT"
  fi
}

DASHBOARD_URL=$(node -p "const c = require('./app.config.js')(); 'https://expo.dev/accounts/' + c.owner + '/projects/' + c.slug + '/builds/'")

submit_args=()
if [[ "$PLATFORM" == "ios" ]]; then
  # TestFlight caps "What to Test" at 4000 characters.
  NOTES=$(cat "$NOTES_FILE")
  submit_args+=(--what-to-test "${NOTES:0:4000}")
fi

SHA="${GITHUB_SHA:-unknown}"
attempt=1
while true; do
  echo "::group::EAS build ($PLATFORM, attempt $attempt of $MAX_ATTEMPTS)"
  # --json prints the build list on stdout; progress logs go to stderr.
  build_json=$(eas build \
    --platform "$PLATFORM" \
    --profile "$PROFILE" \
    --non-interactive \
    --wait \
    --json \
    --message "${GITHUB_REF_NAME:-local} @ ${SHA:0:7}")
  echo "::endgroup::"

  build_id=$(jq -r '.[0].id' <<< "$build_json")
  set_output build_id "$build_id"
  set_output app_version "$(jq -r '.[0].appVersion // "?"' <<< "$build_json")"
  set_output build_number "$(jq -r '.[0].appBuildVersion // "?"' <<< "$build_json")"
  set_output build_url "${DASHBOARD_URL}${build_id}"

  submit_log=$(mktemp)
  echo "::group::EAS submit ($PLATFORM, attempt $attempt of $MAX_ATTEMPTS)"
  if eas submit \
    --platform "$PLATFORM" \
    --profile "$PROFILE" \
    --id "$build_id" \
    --non-interactive \
    --wait \
    "${submit_args[@]}" 2>&1 | tee "$submit_log"; then
    echo "::endgroup::"
    exit 0
  fi
  echo "::endgroup::"

  if grep -Eiq "$DUPLICATE_PATTERN" "$submit_log" && ((attempt < MAX_ATTEMPTS)); then
    echo "::warning::Store rejected build $build_id as a duplicate build number; rebuilding with the next remote build number."
    attempt=$((attempt + 1))
    continue
  fi

  echo "::error::EAS submit failed for $PLATFORM build $build_id (attempt $attempt of $MAX_ATTEMPTS)."
  exit 1
done
