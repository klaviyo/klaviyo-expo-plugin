#!/usr/bin/env python3
"""Writes each `run:` block of a composite action to its own .sh file so shellcheck can lint it.

actionlint parses every file as a workflow, so it cannot lint composite actions and nothing else reads the
shell inside them. Expressions in ${{ }} are replaced by a placeholder, as the runner does before the shell
sees the text.

Usage: extract-action-runs.py <action.yml> <output dir>   (prints the number of blocks written)
"""
import re, sys, os
src, out = sys.argv[1], sys.argv[2]
lines = open(src).read().split("\n")
n = 0
i = 0
while i < len(lines):
    m = re.match(r"^(\s*)(?:- )?run:\s*(.*)$", lines[i])
    if not m:
        i += 1
        continue
    indent = len(m.group(1)) + (2 if lines[i].lstrip().startswith("- ") else 0)
    rest = m.group(2)
    block = []
    if rest in ("|", ">", "|-", ">-"):
        j = i + 1
        while j < len(lines) and (not lines[j].strip() or len(lines[j]) - len(lines[j].lstrip()) > indent):
            block.append(lines[j])
            j += 1
        i = j
    else:
        block = [rest]
        i += 1
    cut = min((len(l) - len(l.lstrip()) for l in block if l.strip()), default=0)
    body = "\n".join(l[cut:] for l in block)
    # ${{ }} expressions are replaced by a placeholder, as the runner does before the shell sees the text
    body = re.sub(r"\$\{\{.*?\}\}", "EXPR", body, flags=re.S)
    n += 1
    with open(os.path.join(out, f"{os.path.basename(os.path.dirname(src))}-{n}.sh"), "w") as handle:
        handle.write("#!/usr/bin/env bash\nset -e\n" + body + "\n")
print(n)
