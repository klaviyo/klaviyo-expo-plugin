const pluginPackage = require('../package.json');
const examplePackage = require('./package.json');

const readInstalledVersion = (name) => {
  try {
    return require(`${name}/package.json`).version;
  } catch {
    return examplePackage.dependencies[name];
  }
};

module.exports = () => {
  return {
    name: 'klaviyo plugin example',
    slug: 'klaviyo-plugin-example',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'expoexample',
    userInterfaceStyle: 'automatic',
    newArchEnabled: false,
    ios: {
      // CI sets IOS_BUILD_NUMBER (scripts/ci/next-build-number.js); local builds use 1.
      buildNumber: process.env.IOS_BUILD_NUMBER || '1',
      bundleIdentifier: 'com.klaviyo.expoexample',
      infoPlist: {
        UIBackgroundModes: ['remote-notification'],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.klaviyo.expoexample',
      // CI sets ANDROID_VERSION_CODE (scripts/ci/next-build-number.js); local builds use 1.
      versionCode: parseInt(process.env.ANDROID_VERSION_CODE || '1', 10),
      jsEngine: 'hermes',
      // For EAS builds with secret uploaded
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'klaviyo-expo-plugin',
        {
          android: {
            logLevel: 1,
            automaticPushOpenTracking: true,
            notificationIconFilePath: './assets/images/ic_notification.png',
            notificationColor: '#FF0000',
            geofencingEnabled: true,
            formsEnabled: true
          },
          ios: {
            badgeAutoclearing: true,
            codeSigningStyle: 'Automatic',
            // CI sets APPLE_TEAM_ID; replace the placeholder for local builds
            devTeam: process.env.APPLE_TEAM_ID || 'XXXXXXXXXX',
            geofencingEnabled: true,
            formsEnabled: true,
            includeNotificationServiceExtension: true,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    assetBundlePatterns: ['**/*'],
    extra: {
      router: {},
      buildInfo: {
        pluginVersion: pluginPackage.version,
        reactNativeSdkVersion: readInstalledVersion('klaviyo-react-native-sdk'),
        // CI sets APP_COMMIT_SHA via eas.json; local builds show 'local'.
        commitSha: process.env.APP_COMMIT_SHA || 'local',
      },
      eas: {
        // CI sets KLAVIYO_EAS_PROJECT_ID; replace the placeholder for local builds
        projectId: process.env.KLAVIYO_EAS_PROJECT_ID || 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
        build: {
          experimental: {
            ios: {
              appExtensions: [
                {
                  targetName: 'KlaviyoNotificationServiceExtension',
                  bundleIdentifier: 'com.klaviyo.expoexample.KlaviyoNotificationServiceExtension',
                  entitlements: {
                    'com.apple.security.application-groups': [
                      'group.com.klaviyo.expoexample.KlaviyoNotificationServiceExtension.shared',
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    },
    owner: 'klaviyo',
  };
};
