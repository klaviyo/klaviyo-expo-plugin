#!/usr/bin/env bash
# Self-test for test-workflow-guards.sh. Each case breaks a copy of the workflows
# and actions in one way and expects the guard to fail on the matching check. A
# guard that passes on a broken workflow proves nothing.
#
# Prints one PASS/FAIL line per case and exits non-zero if any case fails.
# The mutations contain ${{ }} expressions inside single quotes on purpose.
# shellcheck disable=SC2016
set -uo pipefail


ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
GUARD="$ROOT/scripts/ci/tests/test-workflow-guards.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

PASSED=0
FAILED=0

report() {
  if (($1 == 0)); then
    echo "PASS: $2"
    PASSED=$((PASSED + 1))
  else
    echo "FAIL: $2"
    FAILED=$((FAILED + 1))
  fi
}

fresh_copy() {
  rm -rf "$TMP/wf" "$TMP/actions" "$TMP/dependabot.yml"
  mkdir -p "$TMP/wf" "$TMP/actions"
  cp "$ROOT"/.github/workflows/publish-example*.yml "$TMP/wf/"
  cp -R "$ROOT"/.github/actions/. "$TMP/actions/"
  cp "$ROOT"/.github/dependabot.yml "$TMP/dependabot.yml"
}

run_guard() {
  WORKFLOW_DIR="$TMP/wf" ACTIONS_DIR="$TMP/actions" DEPENDABOT_PATH="$TMP/dependabot.yml" bash "$GUARD" > "$TMP/out.log" 2>&1
}

# expect_fail <name> <expected FAIL text>: the guard must exit non-zero and some FAIL line must contain
# the rule text anywhere, so a rule name with a job or file prefix still matches. Only FAIL lines count.
expect_fail() {
  if run_guard; then
    report 1 "$1 (guard passed on a broken workflow)"
  elif grep -E '^FAIL: ' "$TMP/out.log" | grep -qF -- "$2"; then
    report 0 "$1"
  else
    report 1 "$1 (guard failed, but not on '$2')"
  fi
}

# edit <file> <python expression body>: rewrites a file; the body gets `s` and must assign `s`
edit() {
  python3 - "$1" "$2" <<'PY'
import sys
path, body = sys.argv[1], sys.argv[2]
s = open(path).read()
before = s
scope = {"s": s}
exec(body, scope)
if scope["s"] == before:
    sys.exit("mutation did not change the file: " + body[:80])
open(path, "w").write(scope["s"])
print("mutated %d -> %d characters" % (len(before), len(scope["s"])), file=sys.stderr)
PY
}

DEPLOY="$TMP/wf/publish-example.yml"
CHECKS="$TMP/wf/publish-example-checks.yml"
SLACK="$TMP/actions/notify-slack-example-publish/action.yml"

fresh_copy
if run_guard; then report 0 "the guard passes on the real workflows"; else report 1 "the guard passes on the real workflows"; fi

fresh_copy
edit "$SLACK" 's = s.replace("${{ inputs.commit_sha }}", "${{ substr(inputs.commit_sha, 0, 7) }}", 1)'
expect_fail "substr in an expression is caught" "expressions only call functions"

fresh_copy
edit "$DEPLOY" 's = s.replace("${{ github.event.release.tag_name }}", "${{ github.event.release.tag_name }}".replace("tag_name", "tag_name || foo()"), 1)'
expect_fail "an unknown function in the workflow is caught" "expressions only call functions"

fresh_copy
edit "$DEPLOY" '
i = s.index("  deploy-ios:")
j = s.index("          RELEASE_TAG: ${{ github.event.release.tag_name }}\n", i)
s = s[:j] + s[j + len("          RELEASE_TAG: ${{ github.event.release.tag_name }}\n"):]
'
expect_fail "a deploy step without RELEASE_TAG is caught" "the deploy-ios step sets RELEASE_TAG"

fresh_copy
edit "$DEPLOY" '
i = s.index("  deploy-android:")
j = s.index("          BUILD_INFO_FILE: ${{ runner.temp }}/build-info.json\n          BRANCH:", i)
s = s[:j] + s[j + len("          BUILD_INFO_FILE: ${{ runner.temp }}/build-info.json\n"):]
'
expect_fail "a notes step that does not read the stamped build info is caught" "the deploy-android notes step sets the stamped fields"

fresh_copy
edit "$DEPLOY" '
i = s.index("      - name: Notify Slack on success")
j = s.index("        continue-on-error: true\n", i)
s = s[:j] + s[j + len("        continue-on-error: true\n"):]
'
expect_fail "a Slack step without continue-on-error is caught" "every Slack step has continue-on-error"

fresh_copy
edit "$SLACK" '
i = s.index("slack-payload.sh")
j = s.index("      continue-on-error: true\n", s.rindex("    - name:", 0, i))
s = s[:j] + s[j + len("      continue-on-error: true\n"):]
'
expect_fail "a Slack payload step that can fail the job is caught" "the Slack action tolerates a payload or send failure"

fresh_copy
edit "$SLACK" '
i = s.index("uses: slackapi/slack-github-action@")
j = s.rindex("      continue-on-error: true\n", 0, i)
s = s[:j] + s[j + len("      continue-on-error: true\n"):]
'
expect_fail "a Slack send step that can fail the job is caught" "the Slack action tolerates a payload or send failure"

fresh_copy
edit "$SLACK" 's = s.replace("    - name: Build the Slack payload\n", "    - name: Compose the message\n", 1)'
edit "$SLACK" '
i = s.index("slack-payload.sh")
j = s.index("      continue-on-error: true\n", s.rindex("    - name:", 0, i))
s = s[:j] + s[j + len("      continue-on-error: true\n"):]
'
expect_fail "a renamed Slack payload step is still checked" "the Slack action tolerates a payload or send failure"

fresh_copy
edit "$DEPLOY" 's = s.replace("      - name: Notify Slack on success\n", "      - name: Tell the team it worked\n", 1)'
edit "$DEPLOY" '
i = s.index("      - name: Tell the team it worked")
j = s.index("        continue-on-error: true\n", i)
s = s[:j] + s[j + len("        continue-on-error: true\n"):]
'
expect_fail "a renamed workflow Slack step is still checked" "every Slack step has continue-on-error"

fresh_copy
edit "$SLACK" 's = s.replace("payload-file-path: ${{ steps.payload.outputs.file }}", "payload: |\n          text: \"x ${{ inputs.build }}\"", 1)'
expect_fail "a YAML payload block is caught" "the Slack payload is sent from a JSON file"

fresh_copy
edit "$DEPLOY" '
i = s.index("  what-to-test:")
j = s.index("      - name: Checkout repository", i)
k = s.index("      - name: Set source label", j)
s = s[:j] + s[k:]
'
expect_fail "a job that runs a repo script without a checkout is caught" "the what-to-test job checks out the repository"

fresh_copy
edit "$DEPLOY" 's = s.replace("          ref: ${{ env.COMMIT_SHA }}\n          persist-credentials: false\n", "          ref: ${{ env.COMMIT_SHA }}\n", 1)'
expect_fail "a checkout that persists credentials is caught" "every checkout sets persist-credentials"

fresh_copy
edit "$CHECKS" 's = s.replace("          ref: ${{ inputs.ref }}\n          persist-credentials: false\n", "          ref: ${{ inputs.ref }}\n", 1)'
expect_fail "an unsafe checkout in the reusable checks workflow is caught" "every checkout sets persist-credentials"

fresh_copy
edit "$DEPLOY" 's = s.replace("          ref: ${{ env.COMMIT_SHA }}\n          persist-credentials: false\n", "          persist-credentials: false\n          ref: ${{ env.COMMIT_SHA }}\n", 1)'
if run_guard; then
  report 0 "persist-credentials is found wherever it sits in the with block"
else
  report 1 "persist-credentials is found wherever it sits in the with block (guard failed on a safe checkout)"
fi

fresh_copy
edit "$DEPLOY" 's = s.replace("          ref: ${{ env.COMMIT_SHA }}\n          persist-credentials: false\n", "          ref: ${{ env.COMMIT_SHA }}\n          fetch-depth: 1\n          submodules: false\n          lfs: false\n          clean: true\n          persist-credentials: false\n", 1)'
if run_guard; then
  report 0 "persist-credentials is found five lines below uses"
else
  report 1 "persist-credentials is found five lines below uses (guard failed on a safe checkout)"
fi

fresh_copy
edit "$DEPLOY" 's = s.replace("          ref: ${{ env.COMMIT_SHA }}\n          persist-credentials: false\n", "          ref: ${{ env.COMMIT_SHA }}\n          fetch-depth: 1\n          submodules: false\n          lfs: false\n          clean: true\n          persist-credentials: true\n", 1)'
expect_fail "persist-credentials: true far below uses is caught" "every checkout sets persist-credentials"

fresh_copy
edit "$DEPLOY" 's = s.replace("  preflight:\n    name: Check required secrets\n", "  preflight:\n    name: Check required secrets\n    environment: testflight\n", 1)'
expect_fail "a preflight that declares an environment is caught" "the preflight job declares no environment"

fresh_copy
edit "$DEPLOY" 's = s.replace("          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}\n          SERVICE_ACCOUNT_JSON", "          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}\n          SERVICE_ACCOUNT_JSON", 1)'
expect_fail "SLACK_WEBHOOK_URL in the preflight is caught" "SLACK_WEBHOOK_URL is not a required secret"

fresh_copy
edit "$DEPLOY" 's = s.replace("COMMIT_SHA: ${{ github.event.pull_request.head.sha || github.sha }}", "COMMIT_SHA: ${{ github.sha }}", 1)'
expect_fail "using the merge commit is caught" "the commit is the pull request head"

fresh_copy
edit "$DEPLOY" 's = s.replace("    needs: [checks, preflight]\n    if: |\n      !cancelled() && !failure()\n      && needs.preflight.outputs.ios", "    needs: [preflight]\n    if: |\n      !cancelled() && !failure()\n      && needs.preflight.outputs.ios", 1)'
expect_fail "a deploy that does not wait for the checks is caught" "the deploy-ios job needs the checks job"

fresh_copy
edit "$DEPLOY" 's = s.replace("\n      || (startsWith(github.event.label.name, \x27deploy-example-app\x27)\n          && github.event.pull_request.head.repo.full_name == github.repository)", "\n      || startsWith(github.event.label.name, \x27deploy-example-app\x27)", 1)'
expect_fail "a label deploy for fork pull requests is caught" "the plan job only runs for deploy labels on same-repo pull requests"

fresh_copy
edit "$DEPLOY" 's = s.replace("    types: [labeled]", "    types: [labeled, synchronize]", 1)'
expect_fail "a trigger that also fires on synchronize is caught" "the pull_request trigger is labeled only"

fresh_copy
edit "$DEPLOY" 's = s.replace("      always()\n      && github.event_name == \x27pull_request\x27", "      github.event_name == \x27pull_request\x27", 1)'
expect_fail "a label cleanup that skips on failure is caught" "the label cleanup runs with always()"

for job in preflight checks deploy-android android-notes deploy-ios what-to-test; do
  fresh_copy
  edit "$DEPLOY" "
import re
m = re.search(r'(?m)^  $job:\n', s)
a = m.start()
n = re.search(r'(?m)^  [a-z][a-z0-9-]*:\n', s[m.end():])
b = m.end() + n.start() if n else len(s)
seg = s[a:b].replace(\"\\n      && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)\", '').replace(\"    if: (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)\\n\", '')
s = s[:a] + seg + s[b:]
"
  expect_fail "a $job job without the same-repo condition is caught" "the $job job requires a same-repo pull request"
done

fresh_copy
edit "$DEPLOY" '
i = s.index("  cleanup-label:")
s = s[:i] + s[i:].replace("      && github.event.pull_request.head.repo.full_name == github.repository\n", "", 1)
'
expect_fail "a cleanup job without the same-repo condition is caught" "the cleanup-label job requires a same-repo pull request"

fresh_copy
edit "$DEPLOY" '
i = s.index("          result: notes-failure")
j = s.rindex("        continue-on-error: true\n", 0, i)
s = s[:j] + s[j + len("        continue-on-error: true\n"):]
'
expect_fail "a notes warning step without continue-on-error is caught" "every Slack step has continue-on-error"

fresh_copy
edit "$DEPLOY" '
i = s.index("          result: failure")
j = s.rindex("        continue-on-error: true\n", 0, i)
s = s[:j] + s[j + len("        continue-on-error: true\n"):]
'
expect_fail "a failure notifier step without continue-on-error is caught" "every Slack step has continue-on-error"

fresh_copy
edit "$DEPLOY" '
i = s.index("          result: notes-failure")
s = s[:i] + s[i:].replace("          result: notes-failure", "          result: failure", 1)
'
expect_fail "a platform that never posts a notes warning is caught" "each platform posts a success, a failure and a notes warning"

fresh_copy
edit "$DEPLOY" '
i = s.index("  android-notes:")
s = s[:i] + s[i:].replace("      - name: Set up Node.js", "      - name: Post to Slack directly\n        uses: slackapi/slack-github-action@91efab103c0de0a537f72a35f6b8cda0ee76bf0a # v2.1.1\n        with:\n          webhook: x\n\n      - name: Set up Node.js", 1)
'
expect_fail "a step that posts to Slack without the composite is caught" "Slack is only posted through the composite action"

fresh_copy
edit "$DEPLOY" 's = s.replace("      (needs.plan.outputs.android == \x27true\x27 ||", "      substr(needs.plan.outputs.android, 0, 4) == \x27true\x27 || (needs.plan.outputs.android == \x27true\x27 ||", 1)'
expect_fail "substr in a job-level if without braces is caught" "expressions only call functions"

fresh_copy
edit "$DEPLOY" 's = s.replace("        if: success()\n        env:\n          RELEASE_NAME", "        if: substr(job.status, 0, 1) == \x27s\x27\n        env:\n          RELEASE_NAME", 1)'
expect_fail "substr in a step-level if without braces is caught" "expressions only call functions"

fresh_copy
edit "$DEPLOY" 's = s.replace("  plan:\n    name: Choose platforms\n    if: |\n", "  plan:\n    name: Choose platforms\n    if: |\n      substr(github.event_name, 0, 1) == \x27x\x27 ||\n", 1)'
expect_fail "substr in a block-form if is caught" "expressions only call functions"

fresh_copy
edit "$SLACK" 's = s.replace("    - if: steps.webhook.outputs.post == \x27true\x27 && steps.payload.outcome == \x27success\x27", "    - if: substr(steps.webhook.outputs.post, 0, 4) == \x27true\x27", 1)'
expect_fail "substr in a composite action step if is caught" "expressions only call functions"

fresh_copy
edit "$DEPLOY" 's = s.replace("        id: android\n        if: needs.plan.outputs.android == \x27true\x27\n", "        id: android\n", 1)'
expect_fail "an Android secret check that runs for every request is caught" "the preflight checks Android secrets only when Android was requested"

fresh_copy
edit "$DEPLOY" 's = s.replace("        id: ios\n        if: needs.plan.outputs.ios == \x27true\x27\n", "        id: ios\n        if: needs.plan.outputs.android == \x27true\x27\n", 1)'
expect_fail "an iOS secret check gated on the Android request is caught" "the preflight checks iOS secrets only when iOS was requested"

fresh_copy
edit "$DEPLOY" 's = s.replace("          MARKETING_VERSION: ${{ needs.deploy-ios.outputs.marketing_version }}\n", "          MARKETING_VERSION: ${{ needs.deploy-ios.outputs.app_version }}\n", 1)'
expect_fail "What to Test using the reported version instead of the stripped one is caught" "What to Test looks the build up by the stripped marketing version"

fresh_copy
edit "$DEPLOY" 's = s.replace("          EXPECTED_VERSION: ${{ steps.marketing.outputs.version }}\n", "", 1)'
expect_fail "an iOS deploy that does not assert the built version is caught" "the iOS deploy step asserts the built marketing version"

fresh_copy
edit "$DEPLOY" 's = s.replace("      marketing_version: ${{ steps.marketing.outputs.version }}\n", "", 1)'
expect_fail "an iOS deploy job without the marketing version output is caught" "the iOS deploy job outputs the stripped marketing version"

fresh_copy
edit "$DEPLOY" '
i = s.index("      - name: Render release notes")
j = s.index("          RUN_URL:", i)
k = s.index("\n", j) + 1
s = s[:j] + s[k:]
'
expect_fail "a notes step without RUN_URL is caught" "step running release-notes.sh sets"

fresh_copy
edit "$CHECKS" 's = s.replace("        run: python3 -B scripts/ci/tests/test-notes-env.py\n", "        run: echo skipped\n", 1)'
expect_fail "a checks job that stops running the notes env test is caught" "the checks job runs test-notes-env.py"

fresh_copy
edit "$CHECKS" 's = s.replace("        run: node --test scripts/ci/tests/*.test.js\n", "        run: echo skipped\n", 1)'
expect_fail "a checks job that stops running the node tests is caught" "the checks job runs the node tests"

for var in COMMIT_SHA BRANCH SOURCE_LABEL; do
  fresh_copy
  edit "$DEPLOY" "
i = s.index('  deploy-ios:')
i = s.index('      - name: EAS build and submit', i)
j = s.index('          $var:', i)
k = s.index(chr(10), j) + 1
s = s[:j] + s[k:]
"
  expect_fail "an iOS deploy step without $var is caught" "the deploy-ios step running eas-deploy.sh sets COMMIT_SHA, BRANCH, SOURCE_LABEL"
done

fresh_copy
edit "$DEPLOY" 's = s.replace("      - name: Render Slack fields\n", "      - name: Seed the build info\n        run: ./scripts/ci/release-notes.sh android 500 \"${RUNNER_TEMP}/seed.txt\"\n\n      - name: Render Slack fields\n", 1)'
expect_fail "a new step that runs a stamper without the required inputs is caught, whatever it is called" "step running release-notes.sh sets COMMIT_SHA, BRANCH, SOURCE_LABEL"

fresh_copy
edit "$DEPLOY" 's = s.replace("      - name: Render Slack fields\n", "      - name: Record versions\n        run: ../scripts/ci/eas-deploy.sh android 1\n\n      - name: Render Slack fields\n", 1)'
expect_fail "a pre-build eas-deploy.sh call with no flags is caught" "step running eas-deploy.sh sets COMMIT_SHA, BRANCH, SOURCE_LABEL"

fresh_copy
edit "$CHECKS" 's = s.replace("        run: python3 -B scripts/ci/tests/test-bash-compat.py\n", "        run: echo skipped\n", 1)'
expect_fail "a checks job that stops running the bash 3.2 check is caught" "the checks job runs test-bash-compat.py"

fresh_copy
edit "$CHECKS" 's = s.replace("actionlint .github/workflows/publish-example*.yml", "actionlint .github/workflows/publish-example.yml .github/workflows/publish-example-checks.yml", 1)'
expect_fail "an actionlint step that names its files is caught" "actionlint globs the publish workflows"

fresh_copy
edit "$CHECKS" 's = s.replace("shellcheck scripts/ci/*.sh scripts/ci/tests/*.sh", "shellcheck scripts/ci/eas-deploy.sh scripts/ci/release-notes.sh", 1)'
expect_fail "a shellcheck step that names its files is caught" "shellcheck globs the script directories"

fresh_copy
edit "$CHECKS" 's = s.replace("shellcheck-py==0.9.0.6", "shellcheck-py", 1)'
expect_fail "an unpinned shellcheck is caught" "both linters are pinned"

fresh_copy
edit "$CHECKS" 's = s.replace("actionlint-py==1.7.7.23", "actionlint-py", 1)'
expect_fail "an unpinned actionlint is caught" "both linters are pinned"

fresh_copy
edit "$CHECKS" 's = s.replace(" example/lib/*.js", "", 1)'
expect_fail "a node syntax check that skips the app formatter is caught" "node --check covers the scripts"

fresh_copy
edit "$CHECKS" 's = s.replace("        run: bash scripts/ci/tests/lint-actions.sh\n", "        run: echo skipped\n", 1)'
expect_fail "a checks job that stops linting the composite actions is caught" "the checks job runs lint-actions.sh"

fresh_copy
edit "$DEPLOY" 's = s.replace("        run: ../scripts/ci/eas-deploy.sh android \"$BUILD_NUMBER\"", "        run: ../scripts/ci/eas-deploy.sh android \"${{ steps.number.outputs.build_number }}\"", 1)'
expect_fail "a step output written inside a run: script is caught" "no expression is written inside a run: script"

fresh_copy
edit "$DEPLOY" 's = s.replace("        run: echo \"install_url=", "        run: echo \"${{ github.head_ref }}\" \"install_url=", 1)'
expect_fail "github.head_ref inside a single-line run: is caught" "no expression is written inside a run: script"

fresh_copy
edit "$SLACK" 's = s.replace("        file=\"${RUNNER_TEMP}/slack-payload.json\"", "        file=\"${{ inputs.source }}/slack-payload.json\"", 1)'
expect_fail "an input written inside a composite action run: block is caught" "no expression is written inside a run: script"

fresh_copy
edit "$SLACK" 's = s.replace("${{ inputs.commit_sha }}", "${{ SubStr(inputs.commit_sha, 0, 7) }}", 1)'
expect_fail "a mixed-case SubStr call is caught" "expressions only call functions"

fresh_copy
edit "$SLACK" 's = s.replace("${{ inputs.commit_sha }}", "${{ CONTAINS(inputs.commit_sha, 0) }}", 1)'
if run_guard; then report 0 "an allowed function in any case is accepted"; else report 1 "an allowed function in any case is accepted"; fi

fresh_copy
edit "$TMP/dependabot.yml" 's = s.replace("      - /.github/actions/*\n", "", 1)'
expect_fail "dependabot that stops covering the composite actions is caught" "the github-actions dependabot entry covers the workflows and every composite action"

fresh_copy
edit "$DEPLOY" 's = s.replace("        run: ../scripts/ci/eas-deploy.sh android \"$BUILD_NUMBER\"", "        run: |2\n            ../scripts/ci/eas-deploy.sh android \"${{ github.head_ref }}\"", 1)'
expect_fail "an expression in a run: |2 block (indentation indicator) is caught" "no expression is written inside a run: script"

fresh_copy
edit "$DEPLOY" 's = s.replace("        run: ../scripts/ci/eas-deploy.sh android \"$BUILD_NUMBER\"", "        run: | # deploy\n          ../scripts/ci/eas-deploy.sh android \"${{ github.head_ref }}\"", 1)'
expect_fail "an expression in a run: | block with a trailing comment is caught" "no expression is written inside a run: script"

fresh_copy
edit "$DEPLOY" 's = s.replace("  plan:\n    name: Choose platforms\n    if: |\n", "  plan:\n    name: Choose platforms\n    if: |2 # why\n      substr(github.event_name, 0, 1) == \x27x\x27 ||\n", 1)'
expect_fail "an unsupported function in an if: |2 # comment block is caught" "expressions only call functions"

fresh_copy
python3 - "$TMP/dependabot.yml" <<'PY'
import sys
path = sys.argv[1]
open(path, "w").write("""version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: monthly
    groups:
      github-actions:
        patterns:
          - "*"
  - package-ecosystem: npm
    directories:
      - /.github/actions/*
    schedule:
      interval: monthly
""")
PY
expect_fail "action directories under another ecosystem do not count for github-actions" "the github-actions dependabot entry covers"

fresh_copy
edit "$CHECKS" 's = s.replace("    timeout-minutes: 15\n", "", 1)'
expect_fail "a job without timeout-minutes is caught" "every job sets timeout-minutes"

fresh_copy
edit "$DEPLOY" 's = s.replace("    timeout-minutes: 90\n", "", 1)'
expect_fail "a deploy job without timeout-minutes is caught" "every job sets timeout-minutes"

echo "SUMMARY: $PASSED passed, $FAILED failed"
((FAILED == 0))
