const pluginPackage = require('../package.json');
const examplePackage = require('./package.json');

const fs = require('fs');
const path = require('path');

const readInstalledVersion = (name) => {
  try {
    return require(`${name}/package.json`).version;
  } catch {
    return examplePackage.dependencies[name];
  }
};

// Native SDK versions that klaviyo-react-native-sdk pins, read from SDK_DIR or the
// installed package. Returns undefined when it does not carry the expected file or key.
const readNativeSdkVersion = (file, pattern) => {
  try {
    const dir = process.env.SDK_DIR || path.dirname(require.resolve('klaviyo-react-native-sdk/package.json'));
    const match = fs.readFileSync(path.join(dir, file), 'utf8').match(pattern);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
};

const { execFileSync } = require('child_process');

// On an EAS build (EAS_BUILD is set) git is not consulted; the commit and branch come from APP_COMMIT_SHA and APP_BRANCH.
const git = (args) => {
  if (process.env.EAS_BUILD) return undefined;
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || undefined;
  } catch {
    return undefined;
  }
};

// Plugin ref: the release version when CI builds a release tag, otherwise
// branch@sha7. A build outside CI reads local:branch@sha7, plus -dirty when the
// working tree has uncommitted changes.
const pluginRef = (version) => {
  const sha = (process.env.APP_COMMIT_SHA || git(['rev-parse', '--short=7', 'HEAD']) || '').slice(0, 7) || undefined;
  if (process.env.APP_RELEASE_TAG) return version;
  const branch = process.env.APP_BRANCH || git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (!sha) return undefined;
  const ref = `${branch && branch !== 'HEAD' ? branch : '—'}@${sha}`;
  if (process.env.APP_COMMIT_SHA) return ref;
  return `local:${ref}${git(['status', '--porcelain']) ? '-dirty' : ''}`;
};

module.exports = () => {
  // CI sets APP_VERSION (scripts/ci/eas-deploy.sh), e.g. 1.2.0-rc.7.
  const appVersion = process.env.APP_VERSION || examplePackage.version;
  // EAS reads the top-level version for iOS and ignores ios.version; the App
  // Store requires numeric X.Y.Z. eas-deploy.sh exports EAS_BUILD_PLATFORM so
  // the local eas CLI resolves the same value as the build server.
  const version =
    process.env.EAS_BUILD_PLATFORM === 'ios' ? appVersion.split(/[-+]/)[0] : appVersion;
  const config = {
    name: 'klaviyo plugin example',
    slug: 'klaviyo-plugin-example',
    version,
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'expoexample',
    userInterfaceStyle: 'automatic',
    ios: {
      // CI sets IOS_BUILD_NUMBER (scripts/ci/next-build-number.js); local builds use 1.
      buildNumber: process.env.IOS_BUILD_NUMBER || '1',
      bundleIdentifier: 'com.klaviyo.expoexample',
      version: appVersion.split(/[-+]/)[0],
      infoPlist: {
        KlaviyoAppVersion: appVersion,
        UIBackgroundModes: ['remote-notification'],
        ITSAppUsesNonExemptEncryption: false,
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
      // CI sets APP_COMMIT_SHA, APP_BRANCH, APP_BUILT_AT and APP_RELEASE_TAG through eas.json.
      buildInfo: {
        appVersion: undefined,
        commitSha: process.env.APP_COMMIT_SHA || git(['rev-parse', '--short=7', 'HEAD']),
        branch: process.env.APP_BRANCH || git(['rev-parse', '--abbrev-ref', 'HEAD']),
        builtAt: process.env.APP_BUILT_AT,
        sourceLabel: process.env.APP_SOURCE_LABEL,
        event: process.env.APP_EVENT,
        sdks: [
          { key: 'expo-plugin', version: pluginPackage.version, ref: pluginRef(pluginPackage.version) },
          { key: 'rn', version: readInstalledVersion('klaviyo-react-native-sdk') },
          {
            key: 'ios',
            version: readNativeSdkVersion('klaviyo-react-native-sdk.podspec', /s\.dependency\s+"KlaviyoSwift",\s*"([^"]+)"/),
          },
          {
            key: 'android',
            version: readNativeSdkVersion('android/gradle.properties', /klaviyoAndroidSdkVersion=(\S+)/),
          },
        ],
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
  config.extra.buildInfo.appVersion = appVersion;
  return config;
};
