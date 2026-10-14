#!/usr/bin/env bash
# Static checks on the publish workflows that actionlint cannot make. The checks
# live in test-workflow-guards.py; WORKFLOW_DIR and ACTIONS_DIR override where it
# reads the workflows and composite actions from.
set -euo pipefail
exec python3 -B "$(dirname "$0")/test-workflow-guards.py" "$@"
