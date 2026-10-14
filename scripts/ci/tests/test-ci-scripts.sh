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
  stamped=$(jq -r '.build.production.env.ANDROID_VERSION_CODE // .build.production.env.IOS_BUILD_NUMBER' eas.json)
  if [[ "${FAKE_EAS_STALE_NUMBER:-}" != "" ]]; then
    stamped="$FAKE_EAS_STALE_NUMBER"
  fi
  printf '[{"id":"build-%s","appVersion":"%s","appBuildVersion":"%s"}]\n' "$n" "${FAKE_EAS_VERSION:-1.0.0}" "$stamped"
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
# predictable. SDK_DIR points at a fake klaviyo-react-native-sdk install.
mkdir -p "$WORK/fake-sdk/android"
cat > "$WORK/fake-sdk/klaviyo-react-native-sdk.podspec" <<'EOF'
  s.dependency "KlaviyoSwift", "9.8.7"
EOF
echo "KlaviyoReactNativeSdk_klaviyoAndroidSdkVersion=6.5.4" > "$WORK/fake-sdk/android/gradle.properties"
NOTES_ENV=(
  "SDK_DIR=$WORK/fake-sdk"
  "COMMIT_SHA=abc1234def5678"
  "BRANCH=feat/x"
  "SOURCE_LABEL=feat/x"
  "BUILD_DATE=2026-01-02 03:04 UTC"
  "APP_VERSION=1.0.0"
  "BUILD_NUMBER=7"
  "GITHUB_EVENT_NAME=push"
  "RUN_URL=https://github.com/klaviyo/klaviyo-expo-plugin/actions/runs/1"
)

# --- release-notes.sh: iOS notes list the native iOS SDK only ----------------
out=$(env "${NOTES_ENV[@]}" bash "$CI_DIR/release-notes.sh" ios 4000 "$WORK/notes-ios.txt" 2>&1)
assert_contains "release-notes: ios app line" "$out" "Expo Example 1.0.0 (7)"
assert_contains "release-notes: ios lists the iOS SDK" "$out" "Klaviyo iOS SDK 9.8.7"
assert_not_contains "release-notes: ios omits the Android SDK" "$out" "Klaviyo Android SDK"
assert_contains "release-notes: plugin ref is branch@sha7" "$out" "Klaviyo Expo Plugin 1.0.0 · feat/x@abc1234"
assert_contains "release-notes: commit line" "$out" "Commit: abc1234 on feat/x (push)"
assert_contains "release-notes: build date" "$out" "Built: 2026-01-02 03:04 UTC"
assert_contains "release-notes: CI run" "$out" "CI run: https://github.com/klaviyo/klaviyo-expo-plugin/actions/runs/1"
if [[ "$out" == "$(cat "$WORK/notes-ios.txt")" ]]; then
  pass "release-notes: output equals the file"
else
  fail "release-notes: output equals the file" "$out"
fi

# --- release-notes.sh: Android notes list the native Android SDK only --------
out=$(env "${NOTES_ENV[@]}" bash "$CI_DIR/release-notes.sh" android 500 "$WORK/notes-android.txt" 2>&1)
assert_contains "release-notes: android lists the Android SDK" "$out" "Klaviyo Android SDK 6.5.4"
assert_not_contains "release-notes: android omits the iOS SDK" "$out" "Klaviyo iOS SDK"

# --- release-notes.sh: a release uses the bare version as the plugin ref ----
out=$(env "${NOTES_ENV[@]}" GITHUB_EVENT_NAME=release RELEASE_TAG=v1.0.0 RELEASE_NAME=v1.0.0 \
  RELEASE_BODY="  First line
Second line  " bash "$CI_DIR/release-notes.sh" ios 4000 "$WORK/notes-release.txt" 2>&1)
assert_contains "release-notes: release plugin ref is the bare version" "$out" "Klaviyo Expo Plugin 1.0.0"$'\n'
assert_contains "release-notes: release body follows the header" "$out" $'\n\nRelease notes (v1.0.0):\nFirst line\nSecond line'

# --- release-notes.sh: the body is cut first, to the cap, with a marker -----
LONG_BODY=$(printf 'x%.0s' $(seq 1 600))
out=$(env "${NOTES_ENV[@]}" GITHUB_EVENT_NAME=release RELEASE_BODY="$LONG_BODY" \
  bash "$CI_DIR/release-notes.sh" android 500 "$WORK/notes-cut.txt" 2>&1)
if ((${#out} <= 500)) && [[ "$out" == *"…[truncated]" ]] && [[ "$out" == *"Built: 2026-01-02 03:04 UTC"* ]]; then
  pass "release-notes: the body is cut to the cap and the header survives"
else
  fail "release-notes: the body is cut to the cap and the header survives" "length=${#out}"
fi

# --- release-notes.sh: missing values render as a dash ----------------------
out=$(env -i PATH="$PATH" LC_ALL=C.UTF-8 SDK_DIR="$WORK/no-sdk" BUILD_DATE="2026-01-02 03:04 UTC" \
  GIT_DIR=/nonexistent bash "$CI_DIR/release-notes.sh" ios 4000 "$WORK/notes-missing.txt" 2>&1)
assert_contains "release-notes: a missing build number is a dash" "$out" "(—)"
assert_not_contains "release-notes: no unknown placeholder" "$out" "unknown"

# --- release-notes.sh: bad arguments ---------------------------------------
log=$(bash "$CI_DIR/release-notes.sh" windows 500 "$WORK/x.txt" 2>&1) && rc=0 || rc=$?
if ((rc != 0)) && [[ "$log" == *"--platform must be ios or android"* ]]; then
  pass "release-notes: rejects an unknown platform"
else
  fail "release-notes: rejects an unknown platform" "rc=$rc"$'\n'"$log"
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

# --- eas-deploy.sh: branch, built-at and release tag reach eas.json -----------
: > "$WORK/gh-output.txt"
log=$(run_deploy stamp android 10 BRANCH=feat/x RELEASE_TAG=v1.0.0 2>&1) && rc=0 || rc=$?
stamp_json="$WORK/repo-stamp/example/eas.json"
built_at=$(jq -r '.build.production.env.APP_BUILT_AT' "$stamp_json")
if ((rc == 0)) \
  && [[ "$(jq -r '.build.production.env.APP_BRANCH' "$stamp_json")" == "feat/x" ]] \
  && [[ "$(jq -r '.build.production.env.APP_RELEASE_TAG' "$stamp_json")" == "v1.0.0" ]] \
  && [[ "$built_at" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}\ [0-9]{2}:[0-9]{2}\ UTC$ ]] \
  && grep -q "^build_date=$built_at$" "$WORK/gh-output.txt"; then
  pass "eas-deploy: branch, built-at and release tag reach eas.json and match build_date"
else
  fail "eas-deploy: branch, built-at and release tag reach eas.json and match build_date" "rc=$rc built_at=$built_at"$'\n'"$log"
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

# --- the in-app copy text equals the notes header without the CI run line ------
: > "$WORK/gh-output.txt"
info="$WORK/build-info-copy.json"
log=$(run_deploy copy ios 21 BRANCH=feat/x SOURCE_LABEL=feat/x GITHUB_EVENT_NAME=push BUILD_INFO_FILE="$info" 2>&1) && rc=0 || rc=$?
app_copy=$(
  cd "$WORK/repo-copy/example" || exit 1
  # Load the stamped APP_* values from eas.json into the environment as the build server does.
  while IFS= read -r -d '' pair; do export "${pair?}"; done < <(
    jq -j '.build.production.env | to_entries[] | select(.key | startswith("APP_")) | "\(.key)=\(.value)\u0000"' eas.json
  )
  IOS_BUILD_NUMBER=21 SDK_DIR="$WORK/fake-sdk" node -e '
    const lib = require(process.argv[1]);
    const c = require("./app.config.js")().extra.buildInfo;
    const sdks = c.sdks.filter((s) => ["expo-plugin", "rn", "ios"].includes(s.key));
    process.stdout.write(lib.copyText({ ...c, appName: "Expo Example", buildNumber: "21", sdks }));
  ' "$ROOT/example/lib/build-info.js"
)
notes_header=$(
  env SDK_DIR="$WORK/fake-sdk" BUILD_INFO_FILE="$info" RUN_URL="https://example.test/run/1" \
    node "$CI_DIR/render-build-info.js" notes --platform ios --max-chars 4000 | grep -v '^CI run: '
)
# The RN SDK line reads the lockfile in both; the native line reads the fake SDK in both.
if ((rc == 0)) && [[ "$app_copy" == "$notes_header" ]]; then
  pass "app copy text equals the notes header without the CI run line"
else
  fail "app copy text equals the notes header without the CI run line" "rc=$rc"$'\n'"--- app:"$'\n'"$app_copy"$'\n'"--- notes:"$'\n'"$notes_header"
fi

# --- eas-deploy.sh: the build must report the number that was asked for ------
: > "$WORK/gh-output.txt"
log=$(run_deploy stale android 10 FAKE_EAS_STALE_NUMBER=4 2>&1) && rc=0 || rc=$?
submits="0"
[[ -f "$WORK/state-stale/submits" ]] && submits=$(cat "$WORK/state-stale/submits")
if ((rc != 0)) && ((submits == 0)) && [[ "$log" == *"reports build number '4', expected 10"* ]]; then
  pass "eas-deploy: a build with a stale number is not submitted"
else
  fail "eas-deploy: a build with a stale number is not submitted" "rc=$rc submits=$submits"$'\n'"$log"
fi

# --- eas-deploy.sh: after a retry the outputs and build info carry the final number
: > "$WORK/gh-output.txt"
info="$WORK/build-info-retry.json"
log=$(run_deploy final ios 10 FAKE_EAS_SUBMIT_FAILS=1 FAKE_EAS_PREVIOUS=20 BUILD_INFO_FILE="$info" 2>&1) && rc=0 || rc=$?
if ((rc == 0)) && grep -q '^build_number=21$' "$WORK/gh-output.txt" \
  && [[ "$(jq -r .buildNumber "$info")" == "21" ]] \
  && [[ "$(jq -r '.build.production.env.IOS_BUILD_NUMBER' "$WORK/repo-final/example/eas.json")" == "21" ]] \
  && [[ "$(tail -1 "$WORK/gh-output.txt")" != "build_number=10" ]]; then
  pass "eas-deploy: after a retry the outputs, eas.json and build info carry the final number"
else
  fail "eas-deploy: after a retry the outputs, eas.json and build info carry the final number" "rc=$rc"$'\n'"$(cat "$info" 2>/dev/null)"$'\n'"$log"
fi

# --- eas-deploy.sh: the build must report the marketing version the number came from ---
: > "$WORK/gh-output.txt"
log=$(run_deploy version ios 10 EXPECTED_VERSION=1.0.0 2>&1) && rc=0 || rc=$?
if ((rc == 0)); then
  pass "eas-deploy: a build with the expected version is submitted"
else
  fail "eas-deploy: a build with the expected version is submitted" "rc=$rc"$'\n'"$log"
fi

: > "$WORK/gh-output.txt"
log=$(run_deploy wrongver ios 10 EXPECTED_VERSION=0.3.2 FAKE_EAS_VERSION=0.3.1 2>&1) && rc=0 || rc=$?
submits="0"
[[ -f "$WORK/state-wrongver/submits" ]] && submits=$(cat "$WORK/state-wrongver/submits")
if ((rc != 0)) && ((submits == 0)) && [[ "$log" == *"reports version '0.3.1', expected 0.3.2"* ]]; then
  pass "eas-deploy: a build of another marketing version is not submitted"
else
  fail "eas-deploy: a build of another marketing version is not submitted" "rc=$rc submits=$submits"$'\n'"$log"
fi

: > "$WORK/gh-output.txt"
log=$(run_deploy prerelease ios 10 EXPECTED_VERSION=0.3.2 FAKE_EAS_VERSION=0.3.2-alpha.1 2>&1) && rc=0 || rc=$?
if ((rc == 0)); then
  pass "eas-deploy: a prerelease build matches its stripped marketing version"
else
  fail "eas-deploy: a prerelease build matches its stripped marketing version" "rc=$rc"$'\n'"$log"
fi

: > "$WORK/gh-output.txt"
log=$(run_deploy noexpect android 10 FAKE_EAS_VERSION=3.4.5-rc.1 2>&1) && rc=0 || rc=$?
if ((rc == 0)); then
  pass "eas-deploy: without EXPECTED_VERSION the version is not asserted"
else
  fail "eas-deploy: without EXPECTED_VERSION the version is not asserted" "rc=$rc"$'\n'"$log"
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

# --- check-secrets.sh: all names set -> ready ---------------------------------
: > "$WORK/gh-output.txt"
log=$(A=1 B=2 GITHUB_OUTPUT="$WORK/gh-output.txt" bash "$CI_DIR/check-secrets.sh" Android push A B 2>&1) && rc=0 || rc=$?
if ((rc == 0)) && grep -q '^ready=true$' "$WORK/gh-output.txt"; then
  pass "check-secrets: all set is ready"
else
  fail "check-secrets: all set is ready" "rc=$rc"$'\n'"$log"
fi

# --- check-secrets.sh: missing on push or release skips, green ----------------
for event in push release; do
  : > "$WORK/gh-output.txt"
  log=$(A=1 B='' C='' GITHUB_OUTPUT="$WORK/gh-output.txt" bash "$CI_DIR/check-secrets.sh" Android "$event" A B C 2>&1) && rc=0 || rc=$?
  if ((rc == 0)) && grep -q '^ready=false$' "$WORK/gh-output.txt" \
    && [[ "$log" == *"::notice::"*"B, C"* ]]; then
    pass "check-secrets: $event with missing secrets skips green and names them"
  else
    fail "check-secrets: $event with missing secrets skips green and names them" "rc=$rc"$'\n'"$log"
  fi
done

# --- check-secrets.sh: missing on dispatch or label fails loudly --------------
for event in workflow_dispatch pull_request; do
  : > "$WORK/gh-output.txt"
  log=$(A=1 B='' GITHUB_OUTPUT="$WORK/gh-output.txt" bash "$CI_DIR/check-secrets.sh" iOS "$event" A B 2>&1) && rc=0 || rc=$?
  if ((rc != 0)) && grep -q '^ready=false$' "$WORK/gh-output.txt" \
    && [[ "$log" == *"::error::"*"B"* ]]; then
    pass "check-secrets: $event with missing secrets fails and names them"
  else
    fail "check-secrets: $event with missing secrets fails and names them" "rc=$rc"$'\n'"$log"
  fi
done

# --- check-secrets.sh: values never reach the log -----------------------------
log=$(SECRET_ONE="super-secret-value-123" SECRET_TWO='' bash "$CI_DIR/check-secrets.sh" Android push SECRET_ONE SECRET_TWO 2>&1) && rc=0 || rc=$?
assert_not_contains "check-secrets: set values are never printed" "$log" "super-secret-value-123"
assert_contains "check-secrets: missing name is printed" "$log" "SECRET_TWO"

# --- check-secrets.sh: needs at least one name --------------------------------
log=$(bash "$CI_DIR/check-secrets.sh" Android push 2>&1) && rc=0 || rc=$?
if ((rc != 0)); then
  pass "check-secrets: no names is an error"
else
  fail "check-secrets: no names is an error" "rc=$rc"
fi

# --- slack-payload.sh: hostile values still produce valid JSON that round-trips ---
hostile_build=$'1.0.0 ("7")\nsecond line'
hostile_get=$'<https://example.test|Open "App">\nNot a tester? Ask "us" \\ now \U0001F600'
payload="$WORK/slack-payload.json"
RESULT=success PLATFORM=iOS DESTINATION=TestFlight BUILD="$hostile_build" SDKS='Expo 1.0.0 | RN 2.5.0' \
  SOURCE='feat/x (push)' COMMIT_SHA=abc1234def5678 SERVER_URL=https://github.com REPOSITORY=klaviyo/klaviyo-expo-plugin \
  RUN_ID=123 GET_BUILD="$hostile_get" bash "$CI_DIR/slack-payload.sh" "$payload" 2>&1 && rc=0 || rc=$?
if ((rc == 0)) && jq -e . "$payload" >/dev/null 2>&1; then
  body=$(jq -r '.blocks[0].text.text' "$payload")
  if [[ "$body" == *"$hostile_build"* ]] && [[ "$body" == *"$hostile_get"* ]]; then
    pass "slack-payload: quotes, newlines and backslashes survive in valid JSON"
  else
    fail "slack-payload: quotes, newlines and backslashes survive in valid JSON" "$body"
  fi
else
  fail "slack-payload: quotes, newlines and backslashes survive in valid JSON" "rc=$rc"
fi

# --- slack-payload.sh: success, failure and notes-failure layouts --------------
build_payload() {
  RESULT="$1" PLATFORM=Android DESTINATION="Play internal" BUILD="1.0.0 (7)" SDKS="Expo 1.0.0 | RN 2.5.0 | Android 4.5.1" \
    SOURCE="main (push)" COMMIT_SHA=abc1234def5678 SERVER_URL=https://github.com REPOSITORY=klaviyo/klaviyo-expo-plugin \
    RUN_ID=123 FAILED_STEP="EAS build or submit" GET_BUILD="Open the app" bash "$CI_DIR/slack-payload.sh" "$WORK/p-$1.json"
  jq -r '.blocks[0].text.text' "$WORK/p-$1.json"
}
out=$(build_payload success)
assert_contains "slack-payload: success has the destination" "$out" "✅ *Expo Example (Android)* → Play internal"
assert_contains "slack-payload: success lists the SDKs" "$out" "*SDKs:* Expo 1.0.0 | RN 2.5.0 | Android 4.5.1"
assert_contains "slack-payload: success links the commit and the run" "$out" "*Commit:* <https://github.com/klaviyo/klaviyo-expo-plugin/commit/abc1234def5678|abc1234> · <https://github.com/klaviyo/klaviyo-expo-plugin/actions/runs/123|CI run>"
assert_contains "slack-payload: success has Get the build" "$out" "*Get the build:* Open the app"
out=$(build_payload failure)
assert_contains "slack-payload: failure names the step" "$out" "❌ *Expo Example (Android)* deploy failed at EAS build or submit"
assert_not_contains "slack-payload: failure has no SDKs or install line" "$out" "*SDKs:*"
out=$(build_payload notes-failure)
assert_contains "slack-payload: notes failure is a separate warning" "$out" "⚠️ *Expo Example (Android)* build uploaded to Play internal, but its release notes were not set"
assert_not_contains "slack-payload: notes failure has no install line" "$out" "Get the build"

# --- slack-payload.sh: an unknown result is rejected --------------------------
log=$(RESULT=maybe PLATFORM=iOS DESTINATION=TestFlight COMMIT_SHA=abc1234 bash "$CI_DIR/slack-payload.sh" "$WORK/p-bad.json" 2>&1) && rc=0 || rc=$?
if ((rc != 0)) && [[ "$log" == *"Unknown RESULT"* ]]; then
  pass "slack-payload: rejects an unknown result"
else
  fail "slack-payload: rejects an unknown result" "rc=$rc"$'\n'"$log"
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
