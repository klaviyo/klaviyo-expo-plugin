const path = require('path');
const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const localKlaviyoPath = path.resolve(projectRoot, '../../klaviyo-react-native-sdk');

const config = getDefaultConfig(projectRoot);

// Only add the local path to watchFolders if it exists (for local development)
if (fs.existsSync(localKlaviyoPath)) {
  config.watchFolders = [localKlaviyoPath];
}

module.exports = config;