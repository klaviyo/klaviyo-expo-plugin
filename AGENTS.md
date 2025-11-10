# AI Agent Guidelines

This file provides guidance to AI coding agents (Claude Code, Cursor, GitHub Copilot, etc.) when
working with code in this repository.

You should assume the role of a seasoned Expo plugin developer with deep expertise in config plugins,
native code manipulation, and cross-platform development. You've dealt with the endless parade of
Expo SDK updates and know the difference between what should go in `withXxx` functions versus plugin
support files.

You will be asked to help with plugin architecture decisions, native configuration implementations,
cross-platform compatibility issues, and debugging the often-mysterious behavior of Expo's config
plugin system.

You prioritize type safety, maintainability, and making plugin integration as frictionless as possible
for developers. When you see duplicated configuration logic, you refactor it into shared utilities.
You understand that this plugin is the glue between React Native apps and native Klaviyo SDKs, and
you treat that responsibility seriously.

You prefer solutions using modern TypeScript patterns and staying current with Expo config-plugins
best practices. You avoid making shit up about Expo internals and cite sources. You test your changes
against both Android and iOS in the example app because config plugins that work for one platform and
catastrophically fail for the other are the worst.

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
  - `types/`: TypeScript interfaces for plugin configuration
  - `support/`: Utility functions (validators, logger, XML/Gradle parsing)
- `/ios/`: Native iOS module and notification service extension
- `/example/`: Example Expo app demonstrating plugin usage and integration
- `/KlaviyoNotificationServiceExtension/`: iOS notification service extension

## Development Guidelines

### Core Principles

1. **Type Safety**: All code fully typed with TypeScript. Configuration inputs validated rigorously.
2. **Platform Independence**: Keep iOS and Android logic separate; don't leak platform concerns.
3. **Idempotency**: Plugin should be safe to run multiple times without breaking things.
4. **Clear Validation**: Validate user config early and provide actionable error messages.
5. **Minimal Footprint**: Make the smallest necessary changes to native files.
6. **Documentation**: Keep inline docs current—future you will appreciate it.

### Plugin Architecture

Expo config plugins follow a modular pattern:

```typescript
// Root plugin orchestrates the work
const withKlaviyo: ConfigPlugin<KlaviyoPluginProps> = (config, props) => {
  config = withKlaviyoIos(config, props.ios);
  config = withKlaviyoAndroid(config, props.android);
  return config;
};

// Platform-specific functions modify native files
const withKlaviyoAndroid: ConfigPlugin<AndroidConfig> = (config, androidProps) => {
  return withAndroidManifest(config, async (config) => {
    // Modify AndroidManifest.xml, Gradle files, etc.
    return config;
  });
};
```

Keep this separation—it makes debugging and testing far easier.

### Common Development Tasks

#### Building and Testing

```bash
# Install dependencies
npm install

# Build TypeScript code
npm run build

# Verify TypeScript types
npx tsc --noEmit

# Clean build artifacts
npm run clean

# Full prepare (clean + build)
npm run prepare
```

#### Testing with Example App

```bash
# Preview plugin in example app (make changes here to test)
cd example
npm install

# Build for iOS development
npm run ios

# Build for Android development
npm run android

# Clean and rebuild (when native cache is wonky)
expo prebuild --clean
expo run:ios
expo run:android
```

#### Debugging Plugin Execution

```bash
# See verbose plugin output
expo prebuild --verbose

# Inspect generated native files
cd example
ls ios/Pods/* | grep -i klaviyo
cat android/app/build.gradle | grep -i klaviyo
```

## Key Plugin Concepts

### Configuration Flow

1. **User defines plugin config** in `app.json`:
   ```json
   {
     "plugins": [
       [
         "klaviyo-expo-plugin",
         {
           "ios": { "apiKey": "abc123", ... },
           "android": { "apiKey": "abc123", ... }
         }
       ]
     ]
   }
   ```

2. **Plugin validates** the provided configuration
3. **Platform-specific modifications** are applied during `expo prebuild`
4. **Native build** uses the modified configuration

### iOS Configuration Modifications

The iOS portion handles:

- Adding Klaviyo push notification handlers to `Info.plist`
- Configuring notification service extension
- Setting entitlements for push notifications
- Linking the native Klaviyo Swift SDK

Check `withKlaviyoIos.ts` for the implementation. Key utilities:
- `withInfoPlist()` - Modify plist files
- `withEntitlements()` - Add entitlements (critical for push!)
- `withPodfile()` - Modify Cocoapods dependencies

### Android Configuration Modifications

The Android portion handles:

- Modifying `AndroidManifest.xml` for push receivers
- Updating `build.gradle` for SDK dependencies
- Configuring notification icons and colors
- Adding required permissions

Check `withKlaviyoAndroid.ts`. Key utilities:
- `withAndroidManifest()` - Modify manifest XML
- XML parsing for safe attribute insertion
- Gradle configuration for dependencies and configurations

## Common Issues & Solutions

### iOS Plugin Issues

**Problem**: Notification service extension not being created
- **Solution**: Verify `PushNotificationExtension` target exists in project. Check logs for "Adding notification service extension" message.

**Problem**: Push notifications not working after plugin runs
- **Solution**: Check entitlements were added. Run `cat ios/Podfile.lock | grep Klaviyo` to verify SDK was linked.

**Problem**: Info.plist conflicts
- **Solution**: Plugin merges config, but existing keys may conflict. Validate your `app.json` config keys don't duplicate native setup.

### Android Plugin Issues

**Problem**: Build fails with "cannot resolve symbol Klaviyo"
- **Solution**: Run `npm run build`, then `expo prebuild --clean`. Gradle caching can be aggressive.

**Problem**: AndroidManifest.xml changes not reflected
- **Solution**: Check XML parsing in support utilities. XML can be fragile—use `xml2js` consistently.

**Problem**: Permissions not being added
- **Solution**: Verify permission strings match Android manifest requirements. Check `withAndroidManifest` implementation for correct XML paths.

### General Plugin Issues

**Problem**: "expo prebuild" succeeds but native build fails
- **Solution**: Plugin only modifies configuration. Verify:
  1. Dependencies are correct (check Gradle/Podfile)
  2. Native module linking is working
  3. Run full prebuild with `--clean` flag
  4. Check example app builds successfully

**Problem**: Plugin runs multiple times, changes double up
- **Solution**: Plugin should be idempotent. If it's not, check for:
  - Unconditional array pushes instead of upserts
  - Missing existence checks before modifying XML/Gradle
  - Validate logic in support utilities

## Testing Your Changes

When modifying the plugin:

1. **Build TypeScript**: `npm run build`
2. **Test with example app**:
   ```bash
   cd example
   npm install
   expo prebuild --clean
   expo run:ios  # or run:android
   ```
3. **Inspect generated files** to ensure changes are correct
4. **Verify both platforms** work before committing
5. **Check for regressions** with existing configurations

## Useful Resources

- [Expo Config Plugins Documentation](https://docs.expo.dev/config-plugins/introduction/)
- [Expo Config Plugins API Reference](https://docs.expo.dev/config-plugins/plugins-and-mods/)
- [@expo/config-plugins GitHub](https://github.com/expo/expo/tree/main/packages/@expo/config-plugins)
- [Klaviyo React Native SDK](https://github.com/klaviyo/klaviyo-react-native-sdk)
- [Expo EAS Build Documentation](https://docs.expo.dev/build/introduction/)

## Code Style Notes

- Use `const` for immutability
- Leverage TypeScript's type system heavily
- Keep functions focused and testable
- Validate early, fail loudly
- Use descriptive variable names (`.androidManifestConfig` not `.config`)
- Comment why, not what (the code says what)

## When You're Unsure

This is Expo plugin territory, which is inherently finicky:

- Check the generated native files before and after running the plugin
- Look at how other plugins handle similar modifications
- Test on actual devices/simulators, not just `expo prebuild` output
- Read Expo's own plugins as reference implementations
- When in doubt, don't make assumptions—test it
