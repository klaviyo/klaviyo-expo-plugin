#!/usr/bin/env bash
# Builds the Slack message for a deploy result as JSON and writes it to a file.
# Every value goes through jq, so quotes and newlines in a value cannot break
# the payload.
#
# Usage: slack-payload.sh <output-file>
#
# Env:
#   RESULT        success, failure or notes-failure
#   PLATFORM      iOS or Android
#   DESTINATION   TestFlight or "Play internal"
#   BUILD         full version and build number, e.g. "1.0.0 (7)"
#   SDKS          short SDK names and versions
#   SOURCE        sanitized source label and event
#   COMMIT_SHA    full commit SHA
#   SERVER_URL, REPOSITORY, RUN_ID   github.server_url, github.repository, github.run_id
#   FAILED_STEP   name of the step that failed (failure only)
#   GET_BUILD     mrkdwn telling testers how to install the build (success only)
set -euo pipefail

OUT_FILE="${1:?usage: slack-payload.sh <output-file>}"

RESULT="${RESULT:?RESULT is required}"
PLATFORM="${PLATFORM:?PLATFORM is required}"
DESTINATION="${DESTINATION:?DESTINATION is required}"
COMMIT_SHA="${COMMIT_SHA:?COMMIT_SHA is required}"
SOURCE="${SOURCE:-—}"
BUILD="${BUILD:-—}"
SDKS="${SDKS:-—}"
SERVER_URL="${SERVER_URL:-https://github.com}"
REPOSITORY="${REPOSITORY:-}"
RUN_ID="${RUN_ID:-}"
FAILED_STEP="${FAILED_STEP:-}"
GET_BUILD="${GET_BUILD:-}"

case "$RESULT" in
  success)
    icon="✅"
    headline="→ ${DESTINATION}"
    ;;
  failure)
    icon="❌"
    headline="deploy failed at ${FAILED_STEP:-an unknown step}"
    ;;
  notes-failure)
    icon="⚠️"
    headline="build uploaded to ${DESTINATION}, but its release notes were not set. Re-run the failed job or set them by hand in the store console."
    ;;
  *)
    echo "::error::Unknown RESULT '$RESULT' (expected success, failure or notes-failure)"
    exit 1
    ;;
esac

SHORT_SHA="${COMMIT_SHA:0:7}"
COMMIT_URL="${SERVER_URL}/${REPOSITORY}/commit/${COMMIT_SHA}"
RUN_URL="${SERVER_URL}/${REPOSITORY}/actions/runs/${RUN_ID}"

body="${icon} *Expo Example (${PLATFORM})* ${headline}"$'\n'"*Build:* ${BUILD}"
if [[ "$RESULT" != "failure" ]]; then
  body+=$'\n'"*SDKs:* ${SDKS}"
fi
body+=$'\n'"*Source:* ${SOURCE}"
body+=$'\n'"*Commit:* <${COMMIT_URL}|${SHORT_SHA}> · <${RUN_URL}|CI run>"
if [[ "$RESULT" == "success" && -n "$GET_BUILD" ]]; then
  body+=$'\n'"*Get the build:* ${GET_BUILD}"
fi

jq -n --arg text "${icon} Expo Example (${PLATFORM}) ${headline}" --arg body "$body" \
  '{text: $text, blocks: [{type: "section", text: {type: "mrkdwn", text: $body}}]}' > "$OUT_FILE"
