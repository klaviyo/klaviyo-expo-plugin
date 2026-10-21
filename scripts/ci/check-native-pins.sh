#!/usr/bin/env bash
# Fails unless every Klaviyo SDK dependency is a released version: no git URL,
# GitHub shorthand, branch, local path, link or tarball for klaviyo-react-native-sdk,
# and no Klaviyo pod sourced from :git/:branch/:commit/:tag/:path in the podspec
# or in a pod line the config plugin writes.
#
# Usage: check-native-pins.sh [root]   (root defaults to the current directory)
set -euo pipefail

root="${1:-.}"
errors=()

for pkg in package.json example/package.json; do
  [ -f "$root/$pkg" ] || continue
  # shellcheck disable=SC2016
  specs="$(node -e '
    const p = require(require("path").resolve(process.argv[1]));
    for (const s of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      const v = p[s] && p[s]["klaviyo-react-native-sdk"];
      if (v) console.log(`${s}\t${v}`);
    }' "$root/$pkg")"
  while IFS=$'\t' read -r section spec; do
    [ -n "$section" ] || continue
    if [[ "$spec" =~ ^(git\+|git:|github:|gitlab:|bitbucket:|file:|link:|https?:|/|\.|~) ]] \
      || [[ "$spec" == *"#"* ]] || [[ "$spec" == *.tgz ]] || [[ "$spec" == *.tar.gz ]] \
      || [[ "$spec" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
      line="$(grep -n '"klaviyo-react-native-sdk"' "$root/$pkg" | head -1 | cut -d: -f1)"
      errors+=("${pkg}:${line}: klaviyo-react-native-sdk (${section}) is '${spec}', not a released version")
    fi
  done <<<"$specs"
done

pin_pattern="^[[:space:]]*(s\.dependency|pod)[[:space:]]+['\"]Klaviyo[A-Za-z]*['\"].*:(git|branch|commit|tag|path)[[:space:]]*=>"
while IFS= read -r hit; do
  errors+=("${hit#"$root"/}: Klaviyo pod not from a release")
done < <(grep -rnE "$pin_pattern" "$root/ios" --include='*.podspec' 2>/dev/null || true)
while IFS= read -r hit; do
  errors+=("${hit#"$root"/}: Klaviyo pod not from a release")
done < <(grep -rnE "pod[[:space:]]+['\"]Klaviyo[A-Za-z]*['\"][^\"\`]*:(git|branch|commit|tag|path)[[:space:]]*=>" "$root/plugin" --include='*.ts' 2>/dev/null || true)

if [ "${#errors[@]}" -gt 0 ]; then
  for e in "${errors[@]}"; do
    echo "::error::${e}"
  done
  echo "::error::Revert the pin and bump to released SDK versions before releasing."
  exit 1
fi

echo "Klaviyo SDK dependencies are released versions."
