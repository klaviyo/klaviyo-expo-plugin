#!/usr/bin/env bash
# Writes the store release notes for an example app deploy to the file given
# as $2 and also prints them, truncated to $1 characters maximum.
#
# Usage: release-notes.sh <max-chars> <output-file>
#
# Optional env: GITHUB_EVENT_NAME, SOURCE_LABEL (falls back to
# GITHUB_REF_NAME, then the current git branch), COMMIT_SHA (falls back to
# GITHUB_SHA, then git HEAD), RELEASE_NAME, RELEASE_BODY, APP_VERSION (falls back to the
# plugin version), BUILD_NUMBER (defaults to "?"), RUN_URL, BUILD_DATE
# (defaults to the current UTC time), SDK_REF (defaults to the output of
# sdk-ref.sh, which needs the example dependencies installed).
set -euo pipefail
export LC_ALL=C.UTF-8

MAX_CHARS="${1:?usage: release-notes.sh <max-chars> <output-file>}"
OUT_FILE="${2:?usage: release-notes.sh <max-chars> <output-file>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

SHA="${COMMIT_SHA:-${GITHUB_SHA:-$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || true)}}"
SUBJECT=$(git -C "$ROOT" log -1 --format=%s "$SHA" 2>/dev/null || true)
SOURCE_LABEL="${SOURCE_LABEL:-${GITHUB_REF_NAME:-$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || true)}}"
APP_VERSION="${APP_VERSION:-$(node -p "require('${ROOT}/package.json').version")}"
BUILD_NUMBER="${BUILD_NUMBER:-?}"
BUILD_DATE="${BUILD_DATE:-$(date -u '+%Y-%m-%d %H:%M UTC')}"
EVENT="${GITHUB_EVENT_NAME:-manual}"
SDK_REF="${SDK_REF:-$("$ROOT/scripts/ci/sdk-ref.sh")}"

COMMIT_LINE="Commit: ${SHA:0:7}"
if [[ -n "$SUBJECT" ]]; then
  COMMIT_LINE+=" $SUBJECT"
fi

NOTES="Version ${APP_VERSION} (build ${BUILD_NUMBER})
SDK: ${SDK_REF}
${COMMIT_LINE}
Ref: ${SOURCE_LABEL} (${EVENT})
Built: ${BUILD_DATE}"
if [[ -n "${RUN_URL:-}" ]]; then
  NOTES+="
CI run: ${RUN_URL}"
fi

if [[ "$EVENT" == "release" && -n "${RELEASE_BODY//[[:space:]]/}" ]]; then
  HEADER="Release notes:"
  if [[ -n "${RELEASE_NAME:-}" ]]; then
    HEADER="Release notes (${RELEASE_NAME}):"
  fi
  # Trim leading/trailing whitespace from the release body.
  BODY_TRIMMED=$(printf '%s' "$RELEASE_BODY" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  NOTES+="

${HEADER}
${BODY_TRIMMED}"
fi

# ${#var} counts characters with LC_ALL=C.UTF-8, so the suffix math is exact.
if ((${#NOTES} > MAX_CHARS)); then
  SUFFIX=$'\n[truncated]'
  KEEP=$((MAX_CHARS - ${#SUFFIX}))
  if ((KEEP < 0)); then
    KEEP=0
  fi
  NOTES="${NOTES:0:$KEEP}${SUFFIX}"
fi

printf '%s' "$NOTES" > "$OUT_FILE"
printf '%s\n' "$NOTES"
