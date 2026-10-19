#!/usr/bin/env bash
# Decides whether a platform's deploy can run, from which required secrets and
# variables are set. Prints names only, never values.
#
# Usage: check-secrets.sh <platform-label> <event-name> <NAME>...
# Each <NAME> is an environment variable holding the secret or variable value.
#
# Writes ready=true|false to $GITHUB_OUTPUT (when set) and prints it.
#   all names set                          ready=true, exit 0
#   some missing, event push or release    ready=false, ::notice::, exit 0 (skip)
#   some missing, any other event          ready=false, ::error::, exit 1
# Any other event is a workflow_dispatch or a label deploy, where a person asked
# for a deploy and a green skip would read as success.
set -euo pipefail

PLATFORM="${1:?usage: check-secrets.sh <platform-label> <event-name> <NAME>...}"
EVENT="${2:?usage: check-secrets.sh <platform-label> <event-name> <NAME>...}"
shift 2

if (($# == 0)); then
  echo "::error::check-secrets.sh needs at least one name to check"
  exit 2
fi

missing=()
for name in "$@"; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("$name")
  fi
done

write_ready() {
  echo "ready=$1"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "ready=$1" >> "$GITHUB_OUTPUT"
  fi
}

if ((${#missing[@]} == 0)); then
  write_ready true
  exit 0
fi

names=$(IFS=', '; echo "${missing[*]}")
names=${names//,/, }

write_ready false
case "$EVENT" in
  push | release)
    echo "::notice::Skipping the $PLATFORM deploy until these are set: ${names}. See PUBLISH_EXAMPLE.md."
    exit 0
    ;;
  *)
    echo "::error::Cannot deploy to $PLATFORM, these are not set: ${names}. See PUBLISH_EXAMPLE.md."
    exit 1
    ;;
esac
