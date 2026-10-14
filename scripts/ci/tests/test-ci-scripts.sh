#!/usr/bin/env bash
# Self-contained tests for the CI scripts in scripts/ci/. A fake `eas` binary
# on PATH stands in for the EAS CLI; eas-deploy.sh runs with cwd set to the
# real example/ directory so it can read app.config.js.
#
# Prints one PASS/FAIL line per case and exits non-zero if any case fails.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CI_DIR="$ROOT/scripts/ci"

export LC_ALL=C.UTF-8

FAILURES=0

pass() { echo "PASS: $1"; }
fail() {
  echo "FAIL: $1"
  if [[ -n "${2:-}" ]]; then
    echo "  | ${2//$'\n'/$'\n'  | }"
  fi
  FAILURES=$((FAILURES + 1))
}

# assert_contains <name> <haystack-file-or-string> <needle>
assert_contains() {
  local name="$1" haystack="$2" needle="$3"
  if [[ -f "$haystack" ]]; then
    haystack=$(cat "$haystack")
  fi
  if [[ "$haystack" == *"$needle"* ]]; then
    pass "$name"
  else
    fail "$name" "expected to contain: $needle"$'\n'"got: $haystack"
  fi
}

assert_not_contains() {
  local name="$1" haystack="$2" needle="$3"
  if [[ -f "$haystack" ]]; then
    haystack=$(cat "$haystack")
  fi
  if [[ "$haystack" != *"$needle"* ]]; then
    pass "$name"
  else
    fail "$name" "expected not to contain: $needle"
  fi
}

FAKES=$(mktemp -d)
WORK=$(mktemp -d)
trap 'rm -rf "$FAKES" "$WORK"' EXIT

# Stand-in git: returns a fixed commit subject for `log` and nothing for
# other subcommands, so release-notes.sh output is deterministic.
cat > "$FAKES/git" <<'EOF'
#!/usr/bin/env bash
while [[ "${1:-}" == "-C" ]]; do
  shift 2
done
if [[ "${1:-}" == "log" && "${FAKE_GIT_SUBJECT:-1}" != "0" ]]; then
  echo "test commit"
fi
exit 0
EOF
chmod +x "$FAKES/git"

# Fake eas: `build` prints one build JSON object on stdout (id and build
# number increment via a counter file) and an artifact URL on stderr.
# `submit` fails with a duplicate message for the first
# FAKE_EAS_SUBMIT_FAILS calls, always fails with an unrelated message when
# FAKE_EAS_SUBMIT_FATAL=1, and succeeds otherwise.
cat > "$FAKES/eas" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cmd="${1:-}"
state="${FAKE_EAS_STATE:?FAKE_EAS_STATE not set}"
if [[ "$cmd" == "build" ]]; then
  n=0
  if [[ -f "$state/count" ]]; then
    n=$(cat "$state/count")
  fi
  n=$((n + 1))
  echo "$n" > "$state/count"
  echo "Artifact: https://expo.dev/artifacts/eas/abc.aab" >&2
  echo "Signed URL: https://s3.amazonaws.com/bucket/abc.aab?X-Amz-Signature=deadbeef" >&2
  printf '[{"id":"build-%s","appVersion":"1.0.0","appBuildVersion":"%s"}]\n' "$n" "$n"
elif [[ "$cmd" == "submit" ]]; then
  fails="${FAKE_EAS_SUBMIT_FAILS:-0}"
  s=0
  if [[ -f "$state/submits" ]]; then
    s=$(cat "$state/submits")
  fi
  s=$((s + 1))
  echo "$s" > "$state/submits"
  if [[ "${FAKE_EAS_SUBMIT_FATAL:-0}" == "1" ]]; then
    echo "Submit failed: credentials are invalid"
    exit 1
  fi
  if ((s <= fails)); then
    echo "Submit failed: previousBundleVersion = ${FAKE_EAS_PREVIOUS:-5}"
    exit 1
  fi
  echo "Submitted successfully"
else
  echo "fake eas: unknown command $cmd" >&2
  exit 2
fi
EOF
chmod +x "$FAKES/eas"

export PATH="$FAKES:$PATH"

# Shared environment for release-notes.sh cases: fixed values so output is
# predictable, and git is never consulted.
NOTES_ENV=(
  "SDK_DIR=$WORK/no-sdk"
  "GITHUB_SHA=abc1234def5678"
  "BUILD_DATE=2026-01-02 03:04 UTC"
  "BUILD_NUMBER=7"
)

# --- release-notes.sh: push event, no release body -------------------------
out=$(env "${NOTES_ENV[@]}" \
  GITHUB_EVENT_NAME=push \
  SOURCE_LABEL=main \
  bash "$CI_DIR/release-notes.sh" 4000 "$WORK/notes-push.txt" 2>&1)
expected="Version 1.0.0 (build 7)
SDK: klaviyo-expo-plugin 1.0.0 | klaviyo-react-native-sdk 2.5.0 | iOS SDK unknown | Android SDK unknown
Commit: abc1234 test commit
Ref: main (push)
Built: 2026-01-02 03:04 UTC"
if [[ "$out" == "$expected" ]] && [[ "$(cat "$WORK/notes-push.txt")" == "$expected" ]]; then
  pass "release-notes: push event format"
else
  fail "release-notes: push event format" "$out"
fi

# --- release-notes.sh: release event with body and name --------------------
base_expected="Version 1.0.0 (build 7)
SDK: klaviyo-expo-plugin 1.0.0 | klaviyo-react-native-sdk 2.5.0 | iOS SDK unknown | Android SDK unknown
Commit: abc1234 test commit
Ref: main (push)
Built: 2026-01-02 03:04 UTC"
out=$(env "${NOTES_ENV[@]}" \
  GITHUB_EVENT_NAME=release \
  SOURCE_LABEL=v1.0.0 \
  RELEASE_NAME="v1.0.0" \
  RELEASE_BODY="  First line
Second line  " \
  RUN_URL="https://github.com/klaviyo/klaviyo-expo-plugin/actions/runs/1" \
  bash "$CI_DIR/release-notes.sh" 4000 "$WORK/notes-release.txt" 2>&1)
expected="${base_expected/Ref: main (push)/Ref: v1.0.0 (release)}
CI run: https://github.com/klaviyo/klaviyo-expo-plugin/actions/runs/1

Release notes (v1.0.0):
First line
Second line"
if [[ "$out" == "$expected" ]]; then
  pass "release-notes: release event with body and name"
else
  fail "release-notes: release event with body and name" "$out"
fi

# --- release-notes.sh: truncation lands exactly on max-chars ---------------
LONG_BODY=$(printf 'x%.0s' $(seq 1 500))
out=$(env "${NOTES_ENV[@]}" \
  GITHUB_EVENT_NAME=release \
  RELEASE_BODY="$LONG_BODY" \
  bash "$CI_DIR/release-notes.sh" 200 "$WORK/notes-trunc.txt" 2>&1)
len=${#out}
if ((len == 200)) && [[ "$out" == *$'\n[truncated]' ]]; then
  pass "release-notes: truncation is exactly max-chars"
else
  fail "release-notes: truncation is exactly max-chars" "length=$len, tail=${out: -20}"
fi

# --- release-notes.sh: empty subject leaves no trailing space --------------
out=$(env "${NOTES_ENV[@]}" \
  GITHUB_EVENT_NAME=push \
  SOURCE_LABEL=main \
  FAKE_GIT_SUBJECT=0 \
  bash "$CI_DIR/release-notes.sh" 4000 "$WORK/notes-empty.txt" 2>&1)
if [[ "$out" == *$'Commit: abc1234\n'* ]]; then
  pass "release-notes: empty subject has no trailing space"
else
  fail "release-notes: empty subject has no trailing space" "$out"
fi

# --- sdk-ref.sh: output shape ----------------------------------------------
out=$(bash "$CI_DIR/sdk-ref.sh")
if [[ "$out" =~ ^klaviyo-expo-plugin\ [0-9.]+\ \|\ klaviyo-react-native-sdk\ [0-9.]+\ \|\ iOS\ SDK\ [^\ ]+\ \|\ Android\ SDK\ [^\ ]+$ ]]; then
  pass "sdk-ref: output shape"
else
  fail "sdk-ref: output shape" "$out"
fi

# --- sdk-ref.sh: reads the native SDK versions from an installed package -----
mkdir -p "$WORK/fake-sdk/android"
cat > "$WORK/fake-sdk/klaviyo-react-native-sdk.podspec" <<'EOF'
  s.dependency "KlaviyoSwift", "9.8.7"
EOF
echo "KlaviyoReactNativeSdk_klaviyoAndroidSdkVersion=6.5.4" > "$WORK/fake-sdk/android/gradle.properties"
out=$(SDK_DIR="$WORK/fake-sdk" bash "$CI_DIR/sdk-ref.sh")
if [[ "$out" == *"| iOS SDK 9.8.7 | Android SDK 6.5.4" ]]; then
  pass "sdk-ref: native versions come from the installed package"
else
  fail "sdk-ref: native versions come from the installed package" "$out"
fi

# --- sdk-ref.sh: reports unknown when the package is missing -----------------
out=$(SDK_DIR="$WORK/no-sdk" bash "$CI_DIR/sdk-ref.sh")
if [[ "$out" == *"| iOS SDK unknown | Android SDK unknown" ]]; then
  pass "sdk-ref: unknown when the package is not installed"
else
  fail "sdk-ref: unknown when the package is not installed" "$out"
fi

# Helper: run eas-deploy.sh <platform> <number> from a scratch copy of the repo
# layout (eas-deploy.sh rewrites eas.json) with a fresh fake-eas state dir.
run_deploy() {
  local name="$1" platform="$2" number="$3"
  shift 3
  local state="$WORK/state-$name" root="$WORK/repo-$name"
  local proj="$root/example"
  mkdir -p "$state" "$proj"
  cp "$ROOT/package.json" "$root/"
  cp "$ROOT/example/app.config.js" "$ROOT/example/eas.json" "$ROOT/example/package.json" "$proj/"
  (
    cd "$proj" || exit 1
    env \
      PATH="$FAKES:$PATH" \
      FAKE_EAS_STATE="$state" \
      GITHUB_OUTPUT="$WORK/gh-output.txt" \
      GITHUB_SHA=abc1234def5678 \
      "$@" \
      bash "$CI_DIR/eas-deploy.sh" "$platform" "$number"
  )
}

: > "$WORK/gh-output.txt"
REAL_EAS_JSON_SUM=$(cksum < "$ROOT/example/eas.json")

# --- eas-deploy.sh: success on first try, number written to eas.json --------
log=$(run_deploy first android 10 2>&1) && rc=0 || rc=$?
if ((rc == 0)) && grep -q '^build_number=10$' "$WORK/gh-output.txt" \
  && [[ "$(jq -r '.build.production.env.ANDROID_VERSION_CODE' "$WORK/repo-first/example/eas.json")" == "10" ]] \
  && [[ "$(jq -r '.build.production.env.APP_COMMIT_SHA' "$WORK/repo-first/example/eas.json")" == "abc1234" ]]; then
  pass "eas-deploy: success first try"
else
  fail "eas-deploy: success first try" "rc=$rc"$'\n'"$log"
fi

# --- eas-deploy.sh: COMMIT_SHA takes precedence over GITHUB_SHA -------------
log=$(run_deploy commit android 10 COMMIT_SHA=fedcba9876543 2>&1) && rc=0 || rc=$?
if ((rc == 0)) && [[ "$(jq -r '.build.production.env.APP_COMMIT_SHA' "$WORK/repo-commit/example/eas.json")" == "fedcba9" ]]; then
  pass "eas-deploy: COMMIT_SHA overrides GITHUB_SHA"
else
  fail "eas-deploy: COMMIT_SHA overrides GITHUB_SHA" "rc=$rc"$'\n'"$log"
fi

# --- eas-deploy.sh: iOS number goes to IOS_BUILD_NUMBER ----------------------
log=$(run_deploy ios ios 3 2>&1) && rc=0 || rc=$?
if ((rc == 0)) && [[ "$(jq -r '.build.production.env.IOS_BUILD_NUMBER' "$WORK/repo-ios/example/eas.json")" == "3" ]]; then
  pass "eas-deploy: ios number written to IOS_BUILD_NUMBER"
else
  fail "eas-deploy: ios number written to IOS_BUILD_NUMBER" "rc=$rc"$'\n'"$log"
fi

# --- eas-deploy.sh: duplicate bumps to the next number (previous below) -----
: > "$WORK/gh-output.txt"
log=$(run_deploy retry android 10 FAKE_EAS_SUBMIT_FAILS=1 2>&1) && rc=0 || rc=$?
builds=$(cat "$WORK/state-retry/count")
if ((rc == 0)) && ((builds == 2)) && grep -q '^build_number=11$' "$WORK/gh-output.txt" \
  && [[ "$(jq -r '.build.production.env.ANDROID_VERSION_CODE' "$WORK/repo-retry/example/eas.json")" == "11" ]]; then
  pass "eas-deploy: duplicate retries with current + 1"
else
  fail "eas-deploy: duplicate retries with current + 1" "rc=$rc builds=$builds"$'\n'"$log"
fi

# --- eas-deploy.sh: duplicate jumps past the store's previous number --------
: > "$WORK/gh-output.txt"
log=$(run_deploy jump ios 10 FAKE_EAS_SUBMIT_FAILS=1 FAKE_EAS_PREVIOUS=20 2>&1) && rc=0 || rc=$?
if ((rc == 0)) && grep -q '^build_number=21$' "$WORK/gh-output.txt"; then
  pass "eas-deploy: duplicate retries with previous + 1"
else
  fail "eas-deploy: duplicate retries with previous + 1" "rc=$rc"$'\n'"$log"
fi

# Fake re-check command: prints the JSON next-build-number.js would, taking
# the first free number from FAKE_RECHECK_FREE (or failing when it is "fail").
cat > "$FAKES/recheck" <<'EOF'
#!/usr/bin/env bash
if [[ "${FAKE_RECHECK_FREE:-}" == "fail" ]]; then
  echo "store unreachable" >&2
  exit 1
fi
min=1
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--minimum" ]]; then min="$2"; fi
  shift
done
free="${FAKE_RECHECK_FREE:-$min}"
if ((free < min)); then free=$min; fi
printf '{"build_number": %s}\n' "$free"
EOF
chmod +x "$FAKES/recheck"

# --- eas-deploy.sh: re-check finds the number taken, rebuilds ---------------
: > "$WORK/gh-output.txt"
log=$(run_deploy taken android 10 RECHECK_CMD=recheck FAKE_RECHECK_FREE=15 2>&1) && rc=0 || rc=$?
builds=$(cat "$WORK/state-taken/count")
if ((rc == 0)) && ((builds == 2)) && grep -q '^build_number=15$' "$WORK/gh-output.txt"; then
  pass "eas-deploy: re-check rebuilds with a taken number's successor"
else
  fail "eas-deploy: re-check rebuilds with a taken number's successor" "rc=$rc builds=$builds"$'\n'"$log"
fi

# --- eas-deploy.sh: re-check with a free number does not rebuild ------------
log=$(run_deploy free android 10 RECHECK_CMD=recheck 2>&1) && rc=0 || rc=$?
builds=$(cat "$WORK/state-free/count")
if ((rc == 0)) && ((builds == 1)); then
  pass "eas-deploy: free number builds once"
else
  fail "eas-deploy: free number builds once" "rc=$rc builds=$builds"$'\n'"$log"
fi

# --- eas-deploy.sh: failing re-check still submits --------------------------
log=$(run_deploy recheckfail android 10 RECHECK_CMD=recheck FAKE_RECHECK_FREE=fail 2>&1) && rc=0 || rc=$?
builds=$(cat "$WORK/state-recheckfail/count")
if ((rc == 0)) && ((builds == 1)) && [[ "$log" == *"re-check failed"* ]]; then
  pass "eas-deploy: failing re-check falls through to submit"
else
  fail "eas-deploy: failing re-check falls through to submit" "rc=$rc builds=$builds"$'\n'"$log"
fi

# --- eas-deploy.sh: gives up after max attempts -----------------------------
: > "$WORK/gh-output.txt"
log=$(run_deploy exhaust android 10 FAKE_EAS_SUBMIT_FAILS=99 EAS_DEPLOY_MAX_ATTEMPTS=2 2>&1) && rc=0 || rc=$?
builds=$(cat "$WORK/state-exhaust/count")
if ((rc != 0)) && ((builds == 2)); then
  pass "eas-deploy: gives up after max attempts"
else
  fail "eas-deploy: gives up after max attempts" "rc=$rc builds=$builds"$'\n'"$log"
fi

# --- eas-deploy.sh: fatal submit error does not retry ------------------------
log=$(run_deploy fatal android 10 FAKE_EAS_SUBMIT_FATAL=1 2>&1) && rc=0 || rc=$?
builds=$(cat "$WORK/state-fatal/count")
if ((rc != 0)) && ((builds == 1)); then
  pass "eas-deploy: fatal error does not retry"
else
  fail "eas-deploy: fatal error does not retry" "rc=$rc builds=$builds"$'\n'"$log"
fi

# --- eas-deploy.sh: artifact URLs are redacted from the log ------------------
log=$(run_deploy redact android 10 FAKE_EAS_SUBMIT_FAILS=1 2>&1) && rc=0 || rc=$?
if ((rc == 0)); then
  assert_not_contains "eas-deploy: expo artifact URL redacted" "$log" "expo.dev/artifacts/eas/abc.aab"
  assert_not_contains "eas-deploy: signed URL redacted" "$log" "X-Amz-Signature="
  assert_contains "eas-deploy: harmless log lines survive" "$log" "Submitted successfully"
  assert_contains "eas-deploy: redaction marker present" "$log" "[redacted artifact URL]"
else
  fail "eas-deploy: artifact URL redaction" "rc=$rc"$'\n'"$log"
fi

# --- eas-deploy.sh: rejects an unknown platform ------------------------------
log=$(
  cd "$ROOT/example" && bash "$CI_DIR/eas-deploy.sh" windows 5 2>&1
) && rc=0 || rc=$?
if ((rc != 0)) && [[ "$log" == *"Unknown platform"* ]]; then
  pass "eas-deploy: bad platform exits non-zero"
else
  fail "eas-deploy: bad platform exits non-zero" "rc=$rc"$'\n'"$log"
fi

# --- set-build-env.sh: validates its arguments ------------------------------
proj="$WORK/example-setenv"
mkdir -p "$proj"
cp "$ROOT/example/eas.json" "$proj/"
log=$(cd "$proj" && bash "$CI_DIR/set-build-env.sh" android abc 2>&1) && rc=0 || rc=$?
if ((rc != 0)) && [[ "$log" == *"not a positive integer"* ]]; then
  pass "set-build-env: rejects a non-numeric number"
else
  fail "set-build-env: rejects a non-numeric number" "rc=$rc"$'\n'"$log"
fi
log=$(cd "$proj" && bash "$CI_DIR/set-build-env.sh" tvos 5 2>&1) && rc=0 || rc=$?
if ((rc != 0)) && [[ "$log" == *"Unknown platform"* ]]; then
  pass "set-build-env: rejects an unknown platform"
else
  fail "set-build-env: rejects an unknown platform" "rc=$rc"$'\n'"$log"
fi

# --- the tracked eas.json is never modified by the tests ---------------------
if [[ "$(cksum < "$ROOT/example/eas.json")" == "$REAL_EAS_JSON_SUM" ]]; then
  pass "example/eas.json untouched"
else
  fail "example/eas.json untouched"
fi

echo
if ((FAILURES > 0)); then
  echo "$FAILURES test(s) failed"
  exit 1
fi
echo "All tests passed"
