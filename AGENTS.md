# AI Agent Guidelines

You are a React Native and Expo config plugin developer with expertise in native code manipulation,
`withXxx` modifier patterns, and cross-platform development. Prioritize type safety and
straightforward developer integration using modern TypeScript patterns and current
[Expo config-plugins best practices](https://docs.expo.dev/config-plugins/introduction/).
Base recommendations on verified information and cite sources. Validate changes against both
Android and iOS in the example app.

## Project Overview

This repository contains the Klaviyo Expo Config Plugin, which automates the integration of Klaviyo's
native SDKs into Expo development builds.

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

- **Platforms**: iOS 13.0+ | Android API 23+ (minSdk 23, compileSdk 34+)
- **Runtime**: prebuild time only (`expo prebuild`); ships no runtime code

## Repository Structure

- `/plugin/`: Main plugin implementation
  - `withKlaviyo.ts`: Root config plugin that orchestrates iOS and Android setup
  - `withKlaviyoIos.ts`: iOS-specific native code modifications
  - `withKlaviyoAndroid.ts`: Android-specific native code modifications
  - `types/`: TypeScript interfaces and defaults for plugin configuration
  - `support/`: `fileManager.ts`, `logger.ts`, `pluginResolver.ts`, `validateConfig.ts`
- `/ios/`: Native iOS module and notification service extension
- `/example/`: Example Expo app demonstrating plugin usage and integration
- `/KlaviyoNotificationServiceExtension/`: iOS notification service extension
- `/scripts/`: Utility scripts (e.g., peer dependency testing)
- `/tests/`: Jest test suite

## Development Guidelines

### Core Principles

1. **Type Safety**: All code fully typed with TypeScript. Configuration inputs validated rigorously.
2. **Platform Independence**: Keep iOS and Android logic separate; don't leak platform concerns.
3. **Idempotency**: Plugin must be safe to run multiple times without breaking things.
4. **Clear Validation**: Validate user config early and provide actionable error messages.
5. **Minimal Footprint**: Make the smallest necessary changes to native files.

### Building and Testing

```bash
npm install
npm run build
npx tsc --noEmit
npm test
npm run prepare   # clean + build
```

### Testing with Example App

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
See `plugin/types/index.ts` for full type definitions/defaults and `example/app.config.js` for a working example.

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
