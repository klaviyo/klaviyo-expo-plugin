# Expo Plugin Migration Guide

This guide outlines how to migrate when upgrading to newer versions of the Klaviyo Expo plugin.

## Migrating to v0.2.1

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
        marketingVersion: '0.2.0',
        // ...
      },
    },
  ],
],
```

**New (Expo config):**

```js
{
  "version": "0.2.1",
  "ios": {
    "buildNumber": "3",
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
