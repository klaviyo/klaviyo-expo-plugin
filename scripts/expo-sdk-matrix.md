# Expo SDK test matrix

`expo-sdk-matrix.json` is the single source of truth for the Expo SDK pairings this plugin is
tested against. Both consumers read it directly, so the matrix cannot drift between them:

- `.github/workflows/ci.yml` — the `sdk-matrix` job emits it and `test-peer-dependencies`
  consumes it via `fromJSON`.
- `scripts/test-peer-dependencies.js` — requires it for the same run locally.

## Fields

| Field | Meaning |
| --- | --- |
| `sdk` | Expo SDK major, used for job names |
| `react` / `reactNative` | The versions Expo actually ships with that SDK |
| `expo` | The range to install |
| `supported` | Whether README declares this SDK supported. Drives `continue-on-error` in CI: `false` rows report failures without gating the merge. |

## Rules

**Use only real Expo-shipped pairings.** Take `react` and `reactNative` from
`https://api.expo.dev/v2/versions/latest` (`facebookReactVersion` /
`facebookReactNativeVersion`). A combination Expo never shipped tests nothing a customer can hit.

**`supported: false` rows are intentional, and non-blocking.** The matrix is deliberately wider
than the support statement: README declares 54–57 supported, and CI additionally covers 52 and 53
because they were verified to build and launch. Those rows carry `continue-on-error`, so a
regression on them is *visible* without gating a merge on an SDK the project explicitly disclaims.
Supported rows (54+) fail the build as normal.

**SDK 50/51 are absent on purpose.** `plugin/support/sdkSupport.ts` warns that their native
build fails, but that failure is an Android/Gradle resolution failure. This job only installs
the pairing and runs the plugin's own unit tests and `tsc`, so a 50/51 row would pass here and
prove nothing. Covering that tier needs a native Android build, which this workflow does not do.
