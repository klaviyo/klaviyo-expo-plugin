#!/usr/bin/env bash
# Sourced by the scripts that stamp or print build info. In CI (the CI variable is set) the commit,
# branch and source label must come from the workflow, and an empty or missing one fails with the
# field's name. Outside CI the callers keep their local fallbacks.
#
# Usage: require_ci_inputs <script name> <VARIABLE>...
require_ci_inputs() {
  local script="$1"
  shift
  [[ -n "${CI:-}" ]] || return 0
  local missing=()
  local name
  for name in "$@"; do
    [[ -n "${!name:-}" ]] || missing+=("$name")
  done
  if ((${#missing[@]} > 0)); then
    local list
    list=$(IFS=,; echo "${missing[*]}")
    echo "::error::$script needs ${list//,/, } from the workflow in CI. It does not fall back to GITHUB_SHA or the ref, which are the merge commit and N/merge on a pull request."
    return 1
  fi
}

# Fails with the names of any listed tools that are not on PATH. Called before an expensive step, so a
# tool missing from the runner image fails in seconds and not after the build.
#
# Usage: require_tools <script name> <tool>...
require_tools() {
  local script="$1"
  shift
  local missing=()
  local tool
  for tool in "$@"; do
    command -v "$tool" > /dev/null 2>&1 || missing+=("$tool")
  done
  if ((${#missing[@]} > 0)); then
    local list
    list=$(IFS=,; echo "${missing[*]}")
    echo "::error::$script needs ${list//,/, } on PATH and could not find ${#missing[@]} of them. Checked before the build starts, so no EAS build was used."
    return 1
  fi
}
