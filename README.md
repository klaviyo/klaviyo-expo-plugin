# klaviyo-expo-plugin

#### todo link npm, maybe CI builds?

## Contents

- [klaviyo-expo-plugin](#klaviyo-expo-plugin)
  - [Introduction](#introduction)
  - [Requirements](#requirements)
    - [Expo](#expo)
    - [Android](#android)
    - [iOS](#ios)
  - [Expo Config Dependencies](#expo-config-dependencies)
    - [Required Config Values](#required-config-values)
    - [Modified Config Values](#modified-config-values)
  - [Installation](#installation)
  - [Configuration](#configuration)
    - [Plugin Props](#plugin-props)
    - [Versioning](#versioning)
  - [Features](#features)
    - [Push Notifications](#push-notifications)
      - [Android Push Setup](#android-push-setup)
      - [iOS Push Setup](#ios-push-setup)
      - [Notification Icons and Colors](#notification-icons-and-colors)
    - [Deep Linking](#deep-linking)
    - [Badge Count](#badge-count)
  - [Generated Code](#generated-code)
    - [Android Generated Code](#android-generated-code)
    - [iOS Generated Code](#ios-generated-code)
  - [Example App](#example-app)
  - [Troubleshooting](#troubleshooting)
  - [Contributing](#contributing)
  - [License](#license)

## Introduction

The Klaviyo Expo Plugin is a config plugin for Expo that automates the integration of Klaviyo's native SDKs into your Expo project. This plugin handles all the necessary native code modifications required for Klaviyo functionality, eliminating the need for manual native code changes.

The plugin is designed to work with the [klaviyo-react-native-sdk](https://github.com/klaviyo/klaviyo-react-native-sdk) and automates the setup of:
- Push notification handling
- Deep linking configuration
- Badge count management
- Notification service extensions
- Icon / color notification configuration

## Requirements

### Expo
- Expo SDK TODO or higher
- Development build with custom native code

### Android
- `minSdkVersion` of `23+`
- `compileSdkVersion` of `34+`

### iOS
- Minimum Deployment Target `13.0+`
- Apple Push Notification Service (APNs) set up
- App Groups capability for rich push notifications

## Expo Config Dependencies

The Klaviyo Expo Plugin relies on and modifies several Expo config values to properly set up native functionality. Here's what you need to know:

### Required Config Values

The following config values must be present in your `app.json` or `app.config.js`:

```json
{
  "expo": {
    "android": {
      "package": "your.package.name",  // Required for Android setup - must match FCM value
      "googleServicesFile": "./google-services.json"  // Required for FCM
    },
    "ios": {
      "bundleIdentifier": "your.bundle.identifier"  // Required for iOS setup
    }
  }
}
```

### Modified Config Values

The plugin will modify the following native properties:

#### Android
- Adds FCM service to `AndroidManifest.xml`
- Adds notification channel configuration
- Modifies `MainActivity.kt` for push handling (optional)
- Adds notification icon and color resources
- Updates `strings.xml` with plugin metadata

#### iOS
- Adds notification service extension target
- Configures app groups for rich push
- Updates `Info.plist` with notification permissions
- Modifies `AppDelegate` for push handling
- Adds Klaviyo configuration plist
- Updates Podfile with required dependencies


## Installation

1. Install the plugin in your Expo project. You need both `klaviyo-react-native` and `klaviyo-expo-plugin` for full functionality:

```sh
npm install klaviyo-react-native
npx expo install klaviyo-expo-plugin
```

2. Add the plugin to your `app.json` or `app.config.js`:

```json
{
  "expo": {
    "plugins": [
        //... other configs
      [
        "klaviyo-expo-plugin",
        {
          "android": {
            "logLevel": 1,
            "openTracking": true,
            "notificationIconFilePath": "./your/notification/icon/path.png",
            "notificationColor": "#FF0000" // hex code format
          },
          "ios": {
            "badgeAutoclearing": true
          }
        }
      ]
    ]
  }
}
```

3. (optional) We recommend using the `expo-notifications` library for push permissions, token retrieval, and reading push content. Check out our `/example` project for some ideas on how to use this.

## Configuration

#### Plugin Props Table

| Plugin Prop | Required | Description |
|-------------|----------|-------------|
| `android.logLevel` | optional | Sets the logging level for Android. Default: `1` (DEBUG). Values: `0` (NONE), `1` (DEBUG), `2` (INFO), `3` (WARN), `4` (ERROR) |
| `android.openTracking` | optional | Enables tracking when notifications are opened. Default: `true`. Note that this is considered to be a `dangerous` mod, as it directly modifies your MainActivity code. |
| `android.notificationIconFilePath` | optional | Path to the notification icon file. Should be a white, transparent PNG. Default: none specified. Note that you should set this instead of the `expo-notifications` one, as they can conflict with eachother. |
| `android.notificationColor` | optional | Hex color for notification accent. Must be a valid hex value, e.g: `"#FF0000"` |
| `ios.badgeAutoclearing` | optional | Enables automatic badge count clearing when app is opened. Default: `true` |
|TODO| TODO| Belle any shot you can help me explain these other ones?|


### Versioning

In your configuration file, make sure you set:

| Property | Details |
|----------|---------|
| `version` | Your app version. Corresponds to `CFBundleShortVersionString` on iOS. Format: "X.X.X" (e.g. "1.0" or "2.3.1") |
| `ios.buildNumber` | Build number for your iOS app. Corresponds to `CFBundleVersion`. Format: "42" or "100" |
| `ios.bundleIdentifier` | Bundle identifier for your iOS app. Format: "com.companyname.appname" |
| `android.package` | Package name for your Android app. Format: "com.companyname.appname" |

These values are used in various native configuration files and must be properly set for the plugin to work correctly.

## Features

### Push Notifications

The plugin automatically configures push notification handling for both platforms.

#### Android Push Setup
- Configures FCM service
- Sets up notification channels
- Handles notification icons and colors
- Implements push open tracking

#### iOS Push Setup
- Configures APNs capabilities
- Sets up notification service extension
- Implements badge count management
- Handles rich push notifications

#### Notification Icons and Colors
You can customize notification appearance:


### Deep Linking

The plugin automatically configures deep linking for both platforms:

- Android: Sets up intent filters in AndroidManifest.xml
- iOS: Configures URL schemes and associated domains

### Badge Count

The plugin handles badge count management:

- iOS: Configures badge autoclearing
- Android: Automatically manages badge counts

## Generated Code

The plugin uses Expo's config plugins system to modify native code. Here's what gets generated:

### Android Generated Code

1. **MainActivity.kt** modifications:
```kotlin
override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    // Tracks when a system tray notification is opened
    Klaviyo.handlePush(intent)
}
```

2. **AndroidManifest.xml** additions:
```xml
<service
    android:name="com.klaviyo.pushFcm.KlaviyoPushService"
    android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>
```

### iOS Generated Code

1. **NotificationService.swift**:
```swift
import UserNotifications
import KlaviyoSwiftExtension

class NotificationService: UNNotificationServiceExtension {
    // Handles rich push notifications
}
```

2. **AppDelegate** modifications for push handling and deep linking

## Example App

We created an example app to show how to use this plugin in coordination with the `klaviyo-react-native` SDK. Set this up and run based on whichever platform you'd like to test on:
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

## License

The Klaviyo Expo Plugin is available under the terms of the [MIT license](LICENSE). 


