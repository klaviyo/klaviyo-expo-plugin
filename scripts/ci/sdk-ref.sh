#!/usr/bin/env bash
# Prints one line identifying the plugin and the SDKs the example app is built with:
#   klaviyo-expo-plugin <version> | klaviyo-react-native-sdk <version> | iOS SDK <version> | Android SDK <version>
# The React Native SDK version comes from the example app's lockfile, falling
# back to the range declared in example/package.json. The native versions come
# from the installed klaviyo-react-native-sdk (its podspec and gradle.properties)
# and read "unknown" when the package is not installed. SDK_DIR overrides the
# package location.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SDK_DIR="${SDK_DIR:-${ROOT}/example/node_modules/klaviyo-react-native-sdk}"

IOS_SDK=unknown
ANDROID_SDK=unknown
if [[ -f "${SDK_DIR}/klaviyo-react-native-sdk.podspec" ]]; then
  IOS_SDK=$(sed -nE 's/.*s\.dependency[[:space:]]+"KlaviyoSwift",[[:space:]]*"([^"]+)".*/\1/p' "${SDK_DIR}/klaviyo-react-native-sdk.podspec" | head -1)
fi
if [[ -f "${SDK_DIR}/android/gradle.properties" ]]; then
  ANDROID_SDK=$(sed -nE 's/.*klaviyoAndroidSdkVersion=([^[:space:]]+).*/\1/p' "${SDK_DIR}/android/gradle.properties" | head -1)
fi

node -p "
  const plugin = require('${ROOT}/package.json');
  const lock = require('${ROOT}/example/package-lock.json');
  const pkg = require('${ROOT}/example/package.json');
  const sdk = (lock.packages['node_modules/klaviyo-react-native-sdk'] || {}).version
    || pkg.dependencies['klaviyo-react-native-sdk'];
  'klaviyo-expo-plugin ' + plugin.version + ' | klaviyo-react-native-sdk ' + sdk
    + ' | iOS SDK ${IOS_SDK:-unknown} | Android SDK ${ANDROID_SDK:-unknown}'
"
