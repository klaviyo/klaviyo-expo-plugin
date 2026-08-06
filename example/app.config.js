module.exports = () => {
  return {
    name: 'klaviyo plugin example',
    slug: 'klaviyo-plugin-example',
    version: '0.4.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'expoexample',
    userInterfaceStyle: 'automatic',
    newArchEnabled: false,
    ios: {
      // Make sure to increment this and the version as needed when making builds
      buildNumber: '4',
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
            devTeam: 'G3793W2RJ2',
            geofencingEnabled: true,
            formsEnabled: true,
            includeNotificationServiceExtension: true,
            automaticPushTokenForwarding: true,
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
      eas: {
        projectId: '1c04d6a2-82fa-477d-8ade-a79321cbd0b1',
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
