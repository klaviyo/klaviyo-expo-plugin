# Expo Plugin Migration Guide

This guide outlines how to migrate when upgrading to newer versions of the Klaviyo Expo plugin.

## Migrating to v0.3.0

### Version and build number (iOS)

The plugin no longer reads `projectVersion` or `marketingVersion` from the Klaviyo plugin options. Version and build number are taken from Expo’s app config instead.

**Old (plugin options):**

```js
plugins: [
  [
    'klaviyo-expo-plugin',
    {
      ios: {
        projectVersion: '3',
        marketingVersion: '0.3.0',
        // ...
      },
    },
  ],
],
```

**New (Expo config):**

```js
{
  version: '0.3.0',
  ios: {
    buildNumber: '3',
    // ...
  },
  "plugins": [
    [
      "klaviyo-expo-plugin",
      {
        "ios": {
           /* remove projectVersion and marketingVersion */ 
        } 
      }
    ],
  ],
}
```

Use top-level `version` for the marketing version (CFBundleShortVersionString) and `ios.buildNumber` for the build number (CFBundleVersion). The plugin applies these to both the main app and the Notification Service Extension.

### Optional module toggles (Android & iOS)

The plugin now supports toggling the **Location** (geofencing) and **Forms** (in-app forms) native SDK modules on each platform. These control whether the full module is included or replaced with a lightweight no-op stub.

| Setting | Platform | Default | What it controls |
|---------|----------|---------|------------------|
| `android.geofencingEnabled` | Android | `false` | `klaviyoIncludeLocation` gradle property |
| `android.formsEnabled` | Android | `true` | `klaviyoIncludeForms` gradle property |
| `ios.geofencingEnabled` | iOS | `false` | `KLAVIYO_INCLUDE_LOCATION` Podfile ENV var |
| `ios.formsEnabled` | iOS | `true` | `KLAVIYO_INCLUDE_FORMS` Podfile ENV var |

> **Breaking change (Android):** The location module is now **excluded by default** on Android. Previously, the full location module (including Google Play Services Location and location permissions) was always bundled. If your app uses Klaviyo geofencing, you must now explicitly enable it:
>
> ```js
> ["klaviyo-expo-plugin", {
>   "android": { "geofencingEnabled": true },
>   "ios": { "geofencingEnabled": true }
> }]
> ```

Forms is included by default on both platforms. To exclude it (reduces binary size by omitting the WebView-based form rendering engine):

```js
["klaviyo-expo-plugin", {
  "android": { "formsEnabled": false },
  "ios": { "formsEnabled": false }
}]
```

When a module is excluded, any calls to its API methods will log an error and no-op silently — no crashes.

#### iOS geofencing internals change

The iOS geofencing toggle no longer injects `s.dependency 'KlaviyoLocation'` directly into the plugin's podspec. Instead, it sets Podfile ENV vars (`KLAVIYO_INCLUDE_LOCATION`, `KLAVIYO_INCLUDE_FORMS`) that the RN SDK's own podspec reads to conditionally include dependencies. This is not a user-facing change, but if you had any custom Podfile logic referencing `KlaviyoLocation` in the Expo plugin's podspec, it will no longer be there.

#### Deprecated gradle property

The old `klaviyoIncludeLocationPermissions` gradle property is automatically cleaned up and replaced by `klaviyoIncludeLocation`.
