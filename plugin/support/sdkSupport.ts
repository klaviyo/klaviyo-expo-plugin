import { KlaviyoLog } from './logger';

/**
 * Lowest Expo SDK this plugin officially supports.
 *
 * Set to match Expo's own documented support window rather than the lowest version
 * that happens to work: Expo removes an SDK from its documentation roughly a year
 * after release, and we do not want to promise support for an SDK upstream has
 * abandoned. SDK 52 and 53 are covered by CI and did build and launch in testing,
 * but are not a support commitment.
 */
const MIN_SUPPORTED_SDK_VERSION = 54;

/**
 * Lowest Expo SDK that can produce a working native build at all.
 *
 * Below this, klaviyo-react-native-sdk pulls klaviyo-android-sdk, which requires
 * androidx.core 1.16.0 (compileSdk 35 / AGP 8.6). Expo 50 and 51 ship compileSdk 34,
 * so no Android build is possible. Measured, and not fixable from this package.
 */
const MIN_BUILDABLE_SDK_VERSION = 52;

/**
 * Lowest Expo SDK whose autolinking understands the `apple` platform key used by
 * expo-module.config.json. Below this, ExpoKlaviyo is dropped without an error:
 * prebuild succeeds, the app builds, and push handling is simply never installed.
 */
const MIN_AUTOLINK_SDK_VERSION = 50;

/**
 * Warn when the host app is on an Expo SDK this plugin does not support. Never throws.
 *
 * Runs on every config resolution — `expo prebuild`, but also `expo start`, `expo config`
 * and EAS fingerprinting — so it must stay cheap and free of side effects.
 */
export function warnOnUnsupportedSdk(sdkVersion: string | undefined): void {
  // NaN covers both an absent sdkVersion (bare workflow) and an unparseable one.
  const major = parseInt(String(sdkVersion).split('.')[0], 10);
  if (Number.isNaN(major) || major >= MIN_SUPPORTED_SDK_VERSION) {
    return;
  }

  let detail: string;
  if (major < MIN_AUTOLINK_SDK_VERSION) {
    detail =
      `On SDK ${MIN_AUTOLINK_SDK_VERSION - 1} and below, Expo autolinking cannot load this plugin's ` +
      'native iOS module, so push notification handling will NOT work even though the build succeeds.';
  } else if (major < MIN_BUILDABLE_SDK_VERSION) {
    detail = 'The native build is expected to fail.';
  } else {
    detail = 'This SDK built successfully in our testing, but is outside the supported range.';
  }

  KlaviyoLog.warn(
    `Expo SDK ${sdkVersion} is not supported (minimum is ${MIN_SUPPORTED_SDK_VERSION}). ${detail} ` +
      `Upgrade to Expo SDK ${MIN_SUPPORTED_SDK_VERSION} or newer.`
  );
}
