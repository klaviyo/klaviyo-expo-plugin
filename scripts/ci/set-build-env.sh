#!/usr/bin/env bash
# Writes build numbers into the production build profile's env in example/eas.json,
# so the EAS build server's app.config.js sees them.
#
# Usage: set-build-env.sh <android|ios> <build-number>
# Run from example/. When APP_COMMIT_SHA is set it is written to the same env
# block, where app.config.js exposes it to the app's build info.
set -euo pipefail

PLATFORM="${1:?usage: set-build-env.sh <android|ios> <build-number>}"
NUMBER="${2:?usage: set-build-env.sh <android|ios> <build-number>}"
PROFILE="${EAS_PROFILE:-production}"

if ! [[ "$NUMBER" =~ ^[0-9]+$ ]]; then
  echo "::error::Build number '$NUMBER' is not a positive integer"
  exit 1
fi

case "$PLATFORM" in
  android) VAR=ANDROID_VERSION_CODE ;;
  ios) VAR=IOS_BUILD_NUMBER ;;
  *)
    echo "::error::Unknown platform '$PLATFORM' (expected android or ios)"
    exit 1
    ;;
esac

jq --arg profile "$PROFILE" --arg var "$VAR" --arg n "$NUMBER" \
  '.build[$profile].env[$var] = $n' eas.json > eas.json.tmp
mv eas.json.tmp eas.json
echo "$VAR=$NUMBER"

if [[ -n "${APP_COMMIT_SHA:-}" ]]; then
  jq --arg profile "$PROFILE" --arg sha "$APP_COMMIT_SHA" \
    '.build[$profile].env.APP_COMMIT_SHA = $sha' eas.json > eas.json.tmp
  mv eas.json.tmp eas.json
  echo "APP_COMMIT_SHA=$APP_COMMIT_SHA"
fi
