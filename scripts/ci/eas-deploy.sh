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
# When BASE_VERSION (X.Y.Z) is set, the app version is derived from it and the
# build number, and written to the build profile env as APP_VERSION:
#   RELEASE_TAG set        X.Y.Z
#   BRANCH matches rel/*   X.Y.Z-rc.<build number>
#   anything else          X.Y.Z-alpha.<build number>
# The version is derived again whenever the build number changes. Android gets
# the full string; iOS gets plain X.Y.Z (app.config.js drops the suffix). CI
# requires BASE_VERSION.
#
# After every build the version the build reports (appBuildVersion, appVersion)
# is checked against what was asked for. A mismatch fails the deploy before the
# submit, since the binary does not carry the number the store would see.
#
# Writes build_id, app_version, build_number, build_url and build_date to
# $GITHUB_OUTPUT (and echoes them) after every successful build. app_version is
# the full derived string. build_number is the number the build reports, and
# BUILD_INFO_FILE (when set) receives the build info the app was stamped with,
# for the notes to read.
set -euo pipefail

PLATFORM="${1:?usage: eas-deploy.sh <android|ios> <build-number>}"
BUILD_NUMBER="${2:?usage: eas-deploy.sh <android|ios> <build-number>}"
PROFILE="${EAS_PROFILE:-production}"
MAX_ATTEMPTS="${EAS_DEPLOY_MAX_ATTEMPTS:-3}"
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

if [[ -n "${CI:-}" ]]; then
  : "${COMMIT_SHA:?COMMIT_SHA must come from the workflow; GITHUB_SHA is the merge commit on a pull request}"
  : "${BRANCH:?BRANCH must come from the workflow}"
  : "${SOURCE_LABEL:?SOURCE_LABEL must come from the workflow}"
  : "${BASE_VERSION:?BASE_VERSION must come from the workflow}"
fi

DASHBOARD_URL=$(node -p "const c = require('./app.config.js')(); 'https://expo.dev/accounts/' + c.owner + '/projects/' + c.slug + '/builds/'")

SHA="${COMMIT_SHA:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"
export APP_COMMIT_SHA="${SHA:0:7}"
export APP_BRANCH="${BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo local)}"
export APP_RELEASE_TAG="${RELEASE_TAG:-}"
SOURCE_LABEL="${SOURCE_LABEL:-local}"
export APP_SOURCE_LABEL="$SOURCE_LABEL"
export APP_EVENT="${GITHUB_EVENT_NAME:-manual}"

derive_app_version() {
  [[ -n "${BASE_VERSION:-}" ]] || return 0
  if [[ ! "$BASE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "::error::BASE_VERSION '$BASE_VERSION' is not X.Y.Z"
    exit 1
  fi
  if [[ -n "$APP_RELEASE_TAG" ]]; then
    APP_VERSION="$BASE_VERSION"
  elif [[ "$APP_BRANCH" == rel/* ]]; then
    APP_VERSION="${BASE_VERSION}-rc.${BUILD_NUMBER}"
  else
    APP_VERSION="${BASE_VERSION}-alpha.${BUILD_NUMBER}"
  fi
  export APP_VERSION
}

# Writes the build number and build info into the profile's env in eas.json, so the
# EAS build server's app.config.js sees them.
set_build_env() {
  local var=ANDROID_VERSION_CODE
  [[ "$PLATFORM" == ios ]] && var=IOS_BUILD_NUMBER
  local pair
  for pair in "$var:$BUILD_NUMBER" "APP_COMMIT_SHA:$APP_COMMIT_SHA" "APP_BRANCH:$APP_BRANCH" "APP_BUILT_AT:$APP_BUILT_AT" \
    "APP_VERSION:${APP_VERSION:-}" "APP_RELEASE_TAG:$APP_RELEASE_TAG" "APP_SOURCE_LABEL:$APP_SOURCE_LABEL" "APP_EVENT:$APP_EVENT"; do
    [[ -n "${pair#*:}" ]] || continue
    jq --arg profile "$PROFILE" --arg name "${pair%%:*}" --arg value "${pair#*:}" \
      '.build[$profile].env[$name] = $value' eas.json > eas.json.tmp
    mv eas.json.tmp eas.json
  done
}

attempt=1
while true; do
  export APP_BUILT_AT
  APP_BUILT_AT="$(date -u '+%Y-%m-%d %H:%M UTC')"
  derive_app_version
  set_build_env
  set_output build_number "$BUILD_NUMBER"

  echo "::group::EAS build ($PLATFORM, number $BUILD_NUMBER, attempt $attempt of $MAX_ATTEMPTS)"
  # The CLI evaluates app.config.js locally to resolve the build's appVersion;
  # EAS_BUILD_PLATFORM lets it pick the per-platform version the server will see.
  export EAS_BUILD_PLATFORM="$PLATFORM"
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
  reported_number=$(jq -r '.[0].appBuildVersion // empty' <<< "$build_json")
  reported_version=$(jq -r '.[0].appVersion // empty' <<< "$build_json")
  if [[ "$reported_number" != "$BUILD_NUMBER" ]]; then
    echo "::error::EAS build $build_id reports build number '${reported_number:-none}', expected $BUILD_NUMBER. The number did not reach the build; not submitting."
    exit 1
  fi
  if [[ -n "${BASE_VERSION:-}" ]]; then
    expected="$APP_VERSION"
    [[ "$PLATFORM" == ios ]] && expected="$BASE_VERSION"
    if [[ "$reported_version" != "$expected" ]]; then
      echo "::error::EAS build $build_id reports version '${reported_version:-none}', expected $expected. The version did not reach the build; not submitting."
      exit 1
    fi
  fi
  set_output build_id "$build_id"
  set_output app_version "${APP_VERSION:-${reported_version:-?}}"
  set_output build_number "$reported_number"
  set_output build_url "${DASHBOARD_URL}${build_id}"
  set_output build_date "$APP_BUILT_AT"
  if [[ -n "${BUILD_INFO_FILE:-}" ]]; then
    jq -n --arg sha "$APP_COMMIT_SHA" --arg branch "$APP_BRANCH" --arg builtAt "$APP_BUILT_AT" \
      --arg tag "$APP_RELEASE_TAG" --arg number "$reported_number" --arg version "${APP_VERSION:-$reported_version}" \
      --arg source "$APP_SOURCE_LABEL" --arg event "$APP_EVENT" \
      '{commitSha: $sha, branch: $branch, builtAt: $builtAt, releaseTag: $tag, buildNumber: $number, appVersion: $version, sourceLabel: $source, event: $event}' \
      > "$BUILD_INFO_FILE"
  fi

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
