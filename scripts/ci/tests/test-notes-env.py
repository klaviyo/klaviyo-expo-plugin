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
        source_label = context["env"]["SOURCE_LABEL"]
        branch = github["head_ref"] or github["ref_name"]
        run_url = f"{github['server_url']}/{github['repository']}/actions/runs/{github['run_id']}"
        plugin_ref = "" if event == "release" else f" · {branch}@{expected_commit}"
        native = "Klaviyo iOS SDK —" if platform == "ios" else "Klaviyo Android SDK —"
        expected_lines = [
            ("the app line", "Expo Example 1.0.0 (21)"),
            ("the plugin line", f"Klaviyo Expo Plugin 1.0.0{plugin_ref}"),
            ("the React Native SDK line", "Klaviyo RN SDK 2.5.0"),
            ("the native SDK line", native),
            ("the commit line", f"Commit: {expected_commit} on {source_label} ({github['event_name']})"),
            ("the build date line", "Built: 2026-01-02 03:04 UTC"),
            ("the CI run line", f"CI run: {run_url}"),
        ]
        actual_lines = notes.rstrip("\n").split("\n")
        for index, (what, want) in enumerate(expected_lines):
            got = actual_lines[index] if index < len(actual_lines) else "(missing)"
            report(got == want, f"{label}: {what} is exactly {want!r}", f"got {got!r}")
        report(len(notes.rstrip("\n")) <= cap, f"{label}: the notes fit the {cap}-character cap", f"{len(notes.rstrip(chr(10)))} characters")
        body_lines = actual_lines[len(expected_lines):]
        if spec["expect_body"]:
            want_tail = ["", "Release notes (Version 1.1.0):", "Adds build info."]
            report(body_lines == want_tail, f"{label}: the release block is exactly the name and body", f"got {body_lines!r}")
        else:
            report(body_lines == [], f"{label}: nothing follows the header", f"got {body_lines!r}")

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
    context["project"] = project
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

def in_app_and_slack(project, platform):
    """The in-app values reach the app through eas.json env and app.config.js, a different path from the
    notes. Evaluates the real config the way the EAS server does and renders it through the real formatter."""
    env_block = json.load(open(os.path.join(project, "eas.json")))["build"]["production"]["env"]
    node_env = {"PATH": os.environ["PATH"], "EAS_BUILD": "true", "SDK_DIR": "/nonexistent",
                **{k: v for k, v in env_block.items() if k.startswith("APP_")},
                "IOS_BUILD_NUMBER": env_block.get("IOS_BUILD_NUMBER", ""), "ANDROID_VERSION_CODE": env_block.get("ANDROID_VERSION_CODE", "")}
    script = """
      const lib = require(process.argv[1]);
      const info = require("./app.config.js")().extra.buildInfo;
      const keys = ["expo-plugin", "rn", process.argv[2]];
      const sdks = info.sdks.filter((s) => keys.includes(s.key));
      const input = { ...info, appName: "Expo Example", buildNumber: process.argv[3], sdks };
      console.log(JSON.stringify({
        rows: lib.buildInfoRows(input),
        copy: lib.copyText(input),
        slack: lib.slackFields(input),
      }));
    """
    number = env_block.get("IOS_BUILD_NUMBER") or env_block.get("ANDROID_VERSION_CODE")
    result = subprocess.run(["node", "-e", script, os.path.join(ROOT, "example", "lib", "build-info.js"), platform, number],
                            capture_output=True, text=True, env=node_env, cwd=project)
    return json.loads(result.stdout) if result.returncode == 0 else None, result.stderr


for event, spec in EVENTS.items():
    github = spec["github"]
    for job, platform in (("deploy-android", "android"), ("deploy-ios", "ios")):
        label = f"{event}, {platform}, in-app and Slack"
        stamped, error, context = run_deploy(event, spec, job, platform)
        if stamped is None:
            report(False, f"{label}: eas-deploy.sh runs with the workflow's env", error)
            continue
        out, error = in_app_and_slack(context["project"], platform)
        if out is None:
            report(False, f"{label}: app.config.js and the formatter run on the stamped env", error)
            continue
        sha7 = (PR_SHA if event == "pull_request label" else SHA)[:7]
        branch = github["head_ref"] or github["ref_name"]
        source = context["env"]["SOURCE_LABEL"]
        plugin_ref = "" if event == "release" else f" · {branch}@{sha7}"
        native = f"Klaviyo {'iOS' if platform == 'ios' else 'Android'} SDK —"
        expected_rows = [
            {"label": "App", "value": "1.0.0 (21)"},
            {"label": "Klaviyo Expo Plugin", "value": "1.0.0" + plugin_ref},
            {"label": "Klaviyo RN SDK", "value": "2.5.0"},
            {"label": native.rsplit(" ", 1)[0], "value": "—"},
            {"label": "App commit", "value": f"{sha7} on {branch}"},
            {"label": "Built", "value": stamped["builtAt"]},
        ]
        report(out["rows"] == expected_rows, f"{label}: the in-app rows are exactly the expected rows",
               f"got {json.dumps(out['rows'], ensure_ascii=False)}\nwant {json.dumps(expected_rows, ensure_ascii=False)}")
        expected_copy = "\n".join([
            "Expo Example 1.0.0 (21)",
            f"Klaviyo Expo Plugin 1.0.0{plugin_ref}",
            "Klaviyo RN SDK 2.5.0",
            native,
            f"Commit: {sha7} on {source} ({github['event_name']})",
            f"Built: {stamped['builtAt']}",
        ])
        copy_lines = out["copy"].split("\n")
        for index, want in enumerate(expected_copy.split("\n")):
            got = copy_lines[index] if index < len(copy_lines) else "(missing)"
            report(got == want, f"{label}: copy line {index + 1} is exactly {want!r}", f"got {got!r}")
        report(len(copy_lines) == 6, f"{label}: the copy block has exactly six lines", out["copy"])
        short = "iOS" if platform == "ios" else "Android"
        expected_slack = {
            "build": "1.0.0 (21)",
            "sdks": f"Expo 1.0.0{plugin_ref} | RN 2.5.0 | {short} —",
            "source": f"{source} ({github['event_name']})",
        }
        report(out["slack"] == expected_slack, f"{label}: the Slack fields are exactly the expected fields",
               f"got {json.dumps(out['slack'], ensure_ascii=False)}\nwant {json.dumps(expected_slack, ensure_ascii=False)}")

        # The Slack message is laid out by slack-payload.sh from these fields and the full commit; compare it
        # line by line, since that script alone decides what the short SHA and the links look like.
        platform_label = "iOS" if platform == "ios" else "Android"
        destination = "TestFlight" if platform == "ios" else "Play internal"
        for result, headline in (
            ("success", f"→ {destination}"),
            ("failure", "deploy failed at EAS build or submit"),
        ):
            payload_file = os.path.join(context["runner"]["temp"], f"slack-{result}.json")
            slack_env = {
                "PATH": os.environ["PATH"], "RESULT": result, "PLATFORM": platform_label, "DESTINATION": destination,
                "BUILD": out["slack"]["build"], "SDKS": out["slack"]["sdks"], "SOURCE": out["slack"]["source"],
                "COMMIT_SHA": context["env"]["COMMIT_SHA"], "SERVER_URL": github["server_url"],
                "REPOSITORY": github["repository"], "RUN_ID": github["run_id"], "FAILED_STEP": "EAS build or submit",
                "GET_BUILD": "Open the app",
            }
            built = subprocess.run(["bash", os.path.join(ROOT, "scripts", "ci", "slack-payload.sh"), payload_file],
                                   capture_output=True, text=True, env=slack_env)
            if built.returncode != 0:
                report(False, f"{label}: slack-payload.sh builds the {result} message", built.stderr)
                continue
            message = json.load(open(payload_file))["blocks"][0]["text"]["text"].split("\n")
            full_sha = context["env"]["COMMIT_SHA"]
            repo_url = f"{github['server_url']}/{github['repository']}"
            icon = "✅" if result == "success" else "❌"
            expected_message = [f"{icon} *Expo Example ({platform_label})* {headline}", f"*Build:* {expected_slack['build']}"]
            if result == "success":
                expected_message.append(f"*SDKs:* {expected_slack['sdks']}")
            expected_message += [
                f"*Source:* {expected_slack['source']}",
                f"*Commit:* <{repo_url}/commit/{full_sha}|{full_sha[:7]}> · <{repo_url}/actions/runs/{github['run_id']}|CI run>",
            ]
            if result == "success":
                expected_message.append("*Get the build:* Open the app")
            for index, want in enumerate(expected_message):
                got = message[index] if index < len(message) else "(missing)"
                report(got == want, f"{label}: {result} message line {index + 1} is exactly {want!r}", f"got {got!r}")
            report(len(message) == len(expected_message), f"{label}: the {result} message has exactly {len(expected_message)} lines", "\n".join(message))

# A release body long enough to hit each platform's cap: the notes must come out at exactly the cap, with
# the marker last and the header lines untouched, so an off-by-one in the cap is visible.
long_release = json.loads(json.dumps(EVENTS["release"]))
long_release["github"]["event"]["release"]["body"] = "Adds build info. " * 400
for job, platform, cap in (("deploy-android", "android", 500), ("deploy-ios", "ios", 4000)):
    code, notes, stderr, _ = run_composer("release", long_release, job, platform, cap)
    text = notes.rstrip("\n")
    report(code == 0 and len(text) == cap and text.endswith("…[truncated]"),
           f"a long release body is cut to exactly the {platform} cap of {cap} characters, marker last",
           f"length {len(text)}, ends {text[-24:]!r} {stderr}")
    header = text.split("\n\nRelease notes")[0].split("\n")
    report(len(header) == 7 and header[5].startswith("Built: ") and header[6].startswith("CI run: "),
           f"{platform}: the seven header lines survive the cut", "\n".join(header))

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
