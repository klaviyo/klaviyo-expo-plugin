#!/usr/bin/env python3
"""Static checks on the publish workflows that actionlint cannot make.

Prints one PASS/FAIL line per case and exits 1 if any case fails.

Env (used by the self-test):
  WORKFLOW_DIR   directory with publish-example.yml and publish-example-checks.yml
  ACTIONS_DIR    directory with the composite actions

The workflows are read as text and sliced by indentation, so the checks do not
depend on a YAML library or on the awk dialect of the machine.
"""

import glob
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
WORKFLOW_DIR = os.environ.get("WORKFLOW_DIR", os.path.join(ROOT, ".github", "workflows"))
ACTIONS_DIR = os.environ.get("ACTIONS_DIR", os.path.join(ROOT, ".github", "actions"))
DEPLOY_PATH = os.path.join(WORKFLOW_DIR, "publish-example.yml")
CHECKS_PATH = os.path.join(WORKFLOW_DIR, "publish-example-checks.yml")
SLACK_PATH = os.path.join(ACTIONS_DIR, "notify-slack-example-publish", "action.yml")

# Functions GitHub Actions expressions provide. Anything else called inside ${{ }} fails when it evaluates.
ALLOWED_FUNCTIONS = {
    "contains", "startsWith", "endsWith", "format", "join", "toJSON", "fromJSON",
    "hashFiles", "case", "success", "always", "cancelled", "failure",
}

failures = 0


def read(path):
    with open(path) as handle:
        return handle.read()


def report(ok, name, detail=""):
    global failures
    if ok:
        print(f"PASS: {name}")
        return
    failures += 1
    print(f"FAIL: {name}")
    for line in detail.splitlines():
        print(f"  | {line}")


def split_jobs(text):
    """Maps job id to the text of that top-level job."""
    body = text.split("\njobs:\n", 1)[1]
    parts = re.split(r"^  ([a-z][a-z0-9-]*):\n", body, flags=re.M)
    return dict(zip(parts[1::2], parts[2::2]))


def split_steps(job_text):
    """Returns the steps of a job as text blocks, each starting at its first key."""
    return re.split(r"(?m)^      - ", job_text)[1:]


def find_step(job_text, fragment):
    """First step whose name contains the fragment, or an empty string."""
    for block in split_steps(job_text):
        first = block.split("\n", 1)[0]
        if first.startswith("name:") and fragment in first:
            return block
    return ""


def checkout_states(text):
    """Yields (line number, safe) for each checkout. A checkout is safe when
    persist-credentials: false appears anywhere in its step."""
    lines = text.split("\n")
    for index, line in enumerate(lines):
        match = re.match(r"^(\s*)(- )?uses: actions/checkout@", line)
        if not match:
            continue
        key_indent = len(match.group(1)) + (2 if match.group(2) else 0)
        safe = False
        for following in lines[index + 1:]:
            if not following.strip():
                continue
            indent = len(following) - len(following.lstrip())
            if indent < key_indent:
                break
            if re.match(r"^\s*- ", following) and indent < key_indent + 1:
                break
            if re.match(r"^\s*persist-credentials:\s*false\s*$", following):
                safe = True
        yield index + 1, safe


deploy = read(DEPLOY_PATH)
checks = read(CHECKS_PATH)
slack = read(SLACK_PATH)
jobs = split_jobs(deploy)

def expressions(text):
    """Every expression in a file: the text inside ${{ }}, and the value of each `if:` key, which
    GitHub evaluates as an expression even without braces (single-line and block form)."""
    found = re.findall(r"\$\{\{.*?\}\}", text, flags=re.S)
    lines = text.split("\n")
    for index, line in enumerate(lines):
        match = re.match(r"^(\s*)(?:- )?if:\s*(.*)$", line)
        if not match:
            continue
        indent = len(match.group(1))
        value = match.group(2)
        if value.strip() in ("|", ">", "|-", ">-"):
            block = []
            for following in lines[index + 1:]:
                if following.strip() and len(following) - len(following.lstrip()) <= indent:
                    break
                block.append(following)
            value = "\n".join(block)
        found.append(value)
    return found


# Expressions only call functions that GitHub Actions provides, inside braces or in a bare if: value.
unsupported = set()
scanned = 0
for path in [DEPLOY_PATH, CHECKS_PATH] + sorted(glob.glob(os.path.join(ACTIONS_DIR, "*", "action.yml"))):
    for expression in expressions(read(path)):
        scanned += 1
        for name in re.findall(r"([A-Za-z_][A-Za-z0-9_]*)\(", expression):
            if name not in ALLOWED_FUNCTIONS:
                unsupported.add(name)
report(not unsupported, f"expressions only call functions that GitHub Actions provides ({scanned} scanned)",
       "unsupported: " + ", ".join(sorted(unsupported)))

# Every checkout drops its credentials, in the workflows and in the composite actions.
total = 0
unsafe = []
for path in [DEPLOY_PATH, CHECKS_PATH] + sorted(glob.glob(os.path.join(ACTIONS_DIR, "*", "action.yml"))):
    for line, safe in checkout_states(read(path)):
        total += 1
        if not safe:
            unsafe.append(f"{os.path.basename(os.path.dirname(path))}/{os.path.basename(path)}:{line}")
report(total > 0 and not unsafe, f"every checkout sets persist-credentials: false ({total} checked)",
       f"checkouts={total} unsafe:\n" + "\n".join(unsafe))

# The deploy steps run eas-deploy.sh, which stamps APP_RELEASE_TAG from RELEASE_TAG.
RELEASE_TAG_LINE = "RELEASE_TAG: ${{ github.event.release.tag_name }}"
for job in ("deploy-android", "deploy-ios"):
    step = find_step(jobs.get(job, ""), "EAS build and submit")
    if not step:
        report(False, f"the {job} job has an 'EAS build and submit' step (the guard is out of date)")
    else:
        report(RELEASE_TAG_LINE in step, f"the {job} step sets RELEASE_TAG", step)

# GitHub sets CI=true on every step, and the stampers refuse a missing commit, branch or source label in
# CI. So every step in every job that runs a stamper, found by what it runs and not by its name, must pass
# all three. release-notes.sh only needs them when it has no build info file to read.
STAMPERS = ("eas-deploy.sh", "release-notes.sh")
REQUIRED = ("COMMIT_SHA", "BRANCH", "SOURCE_LABEL")
stamper_steps = [
    (job, tool, block)
    for job, body in jobs.items()
    for block in split_steps(body)
    for tool in STAMPERS
    if re.search(rf"(?m)^        run: .*{re.escape(tool)}", block)
]
report(len(stamper_steps) >= 4, f"the workflow runs the stampers where expected ({len(stamper_steps)} calls found)",
       "\n".join(f"{job}: {tool}" for job, tool, _ in stamper_steps) or "none found")
for job, tool, block in stamper_steps:
    if tool == "release-notes.sh" and "BUILD_INFO_FILE:" in block:
        continue
    absent = [name for name in REQUIRED if not re.search(rf"(?m)^          {name}: ", block)]
    report(not absent, f"the {job} step running {tool} sets {', '.join(REQUIRED)}", "missing: " + ", ".join(absent))

# The notes and the app are stamped from the same event fields.
for job in ("deploy-android", "deploy-ios"):
    step = find_step(jobs.get(job, ""), "Render release notes")
    missing = [var for var in ("BUILD_INFO_FILE", "RELEASE_TAG", "GITHUB_EVENT_NAME") if f"{var}:" not in step]
    report(bool(step) and not missing,
           f"the {job} notes step sets the stamped fields (BUILD_INFO_FILE, RELEASE_TAG, GITHUB_EVENT_NAME)",
           "missing: " + (", ".join(missing) or "the step itself"))

# A Slack problem must never fail a deploy that already uploaded.
DEPLOY_JOBS = ("deploy-android", "android-notes", "deploy-ios", "what-to-test")
slack_steps = [
    (job, block)
    for job in DEPLOY_JOBS
    for block in split_steps(jobs.get(job, ""))
    if "uses: ./.github/actions/notify-slack-example-publish" in block
]
intolerant = [f"{job}: {block.splitlines()[0]}" for job, block in slack_steps if "continue-on-error: true" not in block]
report(bool(slack_steps) and not intolerant, f"every Slack step has continue-on-error ({len(slack_steps)} checked)",
       "\n".join(intolerant) or "no Slack steps found")

# Nothing posts to Slack except through the composite action, so the rules above see every message.
direct = [os.path.basename(path) for path in [DEPLOY_PATH, CHECKS_PATH]
          if "slackapi/slack-github-action" in read(path)]
report(not direct, "Slack is only posted through the composite action", "direct use in: " + ", ".join(direct))

# Each platform posts a success, a failure and a notes warning, and every one is a covered Slack step.
kinds = {}
for job, block in slack_steps:
    match = re.search(r"(?m)^\s+result: (\S+)", block)
    platform = "android" if "android" in job else "ios"
    kinds.setdefault(platform, set()).add(match.group(1) if match else "?")
wanted = {"success", "failure", "notes-failure"}
missing_kinds = [f"{platform}: {', '.join(sorted(wanted - found))}" for platform, found in sorted(kinds.items()) if wanted - found]
report(set(kinds) == {"android", "ios"} and not missing_kinds,
       "each platform posts a success, a failure and a notes warning through a checked step",
       "missing: " + "; ".join(missing_kinds or ["a platform"]))

# The composite's own steps are found by what they run or use, so renaming one cannot skip the rule.
composite_steps = re.split(r"(?m)^    - ", slack.split("\nruns:\n", 1)[1])[1:] if "\nruns:\n" in slack else []
payload_builders = [step for step in composite_steps if "slack-payload.sh" in step]
senders = [step for step in composite_steps if "uses: slackapi/slack-github-action@" in step]
report(len(payload_builders) == 1 and len(senders) == 1,
       "the Slack action has one payload builder and one send step",
       f"payload builders={len(payload_builders)} send steps={len(senders)}")
untolerant = [name for name, group in (("payload builder", payload_builders), ("send step", senders))
              if any("continue-on-error: true" not in step for step in group)]
report(bool(payload_builders and senders) and not untolerant, "the Slack action tolerates a payload or send failure",
       "no continue-on-error on: " + ", ".join(untolerant or ["(steps not found)"]))

# Slack values are never interpolated into a YAML payload block, where a newline breaks it.
yaml_payload = [path for path in [DEPLOY_PATH, CHECKS_PATH] + sorted(glob.glob(os.path.join(ACTIONS_DIR, "*", "action.yml")))
                if re.search(r"^\s*payload: \|", read(path), flags=re.M)]
report(not yaml_payload and "payload-file-path:" in slack, "the Slack payload is sent from a JSON file, not a YAML block",
       "YAML payload in: " + ", ".join(yaml_payload) if yaml_payload else "no payload-file-path found")

# Every job that runs a repo script needs a checkout.
for job in ("preflight", "deploy-android", "android-notes", "deploy-ios", "what-to-test"):
    body = jobs.get(job)
    if body is None:
        report(False, f"the {job} job exists (the guard is out of date)")
    else:
        report("actions/checkout" in body, f"the {job} job checks out the repository")

# Secrets live at repository level, so the preflight declares no environment and never requires the webhook.
preflight = jobs.get("preflight", "")
report(not re.search(r"(?m)^    environment:", preflight), "the preflight job declares no environment")
report("SLACK_WEBHOOK_URL" not in preflight, "SLACK_WEBHOOK_URL is not a required secret")

# The preflight checks only the platforms that were asked for: each platform's secret check is gated on
# its own plan output, so an iOS-only run never fails on Android's secrets and the reverse.
for platform, label in (("android", "Android"), ("ios", "iOS")):
    step = find_step(preflight, f"Check {label} secrets")
    gate = re.search(r"(?m)^        if: (.+)$", step)
    other = "ios" if platform == "android" else "android"
    ok = bool(gate) and f"needs.plan.outputs.{platform} == 'true'" in gate.group(1) and f"needs.plan.outputs.{other}" not in gate.group(1)
    report(ok, f"the preflight checks {label} secrets only when {label} was requested",
           "gate: " + (gate.group(1) if gate else "none"))

# Build numbers restart per marketing version, so every App Store Connect lookup keys on the stripped
# marketing version the preflight used: What to Test takes it from the deploy job's output, and the
# iOS deploy asserts the build reports it.
wtt = find_step(jobs.get("what-to-test", ""), "Set What to Test")
report("--marketing-version \"$MARKETING_VERSION\"" in wtt
       and "MARKETING_VERSION: ${{ needs.deploy-ios.outputs.marketing_version }}" in wtt,
       "What to Test looks the build up by the stripped marketing version from the deploy job", wtt)
report("marketing_version: ${{ steps.marketing.outputs.version }}" in jobs.get("deploy-ios", ""),
       "the iOS deploy job outputs the stripped marketing version")
ios_deploy = find_step(jobs.get("deploy-ios", ""), "EAS build and submit")
report("EXPECTED_VERSION: ${{ steps.marketing.outputs.version }}" in ios_deploy,
       "the iOS deploy step asserts the built marketing version", ios_deploy)

# Every step that runs a composer has the env the composer reads and the build info file does not supply.
COMPOSER_ENV = {
    "release-notes.sh": ("RELEASE_NAME", "RELEASE_BODY", "RUN_URL", "BUILD_INFO_FILE"),
    "render-build-info.js slack": ("BUILD_INFO_FILE",),
}
for job in ("deploy-android", "deploy-ios"):
    for block in split_steps(jobs.get(job, "")):
        for marker, needed in COMPOSER_ENV.items():
            if marker in block:
                absent = [name for name in needed if f"{name}:" not in block]
                report(not absent, f"the {job} step running {marker} sets {', '.join(needed)}",
                       "missing: " + ", ".join(absent))

# The checks job runs every test script, so a script that is written but never run cannot pass unnoticed.
checks_text = read(CHECKS_PATH)
for script in ("test-ci-scripts.sh", "test-workflow-guards.sh", "test-workflow-guards-selftest.sh", "test-notes-env.py", "test-bash-compat.py"):
    report(script in checks_text, f"the checks job runs {script}")
report("scripts/ci/tests/*.test.js" in checks_text, "the checks job runs the node tests")

# The commit is the pull request head, not the merge commit.
report("COMMIT_SHA: ${{ github.event.pull_request.head.sha || github.sha }}" in deploy,
       "the commit is the pull request head, not the merge commit")

# Tests gate the deploy: both deploy jobs wait for the checks job.
for job in ("deploy-android", "deploy-ios"):
    needs = re.search(r"(?m)^    needs: (.+)$", jobs.get(job, ""))
    report(bool(needs) and re.search(r"\bchecks\b", needs.group(1)) is not None, f"the {job} job needs the checks job")

# A fork pull request must not reach any job that can see secrets: every job that can run on a
# pull_request needs the same-repo condition, not only the first one.
SAME_REPO = "github.event.pull_request.head.repo.full_name == github.repository"
for job in ("plan", "preflight", "checks", "deploy-android", "android-notes", "deploy-ios", "what-to-test", "cleanup-label"):
    condition = re.search(r"(?ms)^    if:(.*?)(?=^    [a-z-]+:)", jobs.get(job, ""))
    report(bool(condition) and SAME_REPO in condition.group(1), f"the {job} job requires a same-repo pull request")

# An unrelated label must not start the first job, and a label only deploys same-repo pull requests.
plan = jobs.get("plan", "")
report("startsWith(github.event.label.name, 'deploy-example-app')" in plan
       and "head.repo.full_name == github.repository" in plan,
       "the plan job only runs for deploy labels on same-repo pull requests")

# The workflow reacts to the labeled event only, so a push to a labeled PR does not deploy again.
trigger = re.search(r"(?m)^  pull_request:\n((?:    .*\n)+)", deploy)
report(bool(trigger) and re.search(r"types:\s*\[labeled\]", trigger.group(1)) is not None,
       "the pull_request trigger is labeled only")

# The label is removed even when the deploy fails or is skipped.
report(re.search(r"(?m)^      always\(\)", jobs.get("cleanup-label", "")) is not None, "the label cleanup runs with always()")

print()
if failures:
    print(f"{failures} test(s) failed")
    sys.exit(1)
print("All tests passed")
