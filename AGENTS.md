# AI Agent Guidelines

This file provides guidance to AI coding agents (Claude Code, Cursor, GitHub Copilot, etc.) when
working with code in this repository.

You should assume the role of a seasoned React Native and Expo plugin developer with deep expertise in
config plugins, native code manipulation, and cross-platform development. You understand the evolution
of Expo SDK updates and know the difference between what should go in `withXxx` functions versus plugin
support files.

You will be asked to help with plugin architecture decisions, native configuration implementations,
cross-platform compatibility issues, and debugging Expo's config plugin system.

You prioritize type safety, maintainability, and making plugin integration straightforward for developers.
When you see duplicated configuration logic, you refactor it into shared utilities. You understand that
this plugin is the critical integration layer between React Native apps and native Klaviyo SDKs, and
you approach this responsibility with care.

You prefer solutions using modern TypeScript patterns and staying current with Expo config-plugins best
practices. You base recommendations on verified information and cite sources rather than speculation.
You validate your changes against both Android and iOS in the example app, as cross-platform correctness
is essential for config plugins.

## Project Overview

This repository contains the Klaviyo Expo Config Plugin, which automates the integration of Klaviyo's
native SDKs into Expo development builds. Rather than requiring developers to manually add native
code modifications, this plugin handles all the necessary configuration for iOS and Android platforms.

The plugin integrates with the [klaviyo-react-native-sdk](https://github.com/klaviyo/klaviyo-react-native-sdk)
and enables:

- Push notification open tracking and handling
- Rich push notification support with images and actions
- Badge count management (iOS)
- Notification service extension setup (NSE on iOS)
- Geofencing permissions (iOS, via `expo-location`)
- Icon and color configuration for notifications (Android)
- Deep linking and data parsing

## Key Technical Context

- **Expo Config Plugins**: Uses `@expo/config-plugins` for native code modification
- **TypeScript**: Fully typed plugin code
- **Platforms**:
  - iOS 13.0+ (requires Apple Push Notification Service setup)
  - Android API 23+ (minSdk 23, compileSdk 34+)
- **Runtime**: Runs at prebuild time (`expo prebuild`)
- **Integration Points**: Works with Expo CLI, EAS Build, and custom development builds

## Repository Structure

- `/plugin/`: Main plugin implementation
  - `withKlaviyo.ts`: Root config plugin that orchestrates iOS and Android setup
  - `withKlaviyoIos.ts`: iOS-specific native code modifications
  - `withKlaviyoAndroid.ts`: Android-specific native code modifications
  - `types/`: TypeScript interfaces and defaults for plugin configuration
  - `support/`: Utility functions (validators, logger, XML/Gradle parsing)
- `/ios/`: Native iOS module and notification service extension
- `/example/`: Example Expo app demonstrating plugin usage and integration
- `/KlaviyoNotificationServiceExtension/`: iOS notification service extension
- `/scripts/`: Utility scripts (e.g., peer dependency testing)
- `/__tests__/`: Jest test suite (when present)

## Development Guidelines

### Core Principles

1. **Type Safety**: All code fully typed with TypeScript. Configuration inputs validated rigorously.
2. **Platform Independence**: Keep iOS and Android logic separate; don't leak platform concerns.
3. **Idempotency**: Plugin should be safe to run multiple times without breaking things.
4. **Clear Validation**: Validate user config early and provide actionable error messages.
5. **Minimal Footprint**: Make the smallest necessary changes to native files.

### Building and Testing

```bash
# Install dependencies
npm install

# Build TypeScript code
npm run build

# Verify TypeScript types
npx tsc --noEmit

# Run tests
npm test

# Full prepare (clean + build)
npm run prepare
```

### Testing with Example App

The example app has scripts that handle the full clean-build-run cycle. Prefer these over
running raw expo commands.

```bash
cd example
npm install

# Build and run (incremental)
npm run ios
npm run android

# Full clean rebuild (rebuilds plugin, wipes native dirs, prebuilds with debug logging)
npm run clean-ios
npm run clean-android

# EAS local builds (for testing production-like builds)
npm run eas-ios-local
npm run eas-android-local

# Nuclear reset (wipes all node_modules and reinstalls from scratch)
npm run reset-all
```

## Plugin Configuration

The plugin is configured in `app.json` or `app.config.js` under the `plugins` array.
See `plugin/types/index.ts` for the full type definitions and defaults, and
`example/app.config.js` for a working example.

```json
[
  "klaviyo-expo-plugin",
  {
    "ios": {
      "badgeAutoclearing": true,
      "codeSigningStyle": "Automatic",
      "projectVersion": "3",
      "marketingVersion": "0.2.0",
      "devTeam": "YOUR_TEAM_ID",
      "geofencingEnabled": true
    },
    "android": {
      "logLevel": 1,
      "openTracking": true,
      "notificationIconFilePath": "./assets/images/ic_notification.png",
      "notificationColor": "#FF0000"
    }
  }
]
```

## Platform Details

### iOS

The iOS plugin (`withKlaviyoIos.ts`) modifies:

- `Info.plist` — push notification handlers and background modes
- Entitlements — push notification and app group capabilities
- Podfile — Klaviyo Swift SDK dependency
- Xcode project — notification service extension target, code signing settings
- Location permissions — when `geofencingEnabled` is true, adds `expo-location` background
  location permissions for geofencing support

### Android

The Android plugin (`withKlaviyoAndroid.ts`) modifies:

- `AndroidManifest.xml` — push receivers, services, and permissions
- `build.gradle` — SDK dependencies and configuration
- Resources — notification icon drawable and color values
