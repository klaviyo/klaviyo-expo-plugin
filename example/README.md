# Klaviyo Expo Plugin Example

This is a minimal example app that demonstrates how to use the Klaviyo Expo Plugin from the parent repository. It serves as a reference implementation for integrating the plugin into an Expo project.

## Purpose

This example app exists to:
- Demonstrate the plugin's configuration and setup process
- Show how the plugin integrates with Expo's prebuild system
- Provide a simple test environment for plugin development

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npx expo start --dev-client
```

3. Run on Android:
```bash
npx expo run:android
```

4. Run on iOS:
```bash
npx expo run:ios
```

## Plugin Integration

The plugin is integrated through:
- `package.json`: References the parent plugin via `"klaviyo-expo-plugin": "file:../"`
- `app.json`: Includes the plugin in the Expo configuration
- `_layout.tsx`: Contains the minimal app implementation

## Project Structure

```
example/
├── app/                 # App source code
│   └── _layout.tsx     # Main app component
├── assets/             # App assets
├── app.json           # Expo configuration
└── package.json       # Dependencies and scripts
```

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
    npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)


You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

You can also run the following to create a new android / ios build (useful after plugin configuration)
```bash
npm run clean-androoid
npm run clean-ios
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Continuous deployment

`.github/workflows/publish-example.yml` builds this app on EAS and submits it to the Play Store internal testing track and TestFlight. It runs on pushes to `master` and `rel/**`, on `release: published`, and by hand through `workflow_dispatch`. Until `EXPO_TOKEN` and `KLAVIYO_EAS_PROJECT_ID` are set, the workflow skips with a warning.

Signing credentials are EAS-hosted. The Android keystore, iOS distribution certificate and provisioning profiles (app and `KlaviyoNotificationServiceExtension`), and the store submit keys all live on expo.dev. CI only holds an Expo access token.

Build numbers (`android.versionCode`, `ios.buildNumber`) come from EAS's remote counter (`cli.appVersionSource: "remote"` and `build.production.autoIncrement: true` in `eas.json`), so every EAS build gets a higher number than the last. If a store still rejects an upload as a duplicate, because the counter fell behind builds uploaded outside EAS, `scripts/ci/eas-deploy.sh` rebuilds with the next number and resubmits, up to 3 attempts. Run `eas build:version:set` once to move the counter past any existing store build.

Every deploy's store notes start with the plugin version, the `klaviyo-react-native-sdk` version, the short commit SHA and the UTC build date (`scripts/ci/release-notes.sh`). For `release: published` the GitHub release body follows. iOS notes go to TestFlight "What to Test" through `eas submit --what-to-test`. `eas submit` has no Android release notes option, so `scripts/ci/play-release-notes.js` sets them through the Play Developer API.

Slack messages link to the GitHub Actions run and to the EAS build page (visible only to members of the Expo account). They don't include binary or internal-distribution links because this repo is public. Testers install through the Play internal testing track or TestFlight, and only testers added in the store consoles get access.

### One-time setup

GitHub repository secrets:

- `EXPO_TOKEN`: Expo robot user access token with access to the `klaviyo` account.
- `SLACK_WEBHOOK_URL`: incoming webhook for the publish notification channel.
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: Play service account key, used only to set Android release notes. Without it the Android deploy still runs and logs a warning.

GitHub repository variables (not secret):

- `KLAVIYO_EAS_PROJECT_ID`: EAS project ID for `klaviyo/klaviyo-plugin-example`.
- `APPLE_TEAM_ID`: Apple Developer team ID that signs the app.
- `ASC_APP_ID`: App Store Connect app ID for `com.klaviyo.expoexample`.

EAS (expo.dev) setup:

- Create the project and set `KLAVIYO_EAS_PROJECT_ID` and `APPLE_TEAM_ID` as EAS environment variables in the `production` environment. EAS build servers evaluate `app.config.js` again and don't see GitHub variables. You can instead commit the real values in `app.config.js`; neither is secret.
- Upload or generate credentials with `eas credentials`: Android upload keystore, iOS distribution certificate, and provisioning profiles for `com.klaviyo.expoexample` and `com.klaviyo.expoexample.KlaviyoNotificationServiceExtension`.
- Add submit credentials on EAS: a Google Play service account key and an App Store Connect API key.
- Upload `google-services.json` as an EAS file environment variable named `GOOGLE_SERVICES_JSON` in the `production` environment.
- Create the Play Console app (the first upload to a new app must be manual) and the App Store Connect app record.
