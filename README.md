# klaviyo-expo-plugin

### 🚧 Project Status: Release Candidate 🚧

## Contents

- [klaviyo-expo-plugin](#klaviyo-expo-plugin)
  - [Introduction](#introduction)
  - [Requirements](#requirements)
    - [Expo](#expo)
    - [Android](#android)
    - [iOS](#ios)
  - [Installation](#installation)
  - [Configuration](#configuration)
    - [Plugin props](#plugin-props)
    - [Required config values](#required-config-values)
  - [Example app](#example-app)
  - [Troubleshooting](#troubleshooting)
  - [License](#license)

## Introduction

The Klaviyo Expo plugin is a configuration plugin for Expo that automates the integration of Klaviyo's native SDKs into your Expo project. This plugin handles all the necessary native code modifications required for Klaviyo functionality, eliminating the need for manual native code changes.

The plugin is designed to work with the [klaviyo-react-native-sdk](https://github.com/klaviyo/klaviyo-react-native-sdk) and automates the setup of:

- Push notification open tracking
- Rich push notification support
- Badge count management (iOS)
- Key:value pair data reading
- Notification service extension setup (iOS)
- Icon / color notification configuration (Android)

## Requirements

### Expo

- Your Expo app needs to be run as a [development build](https://docs.expo.dev/develop/development-builds/introduction/). This plugin will not work in Expo Go.

### Android

- `minSdkVersion` of `23+`
- `compileSdkVersion` of `34+`

### iOS

- Minimum Deployment Target `13.0+`
- Apple Push Notification Service (APNs) set up

## Installation

1. Install the plugin in your Expo project. You need both `klaviyo-react-native-sdk` and `klaviyo-expo-plugin` for full functionality:

```sh
npm install klaviyo-react-native-sdk
npx expo install klaviyo-expo-plugin
```

2. Add the plugin to your `app.json` or `app.config.js`:

```json
{
  "expo": {
    "plugins": [
        //... other plugins
      [
        "klaviyo-expo-plugin",
        {
          "android": {
            "logLevel": 1,
            "openTracking": true,
            "notificationIconFilePath": "./your/notification/icon/path.png",
            "notificationColor": "#00FF00"
          },
          "ios": {
            "badgeAutoclearing": true,
            "codeSigningStyle": "Automatic",
            "projectVersion": "1",
            "marketingVersion": "1.0",
            "swiftVersion": "5.0",
            "devTeam": undefined // your devTeam ID here
          }
        }
      ]
    ]
  }
}
```

3. Run a `prebuild` to apply the Expo plugin to your project:

```bash
npx expo prebuild
```

4. (optional) We recommend using the `expo-notifications` library for push permissions, token retrieval, and reading push content. Check out our `/example` project for some ideas on how to use this.

## Configuration

#### Plugin props

| Plugin prop | Type | Required | Description |
|-------------|------|----|-------------|
| `android.logLevel` | int | optional | Sets the logging level for the Klaviyo Android SDK. Default: `1` (DEBUG). Values: `0` (NONE), `1` (VERBOSE), `2` (DEBUG), `3` (INFO), `4` (WARNING), `5` (ERROR), `6` (ASSERT) |
| `android.openTracking` | boolean | optional | Enables tracking when notifications are opened. Default: `true`. Note that this is considered to be a **dangerous** mod, as it directly modifies your MainActivity code. |
| `android.notificationIconFilePath` | string | optional | Path to the notification icon file. Should be a white, transparent PNG. Default: none specified. Note that you should set this instead of `expo-notifications`, as they can conflict with each other. |
| `android.notificationColor` | string | optional | Hex color for notification accent. Must be a valid hex value, e.g., `"#FF0000"` |
| `ios.badgeAutoclearing` | boolean | optional | Enables automatic badge count clearing when app is opened. Default: `true` |
|`ios.codeSigningStyle`| string | optional | Declares management style for Code Signing Identity, Entitlements, and Provisioning Profile handled through XCode. Must be either "Manual" or "Automatic". Default: `"Automatic"`. Note: We highly recommend using the automatic signing style. If you select manual, you may need to go into your [developer.apple.com](https://developer.apple.com/) console and import the appropriate files and enable capabilities yourself.|
|`ios.projectVersion`| string | optional | The internal build number for version. Default: `"1"`|
|`ios.marketingVersion`| string | optional| The app version displayed in the App Store. Must be of the format "X.X" or "X.X.X". Default: `"1.0"`|
|`ios.swiftVersion`| string | optional| The version of Swift Language used in the project. Must be one of 4.0, 4.2, 5.0, or 6.0. Default: `"5.0"`|
|`ios.devTeam`| string | optional| The 10-digit alphanumeric Apple Development Team ID associated with the necessary signing capabilites, provisioning profile, etc. Format: "XXXXXXXXXX" Default: `undefined`|

#### Debug mode

If you'd like to see debug logs of your prebuild, add the following to your build command:

```bash
EXPO_DEBUG=true npx expo prebuild

EXPO_DEBUG=true npx expo run:platform
```

Please attach these to any build issues you have to help the team debug.

### Required config values

In your configuration file, set the following:

| Property | Details |
|----------|---------|
| `version` | Your app version. Corresponds to `CFBundleShortVersionString` on iOS. Format: `"X.X.X"` (e.g. `"1.0"` or `"2.3.1"`) |
| `ios.buildNumber` | Build number for your iOS app. Corresponds to `CFBundleVersion`. Format: `"42"`|
| `ios.bundleIdentifier` | Bundle identifier for your iOS app. Format: `"com.companyname.appname"` |
| `ios.infoPlist.UIBackgroundModes` | set this to `["remote-notification"]` to ensure you can receive background push notifications |
| `android.package` | Package name for your Android app. Format: `"com.companyname.appname"` |

These values are used in various native configuration files and must be properly set for the plugin to work correctly.

## Example app

We created an example app to show how to use this plugin in coordination with the `klaviyo-react-native-sdk`. Set this up and run based on whichever platform you'd like to test on:

```sh
// from repo directory
cd example
npm run clean-android // for android
npm run clean-ios // for ios
npm run reset-all // deletes node modules and built folders
```

## Troubleshooting

Common issues and solutions:

1. **Push Notifications Not Working**
   - Verify FCM/APNs setup
   - Check notification permissions
   - Ensure proper configuration in app.json

2. **Deep Links Not Working**
   - Verify URL scheme configuration
   - Check intent filters (Android)
   - Verify associated domains (iOS)

3. **Build Errors**
   - Clean and rebuild the project
   - Verify Expo SDK version compatibility
   - Check native dependencies

If you are unable to 

## License

The Klaviyo Expo Plugin is available under the terms of the [MIT license](LICENSE).