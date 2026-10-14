# Example App Publishing

## Overview

`.github/workflows/publish-example.yml` builds the example app on EAS and submits it to the Play Store internal track and TestFlight. It runs on every push to `master` or a `rel/**` branch, whenever a GitHub release is published, on demand through `workflow_dispatch`, and when a deploy label is added to a pull request. Until the `EXPO_TOKEN` secret and the `KLAVIYO_EAS_PROJECT_ID` variable exist, the workflow skips with a warning.

A run is never cancelled once it starts. A push waits for the in-flight run on the same branch, and a newer queued push replaces an older queued one, so quick merges deploy the latest commit without wasting builds. Cancelling would leave the EAS build running on Expo's servers, unsupervised and using a build number, with no submit step to follow it. Release, manual and label runs queue on their own.

EAS compiles and signs both platforms on Expo's infrastructure. The GitHub runners only start the build, wait for it, and submit the result with `eas submit`, so there is no macOS job and no signing material in this repo.

Each platform deploys in its own job, in a GitHub environment (`android-internal-track` and `testflight`), so the repo's Deployments page lists every deploy with a link to the build in the store. The environments have no protection rules and no secrets of their own. The repo secrets below still apply.

After each deploy, a second job sets the store release notes: `what-to-test` for TestFlight and `android-notes` for Play. A failure there leaves the build on the store without notes and posts a separate Slack warning.

`.github/workflows/publish-example-checks.yml` runs on pull requests that touch the workflow, the composite actions or `scripts/ci/`. It runs actionlint and shellcheck, checks `example/eas.json`, and unit-tests the scripts. It uses no secrets and makes no store or EAS calls.

### Deploying a pull request

Add a label to a pull request to deploy its head commit before merging:

- `deploy-example-app`: both platforms
- `deploy-example-app:android`: Android only
- `deploy-example-app:ios`: iOS only

A cleanup job removes the label when the run ends, so adding it again deploys again. Label deploys use the same store tracks as every other deploy, so only internal testers see them. Each deploy uses one EAS build per platform. Expo's free plan limits build credits per month, so keep label deploys for changes that need a store build to verify.

### Switching it off

The workflow skips with a warning until the `EXPO_TOKEN` secret and the `KLAVIYO_EAS_PROJECT_ID` variable exist. Removing either one switches publishing off again without a code change.

---

## Required GitHub secrets

| Secret | Description |
|--------|-------------|
| `EXPO_TOKEN` | Access token for an Expo robot user with access to the `klaviyo` account |
| `SLACK_WEBHOOK_URL` | Incoming webhook for deploy notifications |
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

- iOS: `scripts/ci/next-build-number.js ios` asks App Store Connect for the highest build number uploaded for the current marketing version (`version` in `example/app.config.js`) and uses one above it, or 1 if that version has no builds. Numbering restarts at 1 for each new marketing version and increases within it.
- Android: `scripts/ci/next-build-number.js android` asks the Play Developer API for the highest versionCode across all bundles and tracks and uses one above it. The versionCode is global and never restarts.

`scripts/ci/set-build-env.sh` writes the number into the `production` profile's `env` in `example/eas.json` as `IOS_BUILD_NUMBER` or `ANDROID_VERSION_CODE`, and `app.config.js` reads it. EAS build servers cannot see GitHub environment variables, but they do build the checked-out working tree, so the edit reaches them. The edit exists only on the runner and is never committed. For local builds both numbers default to 1.

`scripts/ci/eas-deploy.sh` guards against two runs taking the same number:

1. After the build, before the submit, it asks the store again. If another run (for example a `rel/**` push and a release published from it) took the number, it rebuilds with the next free one. A failing re-check is a warning and the submit goes ahead.
2. If the store still rejects the upload as a duplicate, `eas submit` does not retry, because the number is baked into the binary. The script rebuilds with the larger of the store's reported previous number plus one and the current number plus one. It gives up after 3 attempts.

If the first store query fails, the deploy stops before building, so a guessed number cannot burn several EAS builds on conflicts.

The marketing version is bumped by `scripts/bump-version.js`, which also updates `example/app.config.js`.

---

## Release notes

`scripts/ci/release-notes.sh` writes the same text for both stores: app version and build number, the plugin and `klaviyo-react-native-sdk` versions, the commit SHA and subject, the ref and trigger, the build date, and a link to the CI run. On `release: published` the release name and body follow.

- TestFlight: the `what-to-test` job waits for Apple to finish processing the build, then sets What to Test through the App Store Connect `betaBuildLocalizations` API (`scripts/ci/asc-whats-new.js`). The text is capped at 4000 characters.
- Play: `eas submit` has no Android release notes option, so the `android-notes` job calls the Play Developer API (`scripts/ci/play-release-notes.js`) to set en-US notes and the release name on the internal track. The text is capped at 500 characters.

---

## Slack message

Each deploy posts the version and build number, the plugin and `klaviyo-react-native-sdk` versions, the source (branch or release tag, reduced to Slack-safe characters), the commit, the author, the CI run, and a "Get the build" line with a store link that needs a login (the TestFlight app page or the Play testers URL). It also links the EAS build page, which only members of the Expo account can open. A separate warning posts when the store notes could not be set.

## Build info in the app

The main screen of the example app shows the plugin version, the `klaviyo-react-native-sdk` version and the commit SHA. `example/app.config.js` reads the versions from `package.json` and the installed package, and the commit from `APP_COMMIT_SHA`, which CI writes into the build env. Local builds show `local`.

---

## Getting a build as a tester

TestFlight has no public install link without Beta App Review, and the Play internal track admits only listed testers, so builds go to internal testers. To get access, ask in `#mobile-push-team` to be added to the internal TestFlight group (with your Apple ID email) or the Play internal testers list (with your Google account email). The Slack deploy message links to the app in the store and names the version and build number to install. The links only open for people who are already testers.

Slack also links the EAS build page on expo.dev, which only members of the Expo account can open. It never posts EAS internal-distribution or artifact download links.

---

## Public build logs

This repo is public, so anyone can read the Actions logs.

- Secrets reach steps only through `env`, and no step runs with `set -x` or prints the environment.
- `scripts/ci/eas-deploy.sh` redacts EAS artifact URLs from everything EAS writes to the log.
- Slack only gets links that need a store or Expo login.

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

Every `uses:` in the workflows and composite actions is pinned to a full commit SHA, with the version in a comment. `.github/dependabot.yml` opens one grouped PR a month to update them. EAS CLI is pinned to a major version in `.github/actions/setup-eas/action.yml`.

## Manual trigger

To deploy without pushing a commit:

```bash
gh workflow run publish-example.yml --ref master
```

Add `-f platform=android` or `-f platform=ios` to publish one platform.

---

## Differences from the native test apps

EAS builds and signs on Expo's servers, so some pieces of the native workflows do not apply here.

- No Internal App Sharing link: `eas submit` uploads to the internal track and offers no sharing upload. Slack links the Play testers URL instead.
- No keystore or signing key cleanup steps: signing material lives on EAS and never reaches the runner. CI holds only `EXPO_TOKEN` and the store API keys, and they are passed through `env` for the steps that need them. No step writes them to disk.
- Concurrency never cancels a started run. See [Overview](#overview).
- Android release notes are set after the submit through the Play Developer API, since `eas submit` has no notes option. iOS notes go through the App Store Connect API in their own job, as in the iOS test app.
