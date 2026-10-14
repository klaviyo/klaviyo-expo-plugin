#!/usr/bin/env python3
"""Runs the notes and Slack composers with the env the deploy workflow actually defines.

The env for each "Render ..." step is read from publish-example.yml and its ${{ }}
expressions are evaluated for a simulated event (push, release, pull_request label).
The build info file is stamped with decoy values, so an env variable that the
workflow forgets to set shows up in the output as the decoy, or as a dash.

Prints one PASS/FAIL line per case and exits 1 if any case fails.
"""

import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
WORKFLOW = os.environ.get("WORKFLOW", os.path.join(ROOT, ".github", "workflows", "publish-example.yml"))
DECOY = "DECOY"
failures = 0


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
    body = text.split("\njobs:\n", 1)[1]
    parts = re.split(r"^  ([a-z][a-z0-9-]*):\n", body, flags=re.M)
    return dict(zip(parts[1::2], parts[2::2]))


def find_step(job_text, fragment):
    for block in re.split(r"(?m)^      - ", job_text)[1:]:
        if block.startswith("name:") and fragment in block.split("\n", 1)[0]:
            return block
    return ""


def step_env(step):
    match = re.search(r"(?ms)^        env:\n((?:          .*\n)+)", step + "\n")
    if not match:
        return {}
    return dict(re.findall(r"(?m)^          ([A-Z_]+): (.*)$", match.group(1)))


def lookup(path, context):
    value = context
    for part in path.split("."):
        if not isinstance(value, dict) or part not in value:
            return ""
        value = value[part]
    return "" if value is None else str(value)


def evaluate(expression, context):
    """Evaluates the forms the workflow uses: dotted lookups joined by || (first non-empty wins)."""
    expression = expression.strip()
    if "&&" in expression or "==" in expression or "(" in expression:
        raise ValueError(f"unsupported expression: {expression}")
    for alternative in expression.split("||"):
        value = lookup(alternative.strip(), context)
        if value != "":
            return value
    return ""


def render_env(raw, context):
    out = {}
    for name, value in raw.items():
        out[name] = re.sub(r"\$\{\{\s*(.*?)\s*\}\}", lambda m: evaluate(m.group(1), context), value.strip().strip('"'))
    return out


SHA = "0123456789abcdef0123456789abcdef01234567"
PR_SHA = "fedcba9876543210fedcba9876543210fedcba98"
EVENTS = {
    "push": {
        "github": {"event_name": "push", "ref_name": "rel/1.1.0", "head_ref": "", "event": {}, "sha": SHA,
                   "server_url": "https://github.com", "repository": "klaviyo/klaviyo-expo-plugin", "run_id": "42"},
        "expect_body": False,
    },
    "release": {
        "github": {"event_name": "release", "ref_name": "v1.1.0", "head_ref": "", "sha": SHA,
                   "event": {"release": {"name": "Version 1.1.0", "body": "Adds build info.", "tag_name": "v1.1.0"}},
                   "server_url": "https://github.com", "repository": "klaviyo/klaviyo-expo-plugin", "run_id": "42"},
        "expect_body": True,
    },
    "pull_request label": {
        "github": {"event_name": "pull_request", "ref_name": "17/merge", "head_ref": "feat/x", "sha": SHA,
                   "event": {"label": {"name": "deploy-example-app"}, "pull_request": {"head": {"sha": PR_SHA}}},
                   "server_url": "https://github.com", "repository": "klaviyo/klaviyo-expo-plugin", "run_id": "42"},
        "expect_body": False,
    },
}

workflow = open(WORKFLOW).read()
jobs = split_jobs(workflow)
global_env = dict(re.findall(r"(?m)^  ([A-Z_]+): (.*)$", workflow.split("\njobs:\n", 1)[0].split("\nenv:\n", 1)[1]))

def run_composer(event, spec, job, platform, cap, drop=None):
    """Runs release-notes.sh with the env the workflow defines for this step and event.
    Returns (returncode, notes, stderr, context). `drop` removes one variable from that env."""
    step = find_step(jobs[job], "Render release notes")
    github = spec["github"]
    context = {"github": github, "runner": {"temp": tempfile.mkdtemp()}, "env": {}}
    context["env"]["COMMIT_SHA"] = evaluate(global_env["COMMIT_SHA"].replace("${{", "").replace("}}", ""), context)
    source = ("release " + github["event"]["release"]["tag_name"]) if event == "release" else (github["head_ref"] or github["ref_name"])
    context["env"]["SOURCE_LABEL"] = re.sub(r"[^A-Za-z0-9._/ +-]", "", source)
    env = render_env(step_env(step), context)
    if drop:
        env.pop(drop, None)

    # The build info file carries decoys for everything it supplies, so a field read from the wrong place shows.
    info_file = os.path.join(context["runner"]["temp"], "build-info.json")
    stamped = {
        "commitSha": context["env"]["COMMIT_SHA"][:7],
        "branch": github["head_ref"] or github["ref_name"],
        "builtAt": "2026-01-02 03:04 UTC",
        "releaseTag": github["event"].get("release", {}).get("tag_name", ""),
        "buildNumber": "21",
        "appVersion": "1.0.0",
        "sourceLabel": context["env"]["SOURCE_LABEL"],
        "event": github["event_name"],
    }
    with open(info_file, "w") as handle:
        json.dump(stamped, handle)
    env["BUILD_INFO_FILE"] = info_file

    process_env = {"PATH": os.environ["PATH"], "LC_ALL": "C.UTF-8", "SDK_DIR": "/nonexistent", **env}
    output_file = os.path.join(context["runner"]["temp"], "notes.txt")
    result = subprocess.run(["bash", os.path.join(ROOT, "scripts", "ci", "release-notes.sh"), platform, str(cap), output_file],
                            capture_output=True, text=True, env=process_env, cwd=ROOT)
    return result.returncode, result.stdout, result.stderr, context


for event, spec in EVENTS.items():
    github = spec["github"]
    for job, platform, cap in (("deploy-android", "android", 500), ("deploy-ios", "ios", 4000)):
        label = f"{event}, {platform}"
        if not find_step(jobs[job], "Render release notes"):
            report(False, f"{label}: the deploy job has a 'Render release notes' step")
            continue
        code, notes, stderr, context = run_composer(event, spec, job, platform, cap)
        if code != 0:
            report(False, f"{label}: release-notes.sh runs with the workflow's env", stderr)
            continue
        expected_commit = context["env"]["COMMIT_SHA"][:7]
        checks = [
            ("the commit is the one the workflow builds", f"Commit: {expected_commit} on " in notes),
            ("the source label and event come through", f"({github['event_name']})" in notes),
            ("the CI run link points at this run", f"{github['server_url']}/{github['repository']}/actions/runs/{github['run_id']}" in notes),
            ("the plugin ref follows the event", ("Klaviyo Expo Plugin 1.0.0\n" in notes) == (event == "release")),
            ("the release body is present only for a release", ("Adds build info." in notes) == spec["expect_body"]),
            ("no missing value renders as a dash", "(—)" not in notes and "on — (" not in notes),
        ]
        for what, ok in checks:
            report(ok, f"{label}: {what}", notes)

def run_deploy(event, spec, job, platform, drop=None):
    """Runs the real eas-deploy.sh with the env the workflow defines for the deploy step, against a fake
    eas, and returns the build info file it wrote."""
    step = next(block for block in re.split(r"(?m)^      - ", jobs[job]) if "eas-deploy.sh" in block)
    github = spec["github"]
    work = tempfile.mkdtemp()
    context = {"github": github, "runner": {"temp": work}, "env": {}}
    context["env"]["COMMIT_SHA"] = evaluate(global_env["COMMIT_SHA"].replace("${{", "").replace("}}", ""), context)
    source = ("release " + github["event"]["release"]["tag_name"]) if event == "release" else (github["head_ref"] or github["ref_name"])
    context["env"]["SOURCE_LABEL"] = re.sub(r"[^A-Za-z0-9._/ +-]", "", source)
    env = {k: v for k, v in render_env({k: v for k, v in step_env(step).items()
                                         if "secrets." not in v and "steps." not in v and "needs." not in v}, context).items()}
    if drop:
        env.pop(drop, None)
    env.pop("RECHECK_CMD", None)

    # The runner provides these on every step; the workflow does not set them.
    runner_env = {
        "GITHUB_SHA": SHA,
        "GITHUB_REF_NAME": github["ref_name"],
        "GITHUB_HEAD_REF": github["head_ref"],
        "GITHUB_EVENT_NAME": github["event_name"],
    }
    bindir = os.path.join(work, "bin")
    os.makedirs(bindir)
    fake = os.path.join(bindir, "eas")
    with open(fake, "w") as handle:
        handle.write("""#!/usr/bin/env bash
if [[ "$1" == "build" ]]; then
  stamped=$(jq -r '.build.production.env.ANDROID_VERSION_CODE // .build.production.env.IOS_BUILD_NUMBER' eas.json)
  printf '[{"id":"b1","appVersion":"1.0.0","appBuildVersion":"%s"}]\\n' "$stamped"
else
  echo submitted
fi
""")
    os.chmod(fake, 0o755)
    project = os.path.join(work, "repo", "example")
    os.makedirs(project)
    for name in ("package.json",):
        subprocess.run(["cp", os.path.join(ROOT, name), os.path.join(work, "repo", name)], check=True)
    for name in ("app.config.js", "eas.json", "package.json"):
        subprocess.run(["cp", os.path.join(ROOT, "example", name), os.path.join(project, name)], check=True)
    info = os.path.join(work, "build-info.json")
    env["BUILD_INFO_FILE"] = info
    process_env = {"PATH": bindir + os.pathsep + os.environ["PATH"], "LC_ALL": "C.UTF-8", **runner_env, **env}
    process_env.pop("EXPECTED_VERSION", None)
    result = subprocess.run(["bash", os.path.join(ROOT, "scripts", "ci", "eas-deploy.sh"), platform, "21"],
                            capture_output=True, text=True, env=process_env, cwd=project)
    if result.returncode != 0 or not os.path.exists(info):
        return None, result.stdout + result.stderr, context
    return json.load(open(info)), "", context


for event, spec in EVENTS.items():
    github = spec["github"]
    for job, platform in (("deploy-android", "android"), ("deploy-ios", "ios")):
        label = f"{event}, {platform}, deploy step"
        stamped, error, context = run_deploy(event, spec, job, platform)
        if stamped is None:
            report(False, f"{label}: eas-deploy.sh runs with the workflow's env", error)
            continue
        expected_sha = (PR_SHA if event == "pull_request label" else SHA)[:7]
        expected_branch = github["head_ref"] or github["ref_name"]
        expected_source = ("release " + github["event"]["release"]["tag_name"]) if event == "release" else expected_branch
        for what, got, want in (
            ("stamps the commit the workflow builds (the PR head, not the merge commit)", stamped["commitSha"], expected_sha),
            ("stamps the branch, not the merge ref", stamped["branch"], expected_branch),
            ("stamps the sanitized source label", stamped["sourceLabel"], expected_source),
            ("stamps the event", stamped["event"], github["event_name"]),
            ("stamps the release tag only for a release", stamped["releaseTag"], github["event"].get("release", {}).get("tag_name", "")),
        ):
            report(got == want, f"{label}: {what}", f"got {got!r}, want {want!r}")

# The harness must notice when the workflow stops setting a variable the composer reads, so each one
# that the build info file does not supply is dropped in turn and the output must change.
spec = EVENTS["release"]
_, baseline, _, _ = run_composer("release", spec, "deploy-android", "android", 500)
for variable, marker in (("RUN_URL", "CI run:"), ("RELEASE_BODY", "Adds build info."), ("RELEASE_NAME", "Release notes (Version 1.1.0)")):
    code, notes, stderr, _ = run_composer("release", spec, "deploy-android", "android", 500, drop=variable)
    report(code == 0 and marker in baseline and marker not in notes,
           f"dropping {variable} from the workflow's env changes the notes", baseline + "\n--- without:\n" + notes + stderr)

# Dropping a variable the deploy step must set changes what is stamped, so the harness notices.
pr = EVENTS["pull_request label"]
base, _, _ = run_deploy("pull_request label", pr, "deploy-android", "android")
for variable, field in (("COMMIT_SHA", "commitSha"), ("SOURCE_LABEL", "sourceLabel")):
    without, error, _ = run_deploy("pull_request label", pr, "deploy-android", "android", drop=variable)
    report(base is not None and without is not None and without[field] != base[field],
           f"dropping {variable} from the deploy step's env changes what is stamped",
           f"with: {base and base[field]!r}  without: {without and without[field]!r} {error}")

print()
if failures:
    print(f"{failures} test(s) failed")
    sys.exit(1)
print("All tests passed")
