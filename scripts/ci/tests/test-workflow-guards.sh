#!/usr/bin/env bash
# Static checks on the publish workflow that actionlint cannot make.
#
# Prints one PASS/FAIL line per case and exits non-zero if any case fails.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
WORKFLOW="$ROOT/.github/workflows/publish-example.yml"
ACTIONS="$ROOT/.github/actions"
FAILURES=0

pass() { echo "PASS: $1"; }
fail() {
  echo "FAIL: $1"
  if [[ -n "${2:-}" ]]; then
    echo "  | ${2//$'\n'/$'\n'  | }"
  fi
  FAILURES=$((FAILURES + 1))
}

# Prints the text of one job from the workflow. Done in Python so the result does not depend on the awk dialect.
job_text() {
  python3 - "$WORKFLOW" "$1" <<'PY'
import re, sys
text = open(sys.argv[1]).read()
parts = re.split(r"^  ([a-z][a-z0-9-]*):\n", text.split("\njobs:\n", 1)[1], flags=re.M)
print(dict(zip(parts[1::2], parts[2::2])).get(sys.argv[2], ""))
PY
}

# Functions GitHub Actions expressions provide. Anything else called inside ${{ }} fails when it evaluates.
ALLOWED='contains|startsWith|endsWith|format|join|toJSON|fromJSON|hashFiles|case|success|always|cancelled|failure'

bad=$(
  grep -rhoE '\$\{\{[^}]*\}\}' "$WORKFLOW" "$ACTIONS" \
    | grep -oE '[A-Za-z_][A-Za-z0-9_]*\(' \
    | sed 's/($//' \
    | sort -u \
    | grep -vxE "$ALLOWED" || true
)
if [[ -z "$bad" ]]; then
  pass "expressions only call functions that GitHub Actions provides"
else
  fail "expressions only call functions that GitHub Actions provides" "unsupported: $bad"
fi

# The deploy steps run eas-deploy.sh, which stamps APP_RELEASE_TAG from RELEASE_TAG.
for job in deploy-android deploy-ios; do
  step=$(job_text "$job" | python3 -c '
import re, sys
text = sys.stdin.read()
for block in re.split(r"(?m)^      - ", text):
    if "eas-deploy.sh" in block:
        print(block)
')
  if [[ "$step" == *"RELEASE_TAG: \${{ github.event.release.tag_name }}"* ]]; then
    pass "the $job step sets RELEASE_TAG"
  else
    fail "the $job step sets RELEASE_TAG" "$step"
  fi
done

# A Slack problem must never fail a deploy that already uploaded.
total=$(grep -c 'uses: ./.github/actions/notify-slack-example-publish' "$WORKFLOW")
tolerant=$(grep -B1 'uses: ./.github/actions/notify-slack-example-publish' "$WORKFLOW" | grep -c 'continue-on-error: true')
if ((total > 0 && total == tolerant)); then
  pass "every Slack step has continue-on-error"
else
  fail "every Slack step has continue-on-error" "steps=$total tolerant=$tolerant"
fi

# Secrets live at repository level, so the preflight must not declare an environment.
if job_text preflight | grep -q '^    environment:'; then
  fail "the preflight job declares no environment"
else
  pass "the preflight job declares no environment"
fi

# SLACK_WEBHOOK_URL is optional, so it must not be in a required list.
if job_text preflight | grep -q 'SLACK_WEBHOOK_URL'; then
  fail "SLACK_WEBHOOK_URL is not a required secret"
else
  pass "SLACK_WEBHOOK_URL is not a required secret"
fi

# An unrelated label must not start the workflow's first job, or every label costs a runner.
if job_text plan | grep -q "startsWith(github.event.label.name, 'deploy-example-app')"; then
  pass "the plan job only runs for deploy labels on pull requests"
else
  fail "the plan job only runs for deploy labels on pull requests"
fi

# Slack values must never be interpolated into a YAML payload block, where a newline breaks it.
if grep -q 'payload: |' "$ACTIONS/notify-slack-example-publish/action.yml"; then
  fail "the Slack payload is built as JSON, not interpolated into YAML"
else
  pass "the Slack payload is built as JSON, not interpolated into YAML"
fi

# Every job that runs a repo script needs a checkout.
jobs_without_checkout=$(python3 - "$WORKFLOW" <<'PY'
import re, sys
text = open(sys.argv[1]).read()
jobs = re.split(r"^  ([a-z][a-z0-9-]*):\n", text.split("\njobs:\n", 1)[1], flags=re.M)
bodies = dict(zip(jobs[1::2], jobs[2::2]))
for name in ("preflight", "deploy-android", "android-notes", "deploy-ios", "what-to-test"):
    if "actions/checkout" not in bodies.get(name, ""):
        print(name)
PY
)
for job in preflight deploy-android android-notes deploy-ios what-to-test; do
  if grep -qx "$job" <<< "$jobs_without_checkout"; then
    fail "the $job job checks out the repository"
  else
    pass "the $job job checks out the repository"
  fi
done

echo
if ((FAILURES > 0)); then
  echo "$FAILURES test(s) failed"
  exit 1
fi
echo "All tests passed"
