#!/usr/bin/env python3
"""Static checks for shell code that must also run under stock macOS /bin/bash 3.2.

The runner has bash 5, so CI cannot catch these by running the scripts. Prints one PASS/FAIL line per
case and exits 1 if any case fails.

  - no mapfile, readarray, associative arrays, case-conversion expansions or |&
  - no GNU-only or BSD-only flags (mktemp -p, date -d, readlink -f, stat -c, sed -i without an attached suffix (including sed -i ''), grep -P),
    in the scripts and in the workflow and action run blocks; each pattern is also checked against a bad sample
  - an array that can be empty is not expanded as "${name[@]}" under set -u, because 3.2 reports an empty
    array as unbound. The safe form is ${name[@]+"${name[@]}"}.
"""

import glob
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
FILES = sorted(glob.glob(os.path.join(ROOT, "scripts", "ci", "*.sh")) + glob.glob(os.path.join(ROOT, "scripts", "ci", "tests", "*.sh")))
FORBIDDEN = {
    "mapfile": r"\bmapfile\b",
    "readarray": r"\breadarray\b",
    "associative array": r"\bdeclare\s+-A\b",
    "case conversion": r"\$\{[A-Za-z_][A-Za-z0-9_]*(,,|\^\^)\}",
    "|&": r"\|&",
}
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


def code_lines(path):
    """Yields (line number, text) without comment-only lines."""
    with open(path) as handle:
        for number, line in enumerate(handle, 1):
            if not line.lstrip().startswith("#"):
                yield number, line.rstrip("\n")


for label, pattern in FORBIDDEN.items():
    hits = [f"{os.path.relpath(p, ROOT)}:{n}: {text.strip()}" for p in FILES for n, text in code_lines(p) if re.search(pattern, text)]
    report(not hits, f"no {label} in the shell scripts (bash 3.2 does not have it)", "\n".join(hits))

PORTABILITY = {
    "mktemp -p (use the template form)": (r"\bmktemp\b[^|;&]*\s-p\b", 'mktemp -d -p "$TMPDIR"'),
    "date -d / --date (GNU only)": (r"\bdate\s+(-d|--date)\b", 'date -d "@123" +%s'),
    "readlink -f (GNU only)": (r"\breadlink\s+-f\b", 'readlink -f "$0"'),
    "stat -c (GNU only)": (r"\bstat\s+-c\b", "stat -c %s file"),
    "sed -i without a suffix argument": (r"\bsed\s+(-[A-Za-z]*\s+)*-i(?![.A-Za-z0-9_])", "sed -i s/a/b/ file"),
    "sed -i '' (BSD only; use -i.bak)": (r"\bsed\s+(-[A-Za-z]*\s+)*-i(?![.A-Za-z0-9_])", "sed -i '' s/a/b/ file"),
    "grep -P (GNU only)": (r"\bgrep\s+(-[A-Za-z]+\s+)*-[A-Za-z]*P", "grep -oP 'a\\K.*' file"),
}
PORTABILITY_FILES = FILES + sorted(
    glob.glob(os.path.join(ROOT, ".github", "workflows", "publish-example*.yml")) + glob.glob(os.path.join(ROOT, ".github", "actions", "*", "action.yml"))
)
for label, (pattern, sample) in PORTABILITY.items():
    report(re.search(pattern, sample) is not None, f"the {label} rule matches a known-bad sample")
    hits = [
        f"{os.path.relpath(p, ROOT)}:{n}: {text.strip()}"
        for p in PORTABILITY_FILES
        if os.path.abspath(p) != os.path.abspath(__file__)
        for n, text in code_lines(p)
        if re.search(pattern, text)
    ]
    report(not hits, f"no {label} in scripts, workflows or actions", "\n".join(hits))

# An array that is initialised empty can still be empty when it is expanded. Flag each unguarded expansion
# of such an array, unless a length check on the same array precedes it in the file.
EMPTY_INIT = re.compile(r"^\s*(?:local\s+)?([A-Za-z_][A-Za-z0-9_]*)=\(\)")
EXPANSION = re.compile(r'(?<!\+)"\$\{([A-Za-z_][A-Za-z0-9_]*)\[@\]\}"')
problems = []
for path in FILES:
    lines = list(code_lines(path))
    emptyable = {}
    for number, text in lines:
        match = EMPTY_INIT.match(text)
        if match:
            emptyable[match.group(1)] = number
    for number, text in lines:
        for match in EXPANSION.finditer(text):
            name = match.group(1)
            if name not in emptyable or number <= emptyable[name]:
                continue
            checked = any(re.search(rf"\$\{{#{name}\[@\]\}}", earlier) for n, earlier in lines if emptyable[name] < n < number)
            if not checked:
                problems.append(f"{os.path.relpath(path, ROOT)}:{number}: \"${{{name}[@]}}\" may be empty")
report(not problems, 'no empty-able array is expanded as "${name[@]}" without a length check', "\n".join(problems))

print()
if failures:
    print(f"{failures} test(s) failed")
    sys.exit(1)
print("All tests passed")
