#!/usr/bin/env bash
# Prints one line identifying the plugin and React Native SDK versions in use:
#   klaviyo-expo-plugin <version> | klaviyo-react-native-sdk <version>
# The SDK version comes from the example app's lockfile, falling back to the
# range declared in example/package.json.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

node -p "
  const plugin = require('${ROOT}/package.json');
  const lock = require('${ROOT}/example/package-lock.json');
  const pkg = require('${ROOT}/example/package.json');
  const sdk = (lock.packages['node_modules/klaviyo-react-native-sdk'] || {}).version
    || pkg.dependencies['klaviyo-react-native-sdk'];
  'klaviyo-expo-plugin ' + plugin.version + ' | klaviyo-react-native-sdk ' + sdk
"
