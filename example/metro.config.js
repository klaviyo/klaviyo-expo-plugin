const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const localKlaviyoPath = path.resolve(projectRoot, '../../klaviyo-react-native-sdk');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [localKlaviyoPath];

module.exports = config;