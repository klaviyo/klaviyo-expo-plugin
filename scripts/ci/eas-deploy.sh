#!/usr/bin/env bash
# Builds the example app on EAS and submits it to the store for one platform.
#
# Usage: eas-deploy.sh <android|ios> <build-number>
# Run from example/. Requires EXPO_TOKEN and the `eas` CLI on PATH.
#
# <build-number> is the first build number to try (iOS buildNumber or Android
# versionCode, from next-build-number.js). It is written into the build profile
# env in eas.json before every build. If the store rejects an upload as a
# duplicate, the script rebuilds with the next free number and resubmits, up to
# EAS_DEPLOY_MAX_ATTEMPTS. The next number is the larger of the store's
# reported previous number plus one and the current number plus one.
#
# When RECHECK_CMD is set, it is run with `--minimum <number>` appended after
# the build and before the submit. It must print the JSON from
# next-build-number.js. If the store's next free number is above the current
# one (another run took it), the app is rebuilt with that number. A failing
# re-check is a warning and the submit goes ahead.
#
# All EAS output is filtered through `redact`, which masks signed artifact
# download URLs.
#
# Writes build_id, app_version, build_number, build_url and build_date to
# $GITHUB_OUTPUT (and echoes them) after every successful build.
set -euo pipefail

PLATFORM="${1:?usage: eas-deploy.sh <android|ios> <build-number>}"
BUILD_NUMBER="${2:?usage: eas-deploy.sh <android|ios> <build-number>}"
PROFILE="${EAS_PROFILE:-production}"
MAX_ATTEMPTS="${EAS_DEPLOY_MAX_ATTEMPTS:-3}"
SET_BUILD_ENV="$(cd "$(dirname "$0")" && pwd)/set-build-env.sh"
# Duplicate-build-number rejections from App Store Connect and Google Play as
# surfaced in `eas submit` output.
DUPLICATE_PATTERN='VERSION_DUPLICATE|has already been used|already been uploaded|bundle version must be higher|version code [0-9]+ has already|versionCode .*already|previousBundleVersion'

case "$PLATFORM" in
  android | ios) ;;
  *)
    echo "::error::Unknown platform '$PLATFORM' (expected android or ios)"
    exit 1
    ;;
esac

# Masks signed artifact URLs that the EAS CLI prints to the log.
redact() {
  sed -E \
    -e 's|https://[^[:space:]]*expo\.dev/artifacts/[^[:space:]]*|[redacted artifact URL]|g' \
    -e 's|https?://[^[:space:]]*X-Amz-Signature=[^[:space:]]*|[redacted artifact URL]|g'
}

set_output() {
  echo "$1=$2"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "$1=$2" >> "$GITHUB_OUTPUT"
  fi
}

DASHBOARD_URL=$(node -p "const c = require('./app.config.js')(); 'https://expo.dev/accounts/' + c.owner + '/projects/' + c.slug + '/builds/'")

SHA="${COMMIT_SHA:-${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}}"
export APP_COMMIT_SHA="${SHA:0:7}"
SOURCE_LABEL="${SOURCE_LABEL:-${GITHUB_REF_NAME:-local}}"

attempt=1
while true; do
  "$SET_BUILD_ENV" "$PLATFORM" "$BUILD_NUMBER"
  set_output build_number "$BUILD_NUMBER"

  echo "::group::EAS build ($PLATFORM, number $BUILD_NUMBER, attempt $attempt of $MAX_ATTEMPTS)"
  # --json prints the build list on stdout; progress logs go to stderr.
  build_json=$(eas build \
    --platform "$PLATFORM" \
    --profile "$PROFILE" \
    --non-interactive \
    --wait \
    --json \
    --message "${SOURCE_LABEL} @ ${SHA:0:7}" \
    2> >(redact >&2))
  echo "::endgroup::"

  build_id=$(jq -r '.[0].id' <<< "$build_json")
  set_output build_id "$build_id"
  set_output app_version "$(jq -r '.[0].appVersion // "?"' <<< "$build_json")"
  set_output build_url "${DASHBOARD_URL}${build_id}"
  set_output build_date "$(date -u '+%Y-%m-%d %H:%M UTC')"

  if [[ -n "${RECHECK_CMD:-}" ]] && ((attempt < MAX_ATTEMPTS)); then
    if recheck_json=$(env -u GITHUB_OUTPUT bash -c "$RECHECK_CMD --minimum $BUILD_NUMBER"); then
      fresh=$(jq -r '.build_number' <<< "$recheck_json")
      if [[ "$fresh" =~ ^[0-9]+$ ]] && ((fresh > BUILD_NUMBER)); then
        echo "::warning::Build number $BUILD_NUMBER was taken since the preflight; rebuilding with $fresh."
        BUILD_NUMBER="$fresh"
        attempt=$((attempt + 1))
        continue
      fi
    else
      echo "::warning::Pre-submit re-check failed; relying on duplicate detection at submit."
    fi
  fi

  submit_log=$(mktemp)
  echo "::group::EAS submit ($PLATFORM, attempt $attempt of $MAX_ATTEMPTS)"
  if eas submit \
    --platform "$PLATFORM" \
    --profile "$PROFILE" \
    --id "$build_id" \
    --non-interactive \
    --wait \
    2>&1 | redact | tee "$submit_log"; then
    echo "::endgroup::"
    exit 0
  fi
  echo "::endgroup::"

  if grep -Eiq "$DUPLICATE_PATTERN" "$submit_log" && ((attempt < MAX_ATTEMPTS)); then
    previous=$(grep -Eio 'previousBundleVersion = [0-9]+' "$submit_log" | head -1 | grep -Eo '[0-9]+' || true)
    next=$((BUILD_NUMBER + 1))
    if [[ -n "$previous" ]] && ((previous + 1 > next)); then
      next=$((previous + 1))
    fi
    echo "::warning::Store rejected build $build_id (number $BUILD_NUMBER) as a duplicate; rebuilding with $next."
    BUILD_NUMBER="$next"
    attempt=$((attempt + 1))
    continue
  fi

  echo "::error::EAS submit failed for $PLATFORM build $build_id (attempt $attempt of $MAX_ATTEMPTS)."
  exit 1
done
