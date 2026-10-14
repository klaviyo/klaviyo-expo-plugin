#!/usr/bin/env bash
# Runs shellcheck on the shell inside every composite action, which actionlint cannot lint. The actions
# directory is globbed, so an action added later is covered without editing this file.
#
# Usage: lint-actions.sh [actions dir]
set -euo pipefail

ACTIONS_DIR="${1:-$(cd "$(dirname "$0")/../../.." && pwd)/.github/actions}"
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

total=0
for action in "$ACTIONS_DIR"/*/action.yml; do
  [[ -e "$action" ]] || continue
  count=$(python3 -B "$HERE/extract-action-runs.py" "$action" "$WORK")
  total=$((total + count))
done

if ((total == 0)); then
  echo "::error::No run blocks were found under $ACTIONS_DIR, so nothing was linted."
  exit 1
fi

echo "Linting $total run block(s) from the composite actions"
shopt -s nullglob
shellcheck "$WORK"/*.sh
