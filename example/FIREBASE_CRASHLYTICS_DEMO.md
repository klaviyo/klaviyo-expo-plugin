# Firebase Crashlytics Compatibility Demo

This example demonstrates that `klaviyo-expo-plugin` works correctly alongside `@react-native-firebase/crashlytics`.

## What This Demonstrates

This PR addresses issue #77 by showing that:

1. ✅ Firebase Crashlytics and Klaviyo plugins can coexist without conflicts
2. ✅ `expo prebuild` successfully applies both plugins
3. ✅ Firebase Crashlytics Gradle plugin is properly configured
4. ✅ Klaviyo Android modifications are properly applied

## Changes Made

### Dependencies Added
- `@react-native-firebase/app@23.8.2`
- `@react-native-firebase/crashlytics@23.8.2`

### Plugin Configuration
Updated `app.config.js` to include Firebase plugins **before** Klaviyo plugin:

```javascript
plugins: [
  '@react-native-firebase/app',              // Firebase App (required)
  '@react-native-firebase/crashlytics',      // Firebase Crashlytics
  'expo-router',
  ['klaviyo-expo-plugin', { /* config */ }]  // Klaviyo plugin
]
```

## Verification

After running `npx expo prebuild --platform android --clean`, the following files were verified:

### ✅ Firebase Crashlytics Gradle Plugin Applied

**android/build.gradle:**
```gradle
classpath 'com.google.firebase:firebase-crashlytics-gradle:3.0.6'
```

**android/app/build.gradle:**
```gradle
apply plugin: 'com.google.firebase.crashlytics'
```

### ✅ Klaviyo Modifications Applied

**AndroidManifest.xml:**
```xml
<meta-data android:name="com.klaviyo.core.log_level" android:value="1"/>
<service android:name="com.klaviyo.pushFcm.KlaviyoPushService" android:exported="false">
  <intent-filter>
    <action android:name="com.google.firebase.MESSAGING_EVENT"/>
  </intent-filter>
</service>
```

**MainActivity.kt:**
```kotlin
import com.klaviyo.analytics.Klaviyo

override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    Klaviyo.handlePush(intent)
}

override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme);
    super.onCreate(null)
    Klaviyo.handlePush(intent)  // Push tracking code injected
}
```

## Key Findings

### No File Conflicts
The two plugins modify **completely different files**:

| Plugin | Modified Files |
|--------|---------------|
| Firebase Crashlytics | `android/build.gradle`<br>`android/app/build.gradle` |
| Klaviyo | `AndroidManifest.xml`<br>`MainActivity.kt`<br>`colors.xml`<br>`strings.xml` |

### Plugin Order Matters
Place Firebase plugins **before** other plugins that might also modify build files:

```javascript
plugins: [
  '@react-native-firebase/app',        // ← First
  '@react-native-firebase/crashlytics', // ← Second
  'expo-notifications',                 // ← Then other plugins
  'klaviyo-expo-plugin'                 // ← Last (safest)
]
```

## Testing Instructions

To test this configuration:

```bash
# 1. Install dependencies
cd example
npm install

# 2. Build the plugin
cd ..
npm run build

# 3. Clean prebuild
cd example
rm -rf android
npx expo prebuild --platform android --clean

# 4. Verify Firebase Crashlytics plugin
grep "firebase-crashlytics-gradle" android/build.gradle
grep "com.google.firebase.crashlytics" android/app/build.gradle

# 5. Verify Klaviyo modifications
grep "KlaviyoPushService" android/app/src/main/AndroidManifest.xml
grep "Klaviyo.handlePush" android/app/src/main/java/com/klaviyo/expoexample/MainActivity.kt
```

All checks should return results, confirming both plugins are properly configured! ✅

## Requirements

- Expo SDK 54+
- `google-services.json` file (dummy file included for testing)
- Node.js 18+ (v25 may show warnings but works)

## Related Issue

Resolves: #77

## Notes

- The included `google-services.json` is a **dummy file for testing purposes only**
- In production, use your actual Firebase project configuration
- The Klaviyo plugin does **NOT** modify Gradle files, eliminating potential conflicts
- Both plugins listen for `com.google.firebase.MESSAGING_EVENT` (expected behavior)
