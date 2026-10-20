#!/usr/bin/env bash
# Writes the store release notes for an example app deploy to <output-file> and
# also prints them. The text comes from the same formatter the app uses, so the
# notes and the in-app "Copy build info" text match.
#
# Usage: release-notes.sh <platform> <max-chars> <output-file>
#   <platform>   ios (TestFlight What to Test, 4000 chars) or android (Play, 500 chars)
#   <max-chars>  character cap; the release body is cut first, then the CI run line,
#                and the other header lines are never cut
#
# Env: see render-build-info.js. BUILD_DATE defaults to the current UTC time.
# On a workflow_dispatch at a tag (REF_TYPE=tag, REF_NAME=<tag>) with no
# RELEASE_BODY, the release is read with `gh release view` (needs GH_TOKEN);
# a failed lookup exits non-zero.
set -euo pipefail

PLATFORM="${1:?usage: release-notes.sh <platform> <max-chars> <output-file>}"
MAX_CHARS="${2:?usage: release-notes.sh <platform> <max-chars> <output-file>}"
OUT_FILE="${3:?usage: release-notes.sh <platform> <max-chars> <output-file>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

export BUILD_DATE="${BUILD_DATE:-$(date -u '+%Y-%m-%d %H:%M UTC')}"
if [[ -z "${BUILD_INFO_FILE:-}" && -n "${CI:-}" ]]; then
  : "${COMMIT_SHA:?COMMIT_SHA must come from the workflow}"
  : "${BRANCH:?BRANCH must come from the workflow}"
  : "${SOURCE_LABEL:?SOURCE_LABEL must come from the workflow}"
fi
export COMMIT_SHA="${COMMIT_SHA:-$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || true)}"
export BRANCH="${BRANCH:-$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || true)}"
export SOURCE_LABEL="${SOURCE_LABEL:-$BRANCH}"
export GITHUB_EVENT_NAME="${GITHUB_EVENT_NAME:-manual}"

if [[ "$GITHUB_EVENT_NAME" == "workflow_dispatch" && "${REF_TYPE:-}" == "tag" && -z "${RELEASE_BODY:-}" ]]; then
  if ! release="$(gh release view "$REF_NAME" --repo "$GITHUB_REPOSITORY" --json tagName,name,body)"; then
    echo "::error::Could not read GitHub release ${REF_NAME} for the store notes" >&2
    exit 1
  fi
  RELEASE_TAG="$(jq -r '.tagName' <<<"$release")"
  RELEASE_NAME="$(jq -r '.name // .tagName' <<<"$release")"
  RELEASE_BODY="$(jq -r '.body // ""' <<<"$release")"
  export RELEASE_TAG RELEASE_NAME RELEASE_BODY
fi

node "$ROOT/scripts/ci/render-build-info.js" notes --platform "$PLATFORM" --max-chars "$MAX_CHARS" > "$OUT_FILE"
cat "$OUT_FILE"
