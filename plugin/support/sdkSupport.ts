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
 * Lowest Expo SDK that can produce a working Android build.
 *
 * Below this, klaviyo-react-native-sdk pulls klaviyo-android-sdk, which requires
 * androidx.core 1.16.0 (compileSdk 35 / AGP 8.6). Expo 50 and 51 ship compileSdk 34,
 * so no Android build is possible. Measured, and not fixable from this package.
 *
 * Scoped to Android deliberately: that is the failure we reproduced and the one no
 * plugin setting avoids. iOS on 50/51 is untested, so the warning below says "Android"
 * rather than claiming both platforms.
 */
const MIN_BUILDABLE_ANDROID_SDK_VERSION = 52;

/**
 * Highest Expo SDK whose autolinking does NOT understand the `apple` platform key used
 * by expo-module.config.json. At or below this, ExpoKlaviyo is dropped without an error:
 * prebuild succeeds, the app builds, and push handling is simply never installed.
 *
 * Named for the last broken version rather than the first working one so it reads the
 * same way it is compared (`major <= LAST_SDK_WITHOUT_AUTOLINKING`) and so the message
 * can use it directly instead of doing arithmetic on it.
 */
const LAST_SDK_WITHOUT_AUTOLINKING = 49;

/**
 * Expo resolves the config more than once per command — `expo start` re-resolves on
 * change, and EAS fingerprinting resolves it again — so warn at most once per version
 * per process. Without this, a developer on an unsupported SDK sees the same line
 * repeatedly in one session and learns to scroll past it.
 *
 * Keyed by version rather than a single boolean so a changed SDK still reports.
 */
const warnedVersions = new Set<string>();

/**
 * Test-only. Clears the once-per-process dedupe state so each case starts clean.
 */
export function resetSdkWarningState(): void {
  warnedVersions.clear();
}

/**
 * Warn when the host app is on an Expo SDK this plugin does not support. Never throws.
 *
 * Runs on every config resolution — `expo prebuild`, but also `expo start`, `expo config`
 * and EAS fingerprinting — so it must stay cheap and free of side effects.
 */
export function warnOnUnsupportedSdk(sdkVersion: string | undefined): void {
  // A bare (non-Expo-managed) project has no sdkVersion at all; say that explicitly
  // rather than relying on String(undefined) parsing to NaN.
  if (sdkVersion == null) {
    return;
  }

  // Still guard NaN: sdkVersion can be a non-numeric sentinel such as 'UNVERSIONED'.
  const major = parseInt(sdkVersion.split('.')[0], 10);
  if (Number.isNaN(major) || major >= MIN_SUPPORTED_SDK_VERSION) {
    return;
  }

  if (warnedVersions.has(sdkVersion)) {
    return;
  }
  warnedVersions.add(sdkVersion);

  let detail: string;
  if (major <= LAST_SDK_WITHOUT_AUTOLINKING) {
    detail =
      `On SDK ${LAST_SDK_WITHOUT_AUTOLINKING} and below, Expo autolinking cannot load this plugin's ` +
      'native iOS module, so push notification handling will NOT work even though the build succeeds.';
  } else if (major < MIN_BUILDABLE_ANDROID_SDK_VERSION) {
    detail = 'The Android build is expected to fail.';
  } else {
    detail = 'This SDK built successfully in our testing, but is outside the supported range.';
  }

  KlaviyoLog.warn(
    `Expo SDK ${sdkVersion} is not supported (minimum is ${MIN_SUPPORTED_SDK_VERSION}). ${detail} ` +
      `Upgrade to Expo SDK ${MIN_SUPPORTED_SDK_VERSION} or newer.`
  );
}
