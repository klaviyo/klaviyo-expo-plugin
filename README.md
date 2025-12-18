# klaviyo-expo-plugin
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
  - [Universal Links](#universal-links)
    - [iOS Setup](#ios-setup)
    - [Android Setup](#android-setup)
    - [React Native Code](#react-native-code)
  - [Geofencing](#geofencing)
    - [Configuration](#geofencing-configuration)
    - [Requesting Permissions](#requesting-permissions)
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
- Universal links / App links support

## Requirements

### Expo

- Your Expo app needs to be run as a [development build](https://docs.expo.dev/develop/development-builds/introduction/). This plugin will not work in Expo Go.

### Android

- `minSdkVersion` of `23+`
- `compileSdkVersion` of `34+`

### iOS

- Minimum Deployment Target `13.0+`
- Apple Push Notification Service (APNs) set up

> **⚠️ Important Note for Federated Apple Developer Accounts:** If you're using a federated Apple Developer account, you'll need to provide an ASC API token with Admin access. While Expo supports federated accounts through ASC API tokens, the EAS CLI cannot directly log into federated accounts for credential management. See [Expo's documentation on federated accounts](https://docs.expo.dev/app-signing/apple-developer-program-roles-and-permissions/#federated-apple-developer-accounts) for more details.

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
| `android.notificationColor` | string | optional | Hex color for notification accent. Must be a valid hex value, e.g., `"#FF0000"` Default: `undefined` |
| `ios.badgeAutoclearing` | boolean | optional | Enables automatic badge count clearing when app is opened. Default: `true` |
|`ios.codeSigningStyle`| string | optional | Declares management style for Code Signing Identity, Entitlements, and Provisioning Profile handled through XCode. Must be either "Manual" or "Automatic". Default: `"Automatic"`. Note: We highly recommend using the automatic signing style. If you select manual, you may need to go into your [developer.apple.com](https://developer.apple.com/) console and import the appropriate files and enable capabilities yourself.|
|`ios.projectVersion`| string | optional | The internal build number for version. Default: `"1"`|
|`ios.marketingVersion`| string | optional| The app version displayed in the App Store. Must be of the format "X.X" or "X.X.X". Default: `"1.0"`|
|`ios.devTeam`| string | optional| The 10-digit alphanumeric Apple Development Team ID associated with the necessary signing capabilites, provisioning profile, etc. Format: "XXXXXXXXXX" Default: `undefined`|
|`ios.geofencing`| object | optional | Configuration object for enabling geofencing/location tracking support. See [Geofencing](#geofencing) below. Default: `undefined` (geofencing disabled)|

Note: If you do not need to specify any of these for your project, it will use the defaults defined here. If you do not specify any of these props, you can add the plugin without additional arguments:
```
{
  "expo": {
    "plugins": [
        //... other plugins
        "klaviyo-expo-plugin"
    ]
  }
}
```

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

In addition, this plugin adds a `KlaviyoNotificationServiceExtension` target to support Notification Service Extension capabilities on iOS and utilizes [app groups](https://developer.apple.com/documentation/Xcode/configuring-app-groups) to sync and share data across the Klaviyo SDK modules. To support this added target and app group in your Expo configuration file, add:

```
"appExtensions": [
  {
    "targetName": "KlaviyoNotificationServiceExtension",
    "bundleIdentifier": "{YOUR_BUNDLE_ID}.KlaviyoNotificationServiceExtension",
    "entitlements": {
      "com.apple.security.application-groups": ["group.{YOUR_BUNDLE_ID}.KlaviyoNotificationServiceExtension.shared"]
    }
  }
]
```
to the `extra.eas.build.experimental.ios` body of your app config where `{YOUR_BUNDLE_ID}` is your own app's bundle id. (See [our example](https://github.com/klaviyo/klaviyo-expo-plugin/blob/d00e12aca1b4c077a9803f4d0c62d2b2e174ce79/example/app.json#L62-L82) app config.)

## Universal Links

Universal Links (iOS) and App Links (Android) allow you to navigate to a particular page within your app when users tap on links from outside your app, such as from emails, websites, or push notifications. Klaviyo uses universal links for click tracking in email campaigns, allowing you to track user engagement while seamlessly directing them to your app.

The Klaviyo SDK provides the `handleUniversalTrackingLink()` method to automatically handle click tracking for Klaviyo universal links and redirect users to the intended destination within your app.

> **⚠️ Important:** Universal link tracking requires `klaviyo-react-native-sdk` version **2.1.0 or higher**. Make sure you have the correct version installed:
> ```bash
> npm install klaviyo-react-native-sdk@^2.1.0
> ```

### iOS Setup

To enable universal links on iOS, you need to configure Associated Domains in your app configuration:

1. Add the `associatedDomains` array to your `ios` configuration in `app.json`:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.yourapp",
      "associatedDomains": [
        "applinks:trk.your-domain.com"
      ]
    }
  }
}
```

2. Verify domain ownership by hosting an `apple-app-site-association` file on your domain. This file must be accessible at `https://trk.your-domain.com/.well-known/apple-app-site-association` or `https://trk.your-domain.com/apple-app-site-association`.

For more details on setting up Associated Domains, see [Apple's documentation](https://developer.apple.com/documentation/xcode/supporting-associated-domains).

### Android Setup

To enable App Links on Android, you need to configure intent filters in your app configuration:

1. Add intent filters to your `android` configuration in `app.json`:

```json
{
  "expo": {
    "android": {
      "package": "com.yourcompany.yourapp",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "trk.your-domain.com",
              "pathPrefix": "/u"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

2. Verify domain ownership by hosting a Digital Asset Links JSON file on your domain. This file must be accessible at `https://trk.your-domain.com/.well-known/assetlinks.json`.

For more details on setting up Android App Links, see [Android's documentation](https://developer.android.com/training/app-links).

### React Native Code

In your React Native code, use Expo's `expo-linking` library to handle both universal links and custom deep links:

```typescript
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { Klaviyo } from 'klaviyo-react-native-sdk';

export default function App() {
  useEffect(() => {
    const handleUrl = (url: string) => {
      // Check if this is a Klaviyo universal tracking link
      if (Klaviyo.handleUniversalTrackingLink(url)) {
        // Klaviyo SDK is handling the tracking link
        // It will track the click and redirect to the destination URL
        console.log('Klaviyo tracking link processed:', url);
        return;
      }

      // Handle other deep links in your app (both custom schemes and universal links)
      // This will be called after Klaviyo redirects from the tracking link to your destination
      console.log('Navigating to destination:', url);
      // Add your navigation logic here (e.g., using React Navigation)
    };

    // Handle the initial URL if the app was opened with a link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl(url);
      }
    });

    // Listen for deep link events while the app is running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Rest of your app code
  return (
    // Your app components
  );
}
```

**How it works:**

1. When a user taps a Klaviyo tracking link (format: `https://trk.your-domain.com/u/...`), your app opens
2. The `handleUrl` function receives the URL
3. `Klaviyo.handleUniversalTrackingLink()` checks if it's a Klaviyo tracking link:
   - If **true**: The SDK tracks the click event and resolves the tracking link to its destination URL, which triggers another call to `handleUrl` with the destination
   - If **false**: The URL is not a Klaviyo tracking link, so you should handle it as a regular deep link
4. Your app navigates to the appropriate screen based on the destination URL

For more information on deep linking with Expo, see [Expo's Linking documentation](https://docs.expo.dev/guides/linking/).

## Geofencing

Geofencing enables location-based marketing by allowing Klaviyo to trigger events when users enter or exit specific geographic regions.

### Configuration

To enable geofencing support, add the `geofencing` configuration to your iOS plugin props:

```json
{
  "expo": {
    "plugins": [
      [
        "klaviyo-expo-plugin",
        {
          "ios": {
            "geofencing": {
              "enabled": true,
              "locationAlwaysAndWhenInUseUsageDescription": "We use your location to send you relevant offers and updates based on places you visit.",
              "locationAlwaysUsageDescription": "We use your location in the background to send you relevant offers based on places you visit."
            }
          }
        }
      ]
    ]
  }
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `enabled` | boolean | required | Enables geofencing support. When `true`, adds `KlaviyoLocation` pod dependency, injects `import KlaviyoLocation` and `registerGeofencing()` into the app delegate, and adds `location` to `UIBackgroundModes`. Default: `false` |
| `locationAlwaysAndWhenInUseUsageDescription` | string | optional | The message displayed when requesting "Always and When In Use" location permission. Added to `NSLocationAlwaysAndWhenInUseUsageDescription` in Info.plist. |
| `locationAlwaysUsageDescription` | string | optional | The message displayed when requesting "Always" location permission. Added to `NSLocationAlwaysUsageDescription` in Info.plist. |

When geofencing is enabled, the plugin will:
- Add the `KlaviyoLocation` pod dependency to the project
- Import `KlaviyoLocation` and call `KlaviyoSDK().registerGeofencing()` in the app delegate
- Add `location` to `UIBackgroundModes` in Info.plist
- Add the location permission strings to Info.plist (if provided)

### Requesting Permissions

Users must grant location permissions at runtime. We recommend using `expo-location` to request permissions:

```typescript
import * as Location from 'expo-location';

async function requestLocationPermissions() {
  // First request foreground permission
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  
  if (foregroundStatus !== 'granted') {
    console.log('Foreground location permission denied');
    return;
  }

  // Then request background permission for geofencing
  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  
  if (backgroundStatus !== 'granted') {
    console.log('Background location permission denied');
    return;
  }

  console.log('Location permissions granted for geofencing');
}
```

See the example app for a complete implementation.

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
      - You may need to add the `aps-environment` to your `ios.entitlements` in your app config if it is not there already
        ```
        ios: {
          entitlements: {
          'aps-environment': 'development', // or 'production'
          // ... other entitlements
          }
        }
        ```

2. **Deep Links / Universal Links Not Working**
   - **Custom URL schemes**: Verify URL scheme configuration in your app.json
   - **Universal Links (iOS)**:
     - Verify `associatedDomains` is configured correctly in your app.json
     - Ensure your `apple-app-site-association` file is properly hosted and accessible
     - Test the domain verification using Apple's [app-site-association verification tool](https://search.developer.apple.com/appsearch-validation-tool/)
     - Make sure your domain supports HTTPS
   - **App Links (Android)**:
     - Check intent filters are configured with `autoVerify: true` in your app.json
     - Ensure your `assetlinks.json` file is properly hosted at `https://your-domain.com/.well-known/assetlinks.json`
     - Test the domain verification using the command: `adb shell pm get-app-links your.package.name`
     - Verify the domain supports HTTPS
   - **Testing Universal Links**:
     - Universal links will NOT work when tapped from within the same app or in simulator under certain conditions
     - Test by sending yourself an email with the link or using the Notes app
     - On Android, use `adb shell am start -a android.intent.action.VIEW -d "https://your-tracking-link"` to test

3. **Build Errors**
   - Clean and rebuild the project
   - Verify Expo SDK version compatibility
   - Check native dependencies
  
4. **EAS Errors**
   - (iOS) Check your Identifiers in the Apple Developer Console and ensure the main app target has Push Notifications and App Group capabilities checked, and your Notification Service Extension target has App Groups capability checked. Check that both App Group capabilities have the app group name with the appended `.KlaviyoNotificationServiceExtension.shared` suffix
   - (iOS) You should have two different provisioning profiles generated for this project. One for the main target, one for the Notification Service Extension.
   - (iOS) Ensure the correct provisioning profiles are being recognized by EAS, and declare the Notification Service Extension in the `extra.eas.build.experimental.ios.appExtensions` of your app config as mentioned [here](https://docs.expo.dev/build-reference/app-extensions/#managed-projects-experimental-support)

## License

The Klaviyo Expo Plugin is available under the terms of the [MIT license](LICENSE).
