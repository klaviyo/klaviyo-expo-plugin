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
for platform in android ios; do
  step=$(awk -v p="$platform" '
    /run: \.\.\/scripts\/ci\/eas-deploy\.sh/ && index($0, p) { found = 1 }
    { lines[NR] = $0 }
    found && !done { done = 1; stop = NR }
    END { for (i = stop; i > 0 && lines[i] !~ /- name:/; i--) out = lines[i] "\n" out; printf "%s", out }
  ' "$WORKFLOW")
  if [[ "$step" == *"RELEASE_TAG: \${{ github.event.release.tag_name }}"* ]]; then
    pass "the $platform deploy step sets RELEASE_TAG"
  else
    fail "the $platform deploy step sets RELEASE_TAG" "$step"
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
if awk '/^  preflight:/,/^  checks:/' "$WORKFLOW" | grep -q '^    environment:'; then
  fail "the preflight job declares no environment"
else
  pass "the preflight job declares no environment"
fi

# SLACK_WEBHOOK_URL is optional, so it must not be in a required list.
if awk '/^  preflight:/,/^  checks:/' "$WORKFLOW" | grep -q 'SLACK_WEBHOOK_URL'; then
  fail "SLACK_WEBHOOK_URL is not a required secret"
else
  pass "SLACK_WEBHOOK_URL is not a required secret"
fi

echo
if ((FAILURES > 0)); then
  echo "$FAILURES test(s) failed"
  exit 1
fi
echo "All tests passed"
