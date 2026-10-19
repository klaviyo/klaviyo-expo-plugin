# Example App Publishing

## Overview

`.github/workflows/publish-example.yml` builds the example app on EAS and submits it to the Play Store internal track and TestFlight. It runs on every push to `master` or a `rel/**` branch, whenever a GitHub release is published, on demand through `workflow_dispatch`, and when a deploy label is added to a pull request. Until the `EXPO_TOKEN` secret and the `KLAVIYO_EAS_PROJECT_ID` variable exist, the workflow skips with a warning.

A run is never cancelled once it starts. A push waits for the in-flight run on the same branch, and a newer queued push replaces an older queued one, so quick merges deploy the latest commit without wasting builds. Cancelling would leave the EAS build running on Expo's servers, unsupervised and using a build number, with no submit step to follow it. Release, manual and label runs queue on their own.

EAS compiles and signs both platforms on Expo's infrastructure. The GitHub runners only start the build, wait for it, and submit the result with `eas submit`, so there is no macOS job and no signing material in this repo.

Each platform deploys in its own job, in a GitHub environment (`android-internal-track` and `testflight`), so the repo's Deployments page lists every deploy with a link to the build in the store. The environments have no protection rules and no secrets of their own. The repo secrets below still apply.

After each deploy, a second job sets the store release notes: `what-to-test` for TestFlight and `android-notes` for Play. A failure there leaves the build on the store without notes and posts a separate Slack warning.

`.github/workflows/publish-example-checks.yml` holds the checks: the plugin's type check and jest suite, and the example app's type check. It runs on pull requests that touch the publish files or `example/`, and `publish-example.yml` calls it as its `checks` job. Both deploy jobs `need` that job, so a failing check means nothing reaches a store, label deploys included. It uses no secrets and makes no store or EAS calls.

### Deploying a pull request

Add a label to a pull request to deploy its head commit before merging:

- `deploy-example-app`: both platforms
- `deploy-example-app:android`: Android only
- `deploy-example-app:ios`: iOS only

A cleanup job removes the label when the run ends, so adding it again deploys again. Label deploys use the same store tracks as every other deploy, so only internal testers see them. Each deploy uses one EAS build per platform and counts against the Expo plan's build allowance, so keep label deploys for changes that need a store build to verify.

### Switching it off

Deploys are skipped, not failed, until the required secrets exist. One `preflight` job checks the required secrets and variables for the platforms that were asked for and prints their names, never their values. A push or a published release with something missing skips that platform with a notice naming the missing names. A `workflow_dispatch` or a label deploy with something missing fails, because a person asked for the deploy and a green skip would read as success. The notes jobs skip along with the deploy, and the label cleanup still runs. Store secrets must be repository secrets, not environment secrets; the preflight cannot see environment secrets and would skip forever. The preflight job declares no environment, and the deploy jobs declare one only for the store link and deploy history, so put no required reviewers on the `android-internal-track` and `testflight` environments.

---

## Required GitHub secrets

Create all of these as repository secrets and variables. The Android preflight checks `EXPO_TOKEN`, `SERVICE_ACCOUNT_JSON` and `KLAVIYO_EAS_PROJECT_ID`. The iOS preflight checks `EXPO_TOKEN`, the three `APP_STORE_CONNECT_API_KEY_*` secrets, `KLAVIYO_EAS_PROJECT_ID`, `APPLE_TEAM_ID` and `ASC_APP_ID`.

| Secret | Description |
|--------|-------------|
| `EXPO_TOKEN` | Access token for an Expo robot user with access to the `klaviyo` account |
| `SLACK_WEBHOOK_URL` | Optional. Incoming webhook for deploy notifications. When it is empty the Slack steps skip quietly |
| `SERVICE_ACCOUNT_JSON` | Google Play service account key (JSON contents). Used for the versionCode preflight and to set the Play release notes, so it needs release permissions on the app |
| `APP_STORE_CONNECT_API_KEY_KEY_ID` | App Store Connect API key ID |
| `APP_STORE_CONNECT_API_KEY_ISSUER_ID` | App Store Connect API issuer ID |
| `APP_STORE_CONNECT_API_KEY_KEY` | App Store Connect API private key (`.p8`, raw PEM or base64). Used for the build number preflight and to set What to Test, so the key needs at least the App Manager role |

The two Apple key names and `SERVICE_ACCOUNT_JSON` match the other Klaviyo test apps, so one key can serve all of them.

## Required GitHub variables

These are not secret.

| Variable | Description |
|----------|-------------|
| `KLAVIYO_EAS_PROJECT_ID` | EAS project ID for `klaviyo/klaviyo-plugin-example` |
| `APPLE_TEAM_ID` | Apple Developer team that signs the app |
| `ASC_APP_ID` | App Store Connect app ID for `com.klaviyo.expoexample`. The workflow writes it into `eas.json` at build time, since non-interactive iOS submits need it |

---

## EAS setup

Credentials are EAS-hosted. Signing keys, provisioning profiles and the store submit keys live on expo.dev, and CI only holds the access token.

1. Create the EAS project, then set `KLAVIYO_EAS_PROJECT_ID` and `APPLE_TEAM_ID` as EAS environment variables in the `production` environment too. EAS build servers evaluate `example/app.config.js` again and cannot see GitHub variables.
2. Run `eas credentials` from `example/` to generate or upload the Android upload keystore, the iOS distribution certificate, and provisioning profiles for `com.klaviyo.expoexample` and `com.klaviyo.expoexample.KlaviyoNotificationServiceExtension`.
3. Add submit credentials on EAS: a Google Play service account key and an App Store Connect API key.
4. Upload `google-services.json` as an EAS file environment variable named `GOOGLE_SERVICES_JSON` in the `production` environment.
5. Create the Play Console app and the App Store Connect app record. Play only accepts API uploads after the first bundle has been uploaded by hand.

---

## Build numbers

`example/eas.json` sets `cli.appVersionSource` to `local` and turns `autoIncrement` off. CI picks the numbers from the stores and passes them to the build, because EAS's remote counter is keyed by app and bundle ID only and cannot restart per marketing version.

- iOS: `scripts/ci/next-build-number.js ios` asks App Store Connect for the highest build number uploaded for the current marketing version and uses one above it, or 1 if that version has no builds. Numbering restarts at 1 for each new marketing version and increases within it. The marketing version is the plugin's `X.Y.Z` from the root `package.json`, so every prerelease of one version shares one build number sequence.
- Android: `scripts/ci/next-build-number.js android` asks the Play Developer API for the highest versionCode across all bundles and tracks and uses one above it. The versionCode is global and never restarts.

`scripts/ci/eas-deploy.sh` writes the number into the `production` profile's `env` in `example/eas.json` as `IOS_BUILD_NUMBER` or `ANDROID_VERSION_CODE`, and `app.config.js` reads it. EAS build servers cannot see GitHub environment variables, but they do build the checked-out working tree, so the edit reaches them. The edit exists only on the runner and is never committed. For local builds both numbers default to 1.

`scripts/ci/eas-deploy.sh` guards against two runs taking the same number:

1. After the build, before the submit, it asks the store again. If another run (for example a `rel/**` push and a release published from it) took the number, it rebuilds with the next free one. A failing re-check is a warning and the submit goes ahead.
2. If the store still rejects the upload as a duplicate, `eas submit` does not retry, because the number is baked into the binary. The script rebuilds with the larger of the store's reported previous number plus one and the current number plus one. It gives up after 3 attempts.

If the first store query fails, the deploy stops before building, so a guessed number cannot burn several EAS builds on conflicts.

---

## Release notes

`scripts/ci/release-notes.sh` renders the same header for both stores from the formatter in `example/lib/build-info.js`, which the app also uses, so the in-app "Copy build info" text matches the notes:

```
Expo Example <full version> (<build>)
Klaviyo Expo Plugin <version> · <ref>
Klaviyo RN SDK <version>
Klaviyo <iOS|Android> SDK <version>
Commit: <sha7> on <source> (<event>)
Built: <YYYY-MM-DD HH:MM UTC>
CI run: <url>
```

The SDK lines cover what is compiled into that platform's binary: the plugin, the React Native SDK, and the native SDK for that platform. A line shows ` · <ref>` only when the ref differs from the version. The plugin ref is the bare version for a release and `<branch>@<sha7>` otherwise. A missing value renders as a dash. On `release: published` the release name and body follow the header.

- TestFlight: the `what-to-test` job waits for Apple to finish processing the build, then sets What to Test through the App Store Connect API (`scripts/ci/asc-whats-new.js`). The cap is 4000 characters.
- Play: `eas submit` has no Android release notes option, so the `android-notes` job calls the Play Developer API (`scripts/ci/play-release-notes.js`) to set en-US notes and the release name on the internal track. The cap is 500 characters.

When the text is over the cap, the release body is cut first, then the CI run line. The other header lines are never cut, and every cut ends with `…[truncated]`. Characters are counted as code points. The deploy jobs render the notes once, after the dependencies are installed, and the notes jobs download the file.

---

## Slack message

```
✅ Expo Example (iOS) → TestFlight
Build: <full version> (<build>)
SDKs: Expo <version> · <ref> | RN <version> | iOS <version>
Source: <source label> (<event>)
Commit: <sha7, linked> · <CI run, linked>
Get the build: <login-gated store link and how to become a tester>
```

A failed deploy posts `❌ Expo Example (<platform>) deploy failed at <step>` with the commit and CI run. A failure to set the store notes posts a separate ⚠️ message and does not fail the run. The source label is reduced to characters that are safe in a Slack payload. The commit is the pull request head for label deploys.

## Build info in the app

The Profile tab (the home tab) has an ⓘ button in its header. It opens the Build info modal: the app version and build number, one row for each SDK compiled into the running binary (the plugin, the React Native SDK, and the native SDK for the platform), the commit and branch, and the build time. "Copy build info" copies the same header the store notes use. `example/app.config.js` collects the values, reading the SDK versions from the installed `klaviyo-react-native-sdk`, and CI stamps the commit, branch, build time and release tag through the build env. A value that is not available shows a dash.

---

## Getting a build as a tester

TestFlight has no public install link without Beta App Review, and the Play internal track admits only listed testers, so builds go to internal testers. To get access, ask in `#mobile-push-team` to be added to the internal TestFlight group (with your Apple ID email) or the Play internal testers list (with your Google account email). The Slack deploy message links to the app in the store and names the version and build number to install. The links only open for people who are already testers.

Slack never posts EAS internal-distribution, build page or artifact download links.

---

## Public build logs

This repo is public, so anyone can read the Actions logs.

- Secrets reach steps only through `env`, and no step runs with `set -x` or prints the environment.
- `scripts/ci/eas-deploy.sh` redacts EAS artifact URLs from everything EAS writes to the log.
- Slack only gets links that need a store login.

Do not add steps that print environment variables, upload signed artifacts, or post public TestFlight links.

---

## Debugging common failures

### The workflow skips with a warning

`EXPO_TOKEN` or `KLAVIYO_EAS_PROJECT_ID` is unset. Add them and re-run.

### "Increment Build Number" or a duplicate build number on submit

See [Build numbers](#build-numbers). If the retries are exhausted, re-run the workflow, which asks the store for a fresh number.

### The "What to Test" or Play notes job failed

The build is already in the store and only its notes are missing. Common causes are an API key without the App Manager role, a Play service account without release permissions, or Apple taking more than 45 minutes to process the build. Re-run the failed job from the Actions UI, or set the notes by hand in the store console.

### iOS submit asks for credentials

`eas submit` runs non-interactively, so the App Store Connect API key must already be stored on EAS and `ASC_APP_ID` must be set.

---

## Pinned actions

Every `uses:` in the workflows and composite actions is pinned to a full commit SHA, with the version in a comment. `.github/dependabot.yml` lists the workflows directory and `/.github/actions/*`, so the composite actions are covered too, and opens one grouped PR a month to update them. EAS CLI is pinned to a major version in `.github/actions/setup-eas/action.yml`.

## Manual trigger

To deploy without pushing a commit:

```bash
gh workflow run publish-example.yml --ref master
```

Add `-f platform=android` or `-f platform=ios` to publish one platform.

---

## Differences from the native test apps

EAS builds and signs on Expo's servers, so some pieces of the native workflows do not apply here.

- No Internal App Sharing link: `eas submit` uploads to the internal track and offers no sharing upload. Slack links the build's per-release Play URL (`play.google.com/apps/test/<package>/<versionCode>`) instead, which works for the same internal testers.
- No keystore or signing key cleanup steps: signing material lives on EAS and never reaches the runner. CI holds only `EXPO_TOKEN` and the store API keys, and they are passed through `env` for the steps that need them. No step writes them to disk.
- Concurrency never cancels a started run. See [Overview](#overview).
- Android release notes are set after the submit through the Play Developer API, since `eas submit` has no notes option. iOS notes go through the App Store Connect API in their own job, as in the iOS test app.
- The Slack message has no EAS build page link. The layout is shared across the example apps and has no slot for it, so the build page URL stays in the job log, where only the job output reaches it.

## App version

CI derives the app version from the plugin version in the root `package.json` (`X.Y.Z`) and the build number:

| Trigger | App version |
| --- | --- |
| `release: published` | `X.Y.Z` |
| Push to `rel/**` | `X.Y.Z-rc.<build number>` |
| Anything else | `X.Y.Z-alpha.<build number>` |

Android uses the full string as `versionName`. iOS `CFBundleShortVersionString` is plain `X.Y.Z` because Apple allows only integers there, and the full string goes in the `KlaviyoAppVersion` Info.plist key. The in-app build info, the release notes and the Slack message show the full string. The run fails if the plugin version is not `X.Y.Z`. Local builds use `1.0.0`.

`scripts/ci/eas-deploy.sh` derives the version after the build number is known and again whenever a duplicate-number or re-check retry changes the number, then writes it to the `production` profile `env` as `APP_VERSION`.

`scripts/bump-version.js` bumps the plugin version, which is the base of the app version. It accepts only `X.Y.Z`.
